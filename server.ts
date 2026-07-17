import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "url";
import { AsyncLocalStorage } from "async_hooks";

// Multi-tenant request context storage
const tenantStorage = new AsyncLocalStorage<{ username?: string }>();

// Safe ES Module and CommonJS compatibility for __filename and __dirname
const _filename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(_filename);

const app = express();
const PORT = process.env.APPLET_ID ? 3000 : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
const DATA_FILE = path.join(process.cwd(), "data.json");
const LICENSE_SECRET = "genesys-super-secret-2026";

// Initialize Firebase Admin SDK for Server-side Firestore operations
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

let db: admin.firestore.Firestore | null = null;
let useFirestore = false;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const projId = serviceAccount.project_id || firebaseConfig.projectId;
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projId,
    });
    console.log("[Firebase] Successfully initialized with service account key from environment variable.");
    
    // If using the sandbox project, use the custom named database ID. Otherwise, use the standard default database.
    if (projId === firebaseConfig.projectId) {
      db = firebaseConfig.firestoreDatabaseId ? getFirestore(firebaseConfig.firestoreDatabaseId) : getFirestore();
    } else {
      db = getFirestore();
    }
    useFirestore = true;
  } catch (err: any) {
    console.error("[Firebase] Failed to initialize with service account JSON, falling back to default:", err.message);
    if (process.env.APPLET_ID) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      db = firebaseConfig.firestoreDatabaseId ? getFirestore(firebaseConfig.firestoreDatabaseId) : getFirestore();
      useFirestore = true;
    }
  }
} else if (process.env.APPLET_ID) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
  db = firebaseConfig.firestoreDatabaseId ? getFirestore(firebaseConfig.firestoreDatabaseId) : getFirestore();
  useFirestore = true;
} else {
  console.log("[Database] No credentials or APPLET_ID detected. Operating in Local Offline Mode (using data.json).");
}

// Default permissions helper
const DEFAULT_PERMISSIONS = {
  admin: {
    inventory: { view: true, create: true, edit: true, delete: true },
    customers: { view: true, create: true, edit: true, delete: true },
    sales: { view: true, create: true, history: true },
    credit: { view: true, payment: true },
    admin: { view: true, users: true, settings: true },
  },
  manager: {
    inventory: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    sales: { view: true, create: true, history: true },
    credit: { view: true, payment: true },
    admin: { view: true, users: false, settings: false },
  },
  user: {
    inventory: { view: true, create: false, edit: false, delete: false },
    customers: { view: true, create: true, edit: false, delete: false },
    sales: { view: true, create: true, history: false },
    credit: { view: true, payment: false },
    admin: { view: false, users: false, settings: false },
  },
};

app.use(express.json({ limit: "50mb" }));

// Express middleware to extract the X-User header and run the request in the AsyncLocalStorage context
app.use((req, res, next) => {
  const username = req.headers["x-user"] ? String(req.headers["x-user"]) : "";
  tenantStorage.run({ username }, next);
});

// Local offline DB helper managers
let localDbMemory: any = null;

function loadLocalDb() {
  if (localDbMemory) return localDbMemory;
  if (fs.existsSync(DATA_FILE)) {
    try {
      localDbMemory = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (err) {
      console.error("Error reading local data.json, starting fresh:", err);
      localDbMemory = {};
    }
  } else {
    localDbMemory = {};
  }
  
  if (!localDbMemory.users) localDbMemory.users = [];
  if (!localDbMemory.products) localDbMemory.products = [];
  if (!localDbMemory.customers) localDbMemory.customers = [];
  if (!localDbMemory.sales) localDbMemory.sales = [];
  if (!localDbMemory.payments) localDbMemory.payments = [];
  if (!localDbMemory.returns) localDbMemory.returns = [];
  if (!localDbMemory.settings) localDbMemory.settings = {};
  
  return localDbMemory;
}

function saveLocalDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(localDbMemory, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving local data.json:", err);
  }
}

// Unified data helper managers (Firestore / Local fallback with Multi-Tenant Separation)
const LOCAL_LICENSE_FILE = path.join(process.cwd(), "local-license.json");
let cachedLicense: any = null;

function getLocalLicense() {
  if (cachedLicense) {
    return cachedLicense;
  }
  if (fs.existsSync(LOCAL_LICENSE_FILE)) {
    try {
      const lic = JSON.parse(fs.readFileSync(LOCAL_LICENSE_FILE, "utf-8"));
      cachedLicense = lic;
      return lic;
    } catch (e) {
      console.error("Error reading local-license.json", e);
    }
  }
  // Fallback to local memory if offline
  if (!useFirestore) {
    const local = loadLocalDb();
    cachedLicense = local.license || null;
    return cachedLicense;
  }
  return null;
}

function saveLocalLicense(license: any) {
  cachedLicense = license;
  try {
    fs.writeFileSync(LOCAL_LICENSE_FILE, JSON.stringify(license, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing local-license.json", e);
  }
  if (!useFirestore) {
    const local = loadLocalDb();
    local.license = license;
    saveLocalDb();
  }
}

function getCollectionNameForTenant(collectionName: string, licenseKey?: string): string {
  // Central collections are never partitioned
  if (collectionName === "registered_customers") {
    return "registered_customers";
  }
  
  // Check the active request user from AsyncLocalStorage context
  const store = tenantStorage.getStore();
  const username = store?.username;

  // The genesys_owner has their own completely isolated owner sandbox database partition.
  // This keeps the system owner's logs, testing products, and central manager view 100% separate from tenant business data.
  if (username === "genesys_owner") {
    return `tenant_owner_${collectionName}`;
  }
  
  if (!licenseKey) {
    const localLic = getLocalLicense();
    if (localLic && localLic.key) {
      licenseKey = localLic.key;
    }
  }
  
  if (licenseKey) {
    const safeKey = licenseKey.replace(/[^a-zA-Z0-9]/g, "_");
    return `tenant_${safeKey}_${collectionName}`;
  }
  
  return collectionName;
}

async function attemptSelfHealFromRegistry() {
  if (!useFirestore || !db) return;
  const localLic = getLocalLicense();
  if (localLic) return; // Already activated locally!

  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (!renderUrl) return;

  try {
    console.log(`[Self-Heal] No local license found, searching central registry for domain: ${renderUrl}`);
    const colRef = db.collection("registered_customers");
    const snapshot = await colRef.where("domain", "==", renderUrl).get();
    
    if (!snapshot.empty) {
      let foundReg: any = null;
      snapshot.forEach(doc => {
        foundReg = doc.data();
      });

      if (foundReg && foundReg.licenseKey) {
        console.log(`[Self-Heal] Found matching license registration for this domain! License Key: ${foundReg.licenseKey}`);
        
        const license = {
          key: foundReg.licenseKey,
          type: foundReg.licenseType,
          activatedAt: foundReg.activatedAt || new Date().toISOString(),
          expiresAt: foundReg.expiresAt
        };
        
        saveLocalLicense(license);
        console.log(`[Self-Heal] Successfully self-healed and restored local-license.json for business: ${foundReg.businessName}`);
      }
    } else {
      console.log(`[Self-Heal] No registration found for domain: ${renderUrl}`);
    }
  } catch (err: any) {
    console.error(`[Self-Heal] Error attempting self-heal:`, err.message);
  }
}

async function getCollectionData(collectionName: string): Promise<any[]> {
  const finalCollection = getCollectionNameForTenant(collectionName);
  if (useFirestore && db) {
    try {
      const colRef = db.collection(finalCollection);
      const snapshot = await colRef.get();
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ ...d.data(), id: d.id });
      });
      return list;
    } catch (err) {
      console.error(`Error fetching collection ${finalCollection} from Firestore:`, err);
      return [];
    }
  } else {
    const local = loadLocalDb();
    if (collectionName === "settings") {
      return Object.keys(local.settings || {}).map(key => ({
        ...local.settings[key],
        id: key
      }));
    }
    return local[collectionName] || [];
  }
}

async function setDocumentData(collectionName: string, docId: string, data: any): Promise<void> {
  const isGlobalLicenseDoc = collectionName === "settings" && docId === "license";
  const isGlobalOwnerDoc = collectionName === "users" && docId === "genesys_owner";
  const finalCollection = isGlobalLicenseDoc ? "settings" : (isGlobalOwnerDoc ? "users" : getCollectionNameForTenant(collectionName));
  if (useFirestore && db) {
    try {
      const docRef = db.collection(finalCollection).doc(docId);
      await docRef.set(data);
    } catch (err) {
      console.error(`Error setting document ${finalCollection}/${docId} in Firestore:`, err);
    }
  } else {
    const local = loadLocalDb();
    if (collectionName === "settings") {
      local.settings = local.settings || {};
      local.settings[docId] = data;
    } else {
      const localKey = isGlobalOwnerDoc ? "users" : finalCollection;
      const array = local[localKey] || [];
      const index = array.findIndex((item: any) => {
        if (collectionName === "users") {
          return item.username === docId;
        }
        return item.id === docId;
      });
      if (index > -1) {
        array[index] = { ...array[index], ...data };
      } else {
        array.push({ ...data, id: docId });
      }
      local[localKey] = array;
    }
    saveLocalDb();
  }
}

async function deleteDocumentData(collectionName: string, docId: string): Promise<void> {
  const isGlobalLicenseDoc = collectionName === "settings" && docId === "license";
  const isGlobalOwnerDoc = collectionName === "users" && docId === "genesys_owner";
  const finalCollection = isGlobalLicenseDoc ? "settings" : (isGlobalOwnerDoc ? "users" : getCollectionNameForTenant(collectionName));
  if (useFirestore && db) {
    try {
      const docRef = db.collection(finalCollection).doc(docId);
      await docRef.delete();
    } catch (err) {
      console.error(`Error deleting document ${finalCollection}/${docId} from Firestore:`, err);
    }
  } else {
    const local = loadLocalDb();
    if (collectionName === "settings") {
      if (local.settings) {
        delete local.settings[docId];
      }
    } else {
      const localKey = isGlobalOwnerDoc ? "users" : finalCollection;
      const array = local[localKey] || [];
      const filtered = array.filter((item: any) => {
        if (collectionName === "users") {
          return item.username !== docId;
        }
        return item.id !== docId;
      });
      local[localKey] = filtered;
    }
    saveLocalDb();
  }
}

async function getDocumentData(collectionName: string, docId: string): Promise<any | null> {
  const isGlobalLicenseDoc = collectionName === "settings" && docId === "license";
  const isGlobalOwnerDoc = collectionName === "users" && docId === "genesys_owner";
  const finalCollection = isGlobalLicenseDoc ? "settings" : (isGlobalOwnerDoc ? "users" : getCollectionNameForTenant(collectionName));
  if (useFirestore && db) {
    try {
      const docRef = db.collection(finalCollection).doc(docId);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        return snapshot.data();
      }
    } catch (err) {
      console.error(`Error retrieving document ${finalCollection}/${docId} from Firestore:`, err);
    }
    return null;
  } else {
    const local = loadLocalDb();
    if (collectionName === "settings") {
      return local.settings?.[docId] || null;
    } else {
      const localKey = isGlobalOwnerDoc ? "users" : finalCollection;
      const array = local[localKey] || [];
      const item = array.find((x: any) => {
        if (collectionName === "users") {
          return x.username === docId;
        }
        return x.id === docId;
      });
      return item || null;
    }
  }
}

async function getConfig() {
  const data = await getDocumentData("settings", "config");
  return data || { businessName: "" };
}

async function setConfig(config: any) {
  await setDocumentData("settings", "config", config);
}

// Password utility to hash plaintext with SHA-256 for optimal security & compatibility
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "genesys-salt-2026").digest("hex");
}

function isHashed(password: string): boolean {
  return /^[a-f0-9]{64}$/i.test(password);
}

// Initial seeding and database auto-installer logic
async function initializeDatabase() {
  try {
    const ownerDoc = await getDocumentData("users", "genesys_owner");
    if (!ownerDoc) {
      console.log("[Init] Seeding genesys_owner to Firestore...");
      const hashedPassword = hashPassword("genesys_password_2026");
      await setDocumentData("users", "genesys_owner", {
        username: "genesys_owner",
        password: hashedPassword,
        role: "admin",
        fullName: "Genesys Owner",
        permissions: DEFAULT_PERMISSIONS.admin
      });
      console.log("[Init] genesys_owner seeded successfully.");
    }
    
    // Check if configuration exists
    const configDoc = await getDocumentData("settings", "config");
    if (!configDoc) {
      await setDocumentData("settings", "config", { businessName: "" });
    }
  } catch (error) {
    console.error("[Init] Error seeding database:", error);
  }
}

async function migrateJsonToFirestore() {
  if (!useFirestore) return; // Skip migration in local offline mode
  const migrationIndicator = path.join(process.cwd(), ".migrated_to_firestore");
  if (fs.existsSync(migrationIndicator)) {
    return;
  }
  
  try {
    if (fs.existsSync(DATA_FILE)) {
      console.log("[Migration] Found existing local data.json. Starting automated migration to Firestore...");
      const localData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      
      // Migrate License
      if (localData.license) {
        saveLocalLicense(localData.license);
        await setDocumentData("settings", "license", localData.license);
        console.log("- Migrated license");
      }
      
      // Migrate Config
      if (localData.config) {
        await setDocumentData("settings", "config", localData.config);
        console.log("- Migrated config");
      }
      
      // Migrate Users
      if (Array.isArray(localData.users)) {
        for (const user of localData.users) {
          if (user.username) {
            await setDocumentData("users", user.username, user);
          }
        }
        console.log(`- Migrated ${localData.users.length} users`);
      }
      
      // Migrate Products
      if (Array.isArray(localData.products)) {
        for (const product of localData.products) {
          if (product.id) {
            await setDocumentData("products", product.id, product);
          }
        }
        console.log(`- Migrated ${localData.products.length} products`);
      }
      
      // Migrate Customers
      if (Array.isArray(localData.customers)) {
        for (const customer of localData.customers) {
          if (customer.id) {
            await setDocumentData("customers", customer.id, customer);
          }
        }
        console.log(`- Migrated ${localData.customers.length} customers`);
      }
      
      // Migrate Sales
      if (Array.isArray(localData.sales)) {
        for (const sale of localData.sales) {
          if (sale.id) {
            await setDocumentData("sales", sale.id, sale);
          }
        }
        console.log(`- Migrated ${localData.sales.length} sales`);
      }
      
      // Migrate Payments
      if (Array.isArray(localData.payments)) {
        for (const payment of localData.payments) {
          if (payment.id) {
            await setDocumentData("payments", payment.id, payment);
          }
        }
        console.log(`- Migrated ${localData.payments.length} payments`);
      }
      
      // Migrate Returns
      if (Array.isArray(localData.returns)) {
        for (const ret of localData.returns) {
          if (ret.id) {
            await setDocumentData("returns", ret.id, ret);
          }
        }
        console.log(`- Migrated ${localData.returns.length} returns`);
      }

      console.log("[Migration] Automated Firestore migration complete!");
    }
  } catch (err) {
    console.error("[Migration] Error migrating to Firestore:", err);
  } finally {
    fs.writeFileSync(migrationIndicator, "completed at " + new Date().toISOString() + "\n");
  }
}

async function loadLicenseFromFirestore() {
  if (!useFirestore || !db) return;
  try {
    const docRef = db.collection("settings").doc("license");
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      const lic = snapshot.data();
      if (lic && lic.key) {
        console.log(`[License] Loaded active license from Firestore on startup: ${lic.key}`);
        saveLocalLicense(lic);
      }
    }
  } catch (err: any) {
    console.error(`[License] Error loading license from Firestore:`, err.message);
  }
}

// Run initial migration and seeding on server startup
(async () => {
  await loadLicenseFromFirestore();
  await attemptSelfHealFromRegistry();
  await migrateJsonToFirestore();
  await initializeDatabase();
})();

// License Verification Logic
function verifyLicense(key: string) {
  const parts = key.split("-");
  if (parts.length !== 4 || parts[0] !== "GENESYS") return null;
  const [_, type, random, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(`${type}-${random}`)
    .digest("hex")
    .substring(0, 8)
    .toUpperCase();
  
  if (sig !== expectedSig) return null;
  
  const daysMap: Record<string, number> = {
    TRIAL: 7,
    "3MONTH": 90,
    "6MONTH": 180,
    "1YEAR": 365,
    "2YEAR": 730,
    NEVER: 999999,
  };
  
  return { type, days: daysMap[type] };
}

// API Routes
const CENTRAL_SERVER_URL = process.env.CENTRAL_SERVER_URL || "https://ais-pre-a34tpkltsgfvav6qevdgu4-376793492753.europe-west2.run.app";

async function pingCentralLicenseServer() {
  try {
    const license = getLocalLicense();
    if (!license) return;
    const config = await getConfig();
    const users = await getCollectionData("users");
    const activeUsersCount = users.length;
    
    const domain = process.env.RENDER_EXTERNAL_URL || "Local Instance";

    const payload = {
      licenseKey: license.key,
      licenseType: license.type,
      activatedAt: license.activatedAt,
      expiresAt: license.expiresAt,
      businessName: config.businessName || "Unnamed Business",
      domain: domain,
      activeUsersCount: activeUsersCount,
      lastPingAt: new Date().toISOString()
    };

    const myUrl = process.env.RENDER_EXTERNAL_URL || "";
    const isCentral = myUrl.includes("ais-pre-a34tpkltsgfvav6qevdgu4") || 
                      myUrl.includes("ais-dev-a34tpkltsgfvav6qevdgu4") || 
                      (CENTRAL_SERVER_URL && CENTRAL_SERVER_URL.includes(myUrl));

    if (isCentral && useFirestore) {
      await setDocumentData("registered_customers", license.key, payload);
    } else {
      fetch(`${CENTRAL_SERVER_URL}/api/central/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch (err) {
    // Suppress background errors
  }
}

app.post("/api/license/activate", async (req, res) => {
  const { key } = req.body;
  const verified = verifyLicense(key);
  if (!verified) {
    return res.status(400).json({ error: "Invalid License Key" });
  }

  const existingLicense = getLocalLicense();
  if (existingLicense && existingLicense.key === key) {
    return res.status(400).json({ error: "System already activated" });
  }

  const expiryDate = verified.type === "NEVER" ? null : (() => {
    const d = new Date();
    d.setDate(d.getDate() + (verified.days || 0));
    return d;
  })();

  const license = {
    key,
    type: verified.type,
    activatedAt: new Date().toISOString(),
    expiresAt: expiryDate ? expiryDate.toISOString() : null,
  };
  saveLocalLicense(license);
  await setDocumentData("settings", "license", license);

  // Background report activation to central server
  pingCentralLicenseServer().catch(() => {});

  res.json({ success: true, license });
});

app.get("/api/license/status", async (req, res) => {
  const requestingUser = req.headers["x-user"] || tenantStorage.getStore()?.username;
  if (requestingUser === "genesys_owner") {
    return res.json({
      activated: true,
      license: {
        key: "GENESYS-NEVER-A1B2C3D4-A20572B1",
        type: "NEVER",
        activatedAt: "2026-07-16T21:35:10.718Z",
        expiresAt: null
      },
      isExpired: false
    });
  }

  let license = getLocalLicense();
  if (!license && useFirestore && db) {
    try {
      const docRef = db.collection("settings").doc("license");
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        license = snapshot.data();
        if (license && license.key) {
          saveLocalLicense(license);
        }
      }
    } catch (e: any) {
      console.error("Error retrieving license from Firestore in status endpoint:", e.message);
    }
  }
  if (!license) {
    return res.json({ activated: false });
  }
  const isExpired = license.expiresAt ? (new Date() > new Date(license.expiresAt)) : false;
  
  // Background reporting ping to keep central server updated
  pingCentralLicenseServer().catch(() => {});

  res.json({ activated: true, license, isExpired });
});

// App Config
app.get("/api/config", async (req, res) => {
  const config = await getConfig();
  res.json(config);
});

app.post("/api/config", async (req, res) => {
  const { businessName } = req.body;
  const config = { businessName };
  await setConfig(config);

  // Background update central server with the new business name
  pingCentralLicenseServer().catch(() => {});

  res.json(config);
});

// Central Tracking Endpoints for Owner Portal
app.post("/api/central/register", async (req, res) => {
  const { licenseKey, licenseType, activatedAt, expiresAt, businessName, domain, activeUsersCount, lastPingAt } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ error: "Missing license key" });
  }

  const payload = {
    licenseKey,
    licenseType,
    activatedAt,
    expiresAt,
    businessName: businessName || "Unnamed Business",
    domain: domain || "Local Instance",
    activeUsersCount: activeUsersCount || 0,
    lastPingAt: lastPingAt || new Date().toISOString()
  };

  await setDocumentData("registered_customers", licenseKey, payload);
  res.json({ success: true });
});

app.get("/api/central/registrations", async (req, res) => {
  const requestingUser = req.headers["x-user"];
  if (requestingUser !== "genesys_owner") {
    return res.status(403).json({ error: "Unauthorized: Owner only" });
  }
  const registrations = await getCollectionData("registered_customers");
  res.json(registrations);
});

// Auth
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await getDocumentData("users", username);
  if (!user) {
    return res.status(401).json({ error: "Invalid username. The username entered does not exist." });
  }

  // Compare input password string by hashing it
  const inputHashed = isHashed(password) ? password : hashPassword(password);
  if (user.password !== inputHashed) {
    return res.status(401).json({ error: "Incorrect password. Please verify your password and try again." });
  }

  // License check for non-owner users to prevent bypass
  if (username !== "genesys_owner") {
    let license = getLocalLicense();
    if (!license && useFirestore && db) {
      try {
        const docRef = db.collection("settings").doc("license");
        const snapshot = await docRef.get();
        if (snapshot.exists) {
          license = snapshot.data();
          if (license && license.key) {
            saveLocalLicense(license);
          }
        }
      } catch (e: any) {
        console.error("Error retrieving license from Firestore in login endpoint:", e.message);
      }
    }
    if (!license) {
      return res.status(403).json({ error: "System is not activated. Please activate your license to continue." });
    }
    const isExpired = license.expiresAt ? (new Date() > new Date(license.expiresAt)) : false;
    if (isExpired) {
      return res.status(403).json({ error: "Your license has expired. Please renew your license to continue." });
    }
  }

  const role: "admin" | "manager" | "user" = user.role || "user";
  const userPermissions = user.permissions || DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.user;

  res.json({ 
    user: { 
      username: user.username, 
      role: user.role, 
      fullName: user.fullName, 
      permissions: userPermissions 
    } 
  });
});

app.get("/api/users", async (req, res) => {
  const requestingUser = req.headers["x-user"];
  let allUsers = await getCollectionData("users");

  // If requested by owner, make sure owner themselves is present in list for visual completeness
  if (requestingUser === "genesys_owner") {
    const ownerDoc = await getDocumentData("users", "genesys_owner");
    if (ownerDoc && !allUsers.some((u: any) => u.username === "genesys_owner")) {
      allUsers = [ownerDoc, ...allUsers];
    }
  }

  let usersToReturn = allUsers;

  // Filter out owner if not requested by owner
  if (requestingUser !== "genesys_owner") {
    usersToReturn = usersToReturn.filter((u: any) => u.username !== "genesys_owner");
  }

  // Strip password field before sending user list to front-end for extra security
  const usersWithPerms = usersToReturn.map((u: any) => {
    const { password, ...uWithoutPwd } = u;
    return {
      ...uWithoutPwd,
      permissions: uWithoutPwd.permissions || DEFAULT_PERMISSIONS[uWithoutPwd.role as keyof typeof DEFAULT_PERMISSIONS] || DEFAULT_PERMISSIONS.user
    };
  });
  res.json(usersWithPerms);
});

app.post("/api/users", async (req, res) => {
  const { username, password, role, fullName, permissions } = req.body;
  const existingUser = await getDocumentData("users", username);
  if (existingUser) {
    return res.status(400).json({ error: "Username already exists" });
  }
  const userPermissions = permissions || DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] || DEFAULT_PERMISSIONS.user;
  
  // Store newly created credentials as secure SHA-256 hashes
  const hashedPassword = isHashed(password) ? password : hashPassword(password);
  await setDocumentData("users", username, { username, password: hashedPassword, role, fullName, permissions: userPermissions });
  res.json({ success: true });
});

app.put("/api/users/:username", async (req, res) => {
  const { username } = req.params;
  const { password, role, fullName, permissions } = req.body;
  const requestingUser = req.headers["x-user"];

  const user = await getDocumentData("users", username);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Protect owner account
  if (username === "genesys_owner" && requestingUser !== "genesys_owner") {
    return res.status(403).json({ error: "Unauthorized: only the owner can modify this account" });
  }

  if (username === "genesys_owner" && role && role !== "admin") {
    return res.status(400).json({ error: "Cannot change owner role" });
  }

  if (password) {
    user.password = isHashed(password) ? password : hashPassword(password);
  }
  if (role) user.role = role;
  if (fullName) user.fullName = fullName;
  if (permissions) user.permissions = permissions;

  await setDocumentData("users", username, user);
  res.json({ success: true });
});

app.delete("/api/users/:username", async (req, res) => {
  const { username } = req.params;
  const requestingUser = req.headers["x-user"];

  if (username === "genesys_owner") {
    return res.status(400).json({ error: "Cannot delete owner account" });
  }
  
  if (requestingUser !== "genesys_owner" && username === "genesys_owner") {
     return res.status(403).json({ error: "Unauthorized" });
  }

  await deleteDocumentData("users", username);
  res.json({ success: true });
});

// Products
app.get("/api/products", async (req, res) => {
  const products = await getCollectionData("products");
  res.json(products);
});

app.post("/api/products", async (req, res) => {
  const product = req.body;
  product.id = crypto.randomUUID();
  // Ensure default values for new structure
  if (product.shopStock === undefined || product.shopStock === "") {
    product.shopStock = 0;
  } else {
    product.shopStock = Number(product.shopStock);
  }
  if (product.warehouseStock === undefined || product.warehouseStock === "") {
    product.warehouseStock = 0;
  } else {
    product.warehouseStock = Number(product.warehouseStock);
  }
  product.warehouseLooseStock = Number(product.warehouseLooseStock) || 0;
  if (product.price === undefined || product.price === "") {
    product.price = 0;
  } else {
    product.price = Number(product.price);
  }
  if (product.bulkUnitSize === undefined || product.bulkUnitSize === "") {
    product.bulkUnitSize = 1;
  } else {
    product.bulkUnitSize = Number(product.bulkUnitSize);
  }
  if (product.bulkUnitName === undefined) product.bulkUnitName = "Item";
  
  if (product.hasShopInventory === undefined) product.hasShopInventory = true;
  if (product.hasWarehouseInventory === undefined) product.hasWarehouseInventory = true;
  
  await setDocumentData("products", product.id, product);
  res.json(product);
});

app.post("/api/inventory/transfer", async (req, res) => {
  const { productId, quantity, isBulk } = req.body;
  const p = await getDocumentData("products", productId);
  if (!p) return res.status(404).json({ error: "Product not found" });

  const transferQuantity = isBulk ? quantity * (p.bulkUnitSize || 1) : quantity;

  const bulkSize = Number(p.bulkUnitSize) || 1;
  const currentBoxes = Number(p.warehouseStock) || 0;
  const currentLoose = Number(p.warehouseLooseStock) || 0;
  const totalSinglesInWarehouse = (currentBoxes * bulkSize) + currentLoose;

  if (totalSinglesInWarehouse < transferQuantity) {
    return res.status(400).json({ error: "Insufficient warehouse stock" });
  }

  // Find a matching product in the Shop inventory (excluding itself)
  const skuMatch = p.sku ? p.sku.trim().toLowerCase() : null;
  const nameMatch = p.name ? p.name.trim().toLowerCase() : null;

  const allProducts = await getCollectionData("products");
  const matchingShopProduct = allProducts.find((prod: any) => {
    if (prod.id === p.id) return false;
    if (!prod.hasShopInventory) return false;
    if (skuMatch && prod.sku && prod.sku.trim().toLowerCase() === skuMatch) {
      return true;
    }
    if (nameMatch && prod.name && prod.name.trim().toLowerCase() === nameMatch) {
      return true;
    }
    return false;
  });

  // Calculate new warehouse quantities
  const remainingSingles = totalSinglesInWarehouse - transferQuantity;
  p.warehouseStock = Math.floor(remainingSingles / bulkSize);
  p.warehouseLooseStock = remainingSingles % bulkSize;

  // If the product itself has shop inventory, we transfer directly to its own shop stock
  if (p.hasShopInventory) {
    p.shopStock = (p.shopStock || 0) + transferQuantity;
    await setDocumentData("products", p.id, p);
  } else if (matchingShopProduct) {
    // Save updated original product (warehouse) and the matching shop product
    await setDocumentData("products", p.id, p);
    matchingShopProduct.shopStock = (matchingShopProduct.shopStock || 0) + transferQuantity;
    await setDocumentData("products", matchingShopProduct.id, matchingShopProduct);
  } else {
    // Save updated original product and create a separate new shop product
    await setDocumentData("products", p.id, p);
    const newShopProduct = {
      id: crypto.randomUUID(),
      name: p.name,
      sku: p.sku || "",
      price: p.price || 0,
      category: p.category || "Safety Vests",
      description: p.description || "",
      bulkUnitSize: p.bulkUnitSize || 1,
      bulkUnitName: p.bulkUnitName || "Item",
      shopStock: transferQuantity,
      warehouseStock: 0,
      warehouseLooseStock: 0,
      hasShopInventory: true,
      hasWarehouseInventory: false
    };
    await setDocumentData("products", newShopProduct.id, newShopProduct);
  }

  res.json({ success: true, product: p });
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const updated = req.body;
  const original = await getDocumentData("products", id);
  if (!original) return res.status(404).json({ error: "Not found" });
  
  const merged = { ...original, ...updated };
  
  if (merged.price !== undefined && merged.price !== "") merged.price = Number(merged.price);
  if (merged.shopStock !== undefined && merged.shopStock !== "") merged.shopStock = Number(merged.shopStock);
  if (merged.warehouseStock !== undefined && merged.warehouseStock !== "") merged.warehouseStock = Number(merged.warehouseStock);
  if (merged.warehouseLooseStock !== undefined && merged.warehouseLooseStock !== "") merged.warehouseLooseStock = Number(merged.warehouseLooseStock);
  if (merged.bulkUnitSize !== undefined && merged.bulkUnitSize !== "") merged.bulkUnitSize = Number(merged.bulkUnitSize);

  await setDocumentData("products", id, merged);
  res.json(merged);
});

app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  await deleteDocumentData("products", id);
  res.json({ success: true });
});

// Customers
app.get("/api/customers", async (req, res) => {
  const customers = await getCollectionData("customers");
  res.json(customers);
});

app.post("/api/customers", async (req, res) => {
  const customer = req.body;
  customer.id = crypto.randomUUID();
  customer.balance = 0;
  await setDocumentData("customers", customer.id, customer);
  res.json(customer);
});

// Sales
app.get("/api/sales", async (req, res) => {
  const sales = await getCollectionData("sales");
  res.json(sales);
});

app.post("/api/sales", async (req, res) => {
  try {
    const { items, customerId, customerName, total, paymentType, amountPaid, discount } = req.body;
    const discountAmount = Number(discount) || 0;
    const numericTotal = Number(total) || 0;
    const finalTotal = Math.max(0, numericTotal - discountAmount);
    const numericAmountPaid = Number(amountPaid) || 0;

    let resolvedCustomerName = customerName;
    if (customerId && !resolvedCustomerName) {
      const cust = await getDocumentData("customers", customerId);
      resolvedCustomerName = cust ? cust.name : "Walk-in";
    }
    if (!resolvedCustomerName) resolvedCustomerName = "Walk-in";

    const sale = {
      id: crypto.randomUUID(),
      items: items || [],
      customerId: customerId || "",
      customerName: resolvedCustomerName,
      total: numericTotal,
      discount: discountAmount,
      paymentType,
      amountPaid: numericAmountPaid,
      date: new Date().toISOString(),
    };
    
    await setDocumentData("sales", sale.id, sale);

    // Update product stock
    if (Array.isArray(items)) {
      for (const item of items) {
        const p = await getDocumentData("products", item.id);
        if (p) {
          if (p.shopStock !== undefined) {
            p.shopStock -= Number(item.quantity) || 0;
          } else {
            p.stock = (p.stock || 0) - (Number(item.quantity) || 0);
          }
          await setDocumentData("products", p.id, p);
        }
      }
    }

    // Update customer balance if credit
    if (paymentType === "credit" || numericAmountPaid < finalTotal) {
      if (customerId) {
        const cust = await getDocumentData("customers", customerId);
        if (cust) {
          const debt = finalTotal - numericAmountPaid;
          cust.balance = Number(cust.balance || 0) + debt;
          await setDocumentData("customers", customerId, cust);
          
          const payId = crypto.randomUUID();
          await setDocumentData("payments", payId, {
            id: payId,
            customerId,
            amount: numericAmountPaid,
            type: "sale_payment",
            date: new Date().toISOString(),
            saleId: sale.id,
          });
        }
      }
    } else {
      const payId = crypto.randomUUID();
      await setDocumentData("payments", payId, {
        id: payId,
        customerId: customerId || "",
        amount: numericAmountPaid,
        type: "full_payment",
        date: new Date().toISOString(),
        saleId: sale.id,
      });
    }

    res.json(sale);
  } catch (err: any) {
    console.error("Error creating sale:", err);
    res.status(500).json({ error: err.message || "Failed to process sale" });
  }
});

// Returns
app.get("/api/returns", async (req, res) => {
  try {
    const returns = await getCollectionData("returns");
    res.json(returns);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch returns" });
  }
});

app.post("/api/returns", async (req, res) => {
  try {
    const { saleId, items } = req.body;
    const sale = await getDocumentData("sales", saleId);
    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    let returnTotal = 0;
    const returnedItemsList: any[] = [];

    for (const retItem of items) {
      const saleItem = sale.items.find((si: any) => si.id === retItem.id);
      if (saleItem) {
        const qtyReturned = Number(retItem.quantity) || 0;
        if (qtyReturned <= 0) continue;

        const alreadyReturned = saleItem.returnedQuantity || 0;
        const maxReturnable = saleItem.quantity - alreadyReturned;
        const finalQtyToReturn = Math.min(qtyReturned, maxReturnable);

        if (finalQtyToReturn > 0) {
          saleItem.returnedQuantity = alreadyReturned + finalQtyToReturn;
          const val = finalQtyToReturn * saleItem.price;
          returnTotal += val;

          returnedItemsList.push({
            id: saleItem.id,
            name: saleItem.name,
            quantity: finalQtyToReturn,
            price: saleItem.price,
          });

          // Restock product
          const p = await getDocumentData("products", saleItem.id);
          if (p) {
            if (p.shopStock !== undefined) {
              p.shopStock += finalQtyToReturn;
            } else {
              p.stock = (p.stock || 0) + finalQtyToReturn;
            }
            await setDocumentData("products", p.id, p);
          }
        }
      }
    }

    if (returnedItemsList.length === 0) {
      return res.status(400).json({ error: "No valid items to return" });
    }

    // Create return record
    const returnRecord = {
      id: crypto.randomUUID(),
      saleId,
      customerId: sale.customerId,
      customerName: sale.customerName,
      date: new Date().toISOString(),
      items: returnedItemsList,
      totalAmount: returnTotal,
      paymentType: sale.paymentType,
    };

    await setDocumentData("returns", returnRecord.id, returnRecord);

    // Adjust original sale total and paid amount
    sale.returnedAmount = (sale.returnedAmount || 0) + returnTotal;
    sale.total = Math.max(0, sale.total - returnTotal);
    
    if (sale.paymentType === "credit") {
      if (sale.customerId) {
        const cust = await getDocumentData("customers", sale.customerId);
        if (cust) {
          cust.balance = Math.max(0, cust.balance - returnTotal);
          await setDocumentData("customers", sale.customerId, cust);
        }
      }
      if (sale.amountPaid > sale.total) {
        sale.amountPaid = sale.total;
      }
    } else {
      sale.amountPaid = Math.max(0, sale.amountPaid - returnTotal);
    }

    await setDocumentData("sales", sale.id, sale);
    res.json({ success: true, returnRecord, sale });
  } catch (err: any) {
    console.error("Error creating return:", err);
    res.status(500).json({ error: err.message || "Failed to process return" });
  }
});

// Payments
app.get("/api/payments/:customerId", async (req, res) => {
  const { customerId } = req.params;
  
  try {
    // Fetch all related collections for the tenant
    const allSales = await getCollectionData("sales");
    const allPayments = await getCollectionData("payments");
    const allReturns = await getCollectionData("returns");
    
    // Filter transactions specifically belonging to this customer
    const customerSales = allSales.filter((s: any) => s.customerId === customerId);
    const customerPayments = allPayments.filter((p: any) => p.customerId === customerId);
    const customerReturns = allReturns.filter((r: any) => r.customerId === customerId);
    
    const ledger: any[] = [];
    
    // 1. Credit Sales (Incurred Debt)
    customerSales.forEach((s: any) => {
      if (s.paymentType === "credit" || s.amountPaid < s.total) {
        // Compute original total of the sale before returns were applied (so we can log the returns cleanly)
        const originalTotal = Number(s.total || 0) + Number(s.returnedAmount || 0);
        
        ledger.push({
          id: `sale_${s.id}`,
          date: s.date,
          type: "credit_purchase",
          description: `Invoice #${s.id.slice(0, 8).toUpperCase()} (Credit Purchase)`,
          amount: originalTotal,
          isDebt: true,
          referenceId: s.id,
        });
      }
    });
    
    // 2. Payments (Payments made towards debt)
    customerPayments.forEach((p: any) => {
      // Down payments and manual pay downs count towards reducing debt
      if (p.type === "sale_payment" || p.type === "manual_payment") {
        let desc = "Manual Payment Received";
        if (p.type === "sale_payment" && p.saleId) {
          desc = `Down Payment (Invoice #${p.saleId.slice(0, 8).toUpperCase()})`;
        }
        
        ledger.push({
          id: p.id,
          date: p.date,
          type: p.type,
          description: desc,
          amount: Number(p.amount || 0),
          isDebt: false,
          referenceId: p.saleId || null,
        });
      }
    });
    
    // 3. Returns (Credited back / Reduces debt)
    customerReturns.forEach((r: any) => {
      if (r.paymentType === "credit") {
        ledger.push({
          id: `return_${r.id}`,
          date: r.date,
          type: "goods_return",
          description: `Returned Goods Credited (Invoice #${r.saleId.slice(0, 8).toUpperCase()})`,
          amount: Number(r.totalAmount || 0),
          isDebt: false,
          referenceId: r.saleId,
        });
      }
    });
    
    // Sort all transactions chronologically from oldest to newest
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Compute running balance step-by-step
    let runningBalance = 0;
    const ledgerWithBalance = ledger.map((entry) => {
      if (entry.isDebt) {
        runningBalance += entry.amount;
      } else {
        runningBalance = Math.max(0, runningBalance - entry.amount);
      }
      return {
        ...entry,
        remainingBalance: runningBalance,
      };
    });
    
    // Return latest transactions first for clean presentation in the UI
    res.json(ledgerWithBalance.reverse());
  } catch (err: any) {
    console.error("Error building customer ledger statement:", err);
    res.status(500).json({ error: "Failed to construct customer statement" });
  }
});

app.post("/api/payments", async (req, res) => {
  const { customerId, amount } = req.body;
  const cust = await getDocumentData("customers", customerId);
  if (cust) {
    cust.balance -= amount;
    const payment = {
      id: crypto.randomUUID(),
      customerId,
      amount,
      type: "manual_payment",
      date: new Date().toISOString(),
    };
    await setDocumentData("payments", payment.id, payment);
    await setDocumentData("customers", customerId, cust);
    res.json(payment);
  } else {
    res.status(404).json({ error: "Customer not found" });
  }
});

// Import/Export
app.get("/api/admin/export", async (req, res) => {
  const data = {
    license: getLocalLicense(),
    config: await getConfig(),
    users: await getCollectionData("users"),
    products: await getCollectionData("products"),
    customers: await getCollectionData("customers"),
    sales: await getCollectionData("sales"),
    payments: await getCollectionData("payments"),
    returns: await getCollectionData("returns"),
  };
  res.json(data);
});

app.post("/api/admin/import", async (req, res) => {
  const newData = req.body;
  try {
    if (newData.license) {
      saveLocalLicense(newData.license);
      await setDocumentData("settings", "license", newData.license);
    }
    if (newData.config) {
      await setDocumentData("settings", "config", newData.config);
    }
    if (Array.isArray(newData.users)) {
      for (const user of newData.users) {
        if (user.username) {
          if (user.password && !isHashed(user.password)) {
            user.password = hashPassword(user.password);
          }
          await setDocumentData("users", user.username, user);
        }
      }
    }
    if (Array.isArray(newData.products)) {
      for (const product of newData.products) {
        if (product.id) await setDocumentData("products", product.id, product);
      }
    }
    if (Array.isArray(newData.customers)) {
      for (const customer of newData.customers) {
        if (customer.id) await setDocumentData("customers", customer.id, customer);
      }
    }
    if (Array.isArray(newData.sales)) {
      for (const sale of newData.sales) {
        if (sale.id) await setDocumentData("sales", sale.id, sale);
      }
    }
    if (Array.isArray(newData.payments)) {
      for (const payment of newData.payments) {
        if (payment.id) await setDocumentData("payments", payment.id, payment);
      }
    }
    if (Array.isArray(newData.returns)) {
      for (const ret of newData.returns) {
        if (ret.id) await setDocumentData("returns", ret.id, ret);
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to import database" });
  }
});

// License Generator Route
app.post("/api/admin/generate-key", (req, res) => {
  const { type, password } = req.body;
  if (password !== "genesys_admin_key_gen_2026") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  const sig = crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(`${type}-${random}`)
    .digest("hex")
    .substring(0, 8)
    .toUpperCase();
  const key = `GENESYS-${type}-${random}-${sig}`;
  res.json({ key });
});

// Vite middleware
async function startServer() {
  const isDev = !((process as any).pkg) && (
    _filename.endsWith(".ts") ||
    process.argv.some(arg => arg.endsWith("server.ts"))
  );

  if (isDev) {
    // Hide vite from pkg/bundlers using a dynamic import with a variable string
    const viteMod = "vite";
    // @ts-ignore
    const { createServer: createViteServer } = await import(viteMod);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve from the same directory as the script or robustly find 'dist'
    let distPath = path.resolve(_dirname);
    if (!fs.existsSync(path.join(distPath, "index.html")) && fs.existsSync(path.join(distPath, "dist", "index.html"))) {
      distPath = path.join(distPath, "dist");
    }
    
    console.log("Genesys POS - Production Mode");
    console.log("Snapshot Root:", _dirname);
    console.log("Serving from:", distPath);

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.sendFile(indexPath);
      } else {
        // Fallback: search assets in snapshot
        const altPath = path.join(_dirname, "index.html");
        if (fs.existsSync(altPath)) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
          res.sendFile(altPath);
        } else {
          res.status(404).send(`Application Error: Required files not found in snapshot. Please contact support. (Path: ${indexPath})`);
        }
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
