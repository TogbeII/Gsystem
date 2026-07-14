import { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  LogOut, 
  CreditCard, 
  History, 
  Plus, 
  Search,
  Download,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Menu,
  X,
  UserPlus,
  ArrowLeftRight,
  Warehouse,
  FileText,
  Check,
  Edit,
  Printer,
  Trash,
  Trash2,
  Undo2,
  Calendar,
  RotateCcw,
  Lock,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportToPDF, exportToExcel } from "./lib/exportUtils";
import { User, License, Product, Customer, Sale, UserPermissions } from "./types";
import { cn, formatCurrency, formatDate, formatCurrencyPDF } from "./lib/utils";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
        : "hover:bg-blue-50 text-slate-600"
    )}
  >
    <Icon className={cn("shrink-0", active ? "text-white" : "group-hover:text-blue-600")} size={20} />
    {!collapsed && <span className="font-medium">{label}</span>}
  </button>
);

const Tile = ({ icon: Icon, label, color, onClick, value, sublabel }: any) => (
  <button
    onClick={onClick}
    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left group w-full flex flex-col justify-between overflow-hidden cursor-pointer"
  >
    <div className="w-full min-w-0">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", color)}>
        <Icon className="text-white" size={24} />
      </div>
      <div className="space-y-1 min-w-0 w-full overflow-hidden">
        <h3 className="text-slate-500 text-xs sm:text-sm font-semibold tracking-tight truncate uppercase" title={label}>{label}</h3>
        <p className="text-xl sm:text-2xl md:text-2xl xl:text-lg 2xl:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate" title={String(value)}>
          {value}
        </p>
        {sublabel && <p className="text-[10px] sm:text-xs text-slate-400 truncate" title={sublabel}>{sublabel}</p>}
      </div>
    </div>
  </button>
);

let activeUsername: string | null = null;

const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (activeUsername && !headers.has("X-User")) {
    headers.set("X-User", activeUsername);
  }
  return window.fetch(input, { ...init, headers });
};

// --- Views ---

export default function App() {
  const [step, setStep] = useState<"LOADING" | "LICENSE" | "BUSINESS_SETUP" | "ADMIN_SETUP" | "LOGIN" | "APP">("LOADING");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [config, setConfig] = useState<{ businessName: string }>({ businessName: "" });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showLicenseReminder, setShowLicenseReminder] = useState(false);

  // Sync component state user to the module-level variable for custom fetch
  useEffect(() => {
    activeUsername = user?.username || null;
  }, [user]);

  // App State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<any[]>([]);

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    try {
      const res = await fetch("/api/license/status");
      const data = await res.json();
      setLicense(data.license);

      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      setConfig(configData);

      // Support special direct owner path
      const isManager = window.location.pathname === "/manager" || window.location.pathname === "/manager/";
      if (isManager) {
        setStep("LOGIN");
        return;
      }

      if (!data.activated || data.isExpired) {
        setStep("LICENSE");
        return;
      }

      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();
      // If no admin exists (owner is filtered out on server)
      if (usersData.length === 0) { 
        setStep("ADMIN_SETUP");
        return;
      }

      setStep("LOGIN");
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    const [p, c, s, r] = await Promise.all([
      fetch("/api/products").then(res => res.json()),
      fetch("/api/customers").then(res => res.json()),
      fetch("/api/sales").then(res => res.json()),
      fetch("/api/returns").then(res => res.json()).catch(() => []),
    ]);
    setProducts(p);
    setCustomers(c);
    setSales(s);
    setReturns(r || []);
  };

  useEffect(() => {
    if (step === "APP") {
      fetchData();
      checkLicenseExpiry();
    }
  }, [step]);

  const checkLicenseExpiry = () => {
    if (!license?.expiresAt) return;
    const expiry = new Date(license.expiresAt).getTime();
    const now = new Date().getTime();
    const daysLeft = (expiry - now) / (1000 * 60 * 60 * 24);
    
    // Show reminder if less than 7 days left
    if (daysLeft > 0 && daysLeft <= 7) {
      setShowLicenseReminder(true);
    }
  };

  // --- Auth & Setup Handlers ---

  const handleActivate = async (key: string) => {
    const res = await fetch("/api/license/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (data.success) {
      setLicense(data.license);
      setStep("BUSINESS_SETUP");
    } else {
      alert(data.error);
    }
  };

  const handleBusinessSetup = async (name: string) => {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: name }),
    });
    if (res.ok) {
      setConfig({ businessName: name });
      setStep("ADMIN_SETUP");
    }
  };

  const handleAdminSetup = async (userData: any) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...userData, role: "admin" }),
    });
    if (res.ok) {
      setStep("LOGIN");
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleLogin = async (credentials: any) => {
    setLoginError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setStep("APP");
    } else {
      setLoginError(data.error || "Wrong credentials entered");
      alert(data.error || "Wrong credentials entered");
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setStep("LOGIN");
    setActiveTab("dashboard");
  };

  // --- Rendering Steps ---

  if (step === "LOADING") return <div className="h-screen flex items-center justify-center bg-slate-50 font-sans">
    <div className="text-center space-y-4">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-slate-500 animate-pulse font-medium">Initializing Genesys System...</p>
    </div>
  </div>;

  if (step === "LICENSE" || step === "LOGIN") {
    return (
      <SystemGate
        initialMode={step}
        onLogin={handleLogin}
        onActivate={handleActivate}
        license={license}
        error={loginError}
        setError={setLoginError}
        onModeChange={(mode) => setStep(mode)}
      />
    );
  }

  if (step === "BUSINESS_SETUP") return <BusinessSetup onComplete={handleBusinessSetup} />;
  if (step === "ADMIN_SETUP") return <AdminSetup onComplete={handleAdminSetup} />;

  // Strict session check to prevent bypass
  if (!user) {
    return (
      <SystemGate
        initialMode="LOGIN"
        onLogin={handleLogin}
        onActivate={handleActivate}
        license={license}
        error={loginError}
        setError={setLoginError}
        onModeChange={(mode) => setStep(mode)}
      />
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col transition-all duration-300",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
              <span className="font-bold text-slate-800 text-lg tracking-tight truncate max-w-[160px]">
                {user?.username === "genesys_owner" ? "Genesys System" : config.businessName}
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto custom-scrollbar">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} collapsed={isSidebarCollapsed} />
          {user?.permissions?.inventory.view && (
            <>
              <SidebarItem icon={Package} label="Shop Inventory" active={activeTab === "shop_inventory"} onClick={() => setActiveTab("shop_inventory")} collapsed={isSidebarCollapsed} />
              <SidebarItem icon={Warehouse} label="Warehouse Stock" active={activeTab === "warehouse_inventory"} onClick={() => setActiveTab("warehouse_inventory")} collapsed={isSidebarCollapsed} />
            </>
          )}
          {user?.permissions?.sales.create && (
            <SidebarItem icon={ShoppingCart} label="POS (Sale)" active={activeTab === "pos"} onClick={() => setActiveTab("pos")} collapsed={isSidebarCollapsed} />
          )}
          {user?.permissions?.sales.history && (
            <SidebarItem icon={History} label="Sales History" active={activeTab === "sales"} onClick={() => setActiveTab("sales")} collapsed={isSidebarCollapsed} />
          )}
          {user?.permissions?.credit.view && (
            <SidebarItem icon={CreditCard} label="Credit/Debtors" active={activeTab === "credit"} onClick={() => setActiveTab("credit")} collapsed={isSidebarCollapsed} />
          )}
          {user?.permissions?.customers.view && (
            <SidebarItem icon={Users} label="Customers" active={activeTab === "customers"} onClick={() => setActiveTab("customers")} collapsed={isSidebarCollapsed} />
          )}
          {user?.permissions?.admin.view && (
            <SidebarItem icon={Settings} label="Admin Panel" active={activeTab === "admin"} onClick={() => setActiveTab("admin")} collapsed={isSidebarCollapsed} />
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          {!isSidebarCollapsed && (
            <div className="text-[10px] text-center text-slate-400 font-medium">
              <p>Powered by Genesys © 2026 Generic Systems</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{activeTab.replace('_', ' ')}</h2>
                {license?.type === "TRIAL" && (
                    <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter animate-pulse shadow-sm shadow-red-200">Trial Version</span>
                )}
            </div>
            
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 border-r border-slate-100 pr-6">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-800 leading-none">{user?.fullName}</p>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter mt-1">{user?.role}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        {user?.fullName?.charAt(0)}
                    </div>
                </div>

                <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-slate-400 hover:text-red-600 transition-colors py-2 px-1 rounded-lg group"
                    title="Sign Out"
                >
                    <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-wider">Sign Out</span>
                </button>
            </div>
        </header>

        {/* Main Content Area */}
        <main className={cn(
            "flex-1 relative scroll-smooth custom-scrollbar",
            activeTab === "pos" ? "overflow-hidden flex flex-col p-6" : "overflow-auto p-8"
        )}>
           <AnimatePresence mode="wait">
              {activeTab === "dashboard" && <DashboardView key="dash" products={products} customers={customers} sales={sales} onNavigate={setActiveTab} user={user} />}
              {activeTab === "shop_inventory" && user?.permissions?.inventory.view && <ShopInventoryView key="shop_inv" products={products} refresh={fetchData} userRole={user?.role} userPermissions={user?.permissions} />}
              {activeTab === "warehouse_inventory" && user?.permissions?.inventory.view && <WarehouseInventoryView key="wh_inv" products={products} refresh={fetchData} userRole={user?.role} userPermissions={user?.permissions} />}
              {activeTab === "pos" && user?.permissions?.sales.create && <POSView key="pos" products={products} customers={customers} refresh={fetchData} businessName={config.businessName} />}
              {activeTab === "sales" && user?.permissions?.sales.history && <SalesHistoryView key="sales" sales={sales} customers={customers} returns={returns} refresh={fetchData} userRole={user?.role} />}
              {activeTab === "credit" && user?.permissions?.credit.view && <CreditView key="cred" customers={customers} refresh={fetchData} userPermissions={user?.permissions} />}
              {activeTab === "customers" && user?.permissions?.customers.view && <CustomerView key="cust" customers={customers} refresh={fetchData} userPermissions={user?.permissions} />}
              {activeTab === "admin" && user?.permissions?.admin.view && <AdminView key="adm" user={user} refresh={fetchData} userRole={user?.role} userPermissions={user?.permissions} license={license} />}
           </AnimatePresence>

           {/* License Reminder Modal */}
           <AnimatePresence>
            {showLicenseReminder && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl mx-auto flex items-center justify-center">
                    <ShieldAlert size={40} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">License Expiring Soon!</h2>
                    <p className="text-slate-500">Your {license?.type} license will expire on <span className="font-bold text-red-500">{license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'N/A'}</span>. Please renew soon to avoid service interruption.</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowLicenseReminder(false)}
                      className="flex-1 p-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                    >
                      Remind Me Later
                    </button>
                    <button 
                      onClick={() => {
                        setShowLicenseReminder(false);
                        setStep("LICENSE");
                      }}
                      className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all font-sans"
                    >
                      Renew Now
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
           </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// --- Sub-Views (Simplified for MVP turn) ---

// --- Sub-Views (Unified Gate) ---

function SystemGate({ initialMode, onLogin, onActivate, license, error, setError, onModeChange }: any) {
  const isManager = window.location.pathname === "/manager" || window.location.pathname === "/manager/";
  const [mode, setMode] = useState<"LOGIN" | "LICENSE">(isManager ? "LOGIN" : (initialMode === "LICENSE" ? "LICENSE" : "LOGIN"));
  
  const [loginForm, setLoginForm] = useState({ 
    username: isManager ? "genesys_owner" : "", 
    password: "" 
  });
  const [activationKey, setActivationKey] = useState("");

  useEffect(() => {
    if (onModeChange) {
      onModeChange(mode);
    }
  }, [mode]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-[2.5rem] p-10 shadow-2xl border border-slate-100/50 space-y-8 relative z-10 transition-all duration-300">
        
        {/* Logo and Brand */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-extrabold shadow-xl shadow-blue-500/20">
            G
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Genesys System</h1>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Enterprise Management Portal</p>
          </div>
        </div>

        {/* Unified Mode Switcher */}
        {!isManager && (
          <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode("LOGIN");
                if (setError) setError(null);
              }}
              className={cn(
                "py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2",
                mode === "LOGIN" 
                  ? "bg-white text-slate-900 shadow-sm font-extrabold" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Lock size={13} />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("LICENSE");
                if (setError) setError(null);
              }}
              className={cn(
                "py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2",
                mode === "LICENSE" 
                  ? "bg-white text-slate-900 shadow-sm font-extrabold" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Key size={13} />
              Activate Key
            </button>
          </div>
        )}

        {isManager && (
          <div className="flex justify-center">
            <span className="px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-100">
              Developer/Owner Access Mode
            </span>
          </div>
        )}

        {/* Forms Container */}
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-pulse">
              <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {mode === "LOGIN" ? (
            /* Sign In Mode Form */
            <form onSubmit={(e) => { e.preventDefault(); onLogin(loginForm); }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Username</label>
                <input 
                  value={loginForm.username}
                  onChange={(e) => {
                    if (setError) setError(null);
                    setLoginForm({...loginForm, username: e.target.value});
                  }}
                  placeholder="Enter username"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Password</label>
                <input 
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => {
                    if (setError) setError(null);
                    setLoginForm({...loginForm, password: e.target.value});
                  }}
                  placeholder="••••••••••••"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium"
                  required
                  autoFocus
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white p-4.5 rounded-2xl font-bold text-sm hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-blue-500/25 mt-2"
              >
                Unlock Dashboard
              </button>

              {!isManager && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode("LICENSE")}
                    className="text-xs text-slate-400 font-semibold hover:text-blue-600 transition-all"
                  >
                    Need to activate/renew a license code? <span className="text-blue-500 underline font-bold">Activate here</span>
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* License Activation Mode Form */
            <form onSubmit={(e) => { e.preventDefault(); onActivate(activationKey); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 block text-center">
                  Your Activation Code
                </label>
                <input 
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  placeholder="GENESYS-XXXX-XXXX-XXXX"
                  className="w-full p-4.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-center font-mono text-sm uppercase tracking-widest font-extrabold"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-900 text-white p-4.5 rounded-2xl font-bold text-sm hover:bg-black hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-slate-900/25 mt-2"
              >
                Activate Now
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode("LOGIN")}
                  className="text-xs text-slate-400 font-semibold hover:text-blue-600 transition-all"
                >
                  Already registered your company? <span className="text-blue-500 underline font-bold">Sign In instead</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <span>v1.0.0</span>
          <span>© 2026 Generic Systems</span>
        </div>
      </div>
    </div>
  );
}

function BusinessSetup({ onComplete }: any) {
  const [name, setName] = useState("");
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-xl border border-slate-100 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Initial Setup</h1>
          <p className="text-slate-500">Provide your business details to continue.</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Business Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Safety Pro Ghana"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none"
            />
          </div>
          <button 
            onClick={() => onComplete(name)}
            disabled={!name}
            className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-black disabled:opacity-50 transition-all shadow-lg"
          >
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminSetup({ onComplete }: any) {
    const [form, setForm] = useState({ username: "", password: "", fullName: "" });
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-xl space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Create Admin Account</h1>
            <p className="text-slate-500">This will be your primary administrative user.</p>
          </div>
          <div className="space-y-4">
            <input 
              value={form.fullName}
              onChange={(e) => setForm({...form, fullName: e.target.value})}
              placeholder="Full Name"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none"
            />
            <input 
              value={form.username}
              onChange={(e) => setForm({...form, username: e.target.value})}
              placeholder="Username"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none"
            />
            <input 
              type="password"
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
              placeholder="Password"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none"
            />
            <button 
              onClick={() => onComplete(form)}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
            >
              Create Administrator
            </button>
          </div>
        </div>
      </div>
    );
}

// --- Main Views ---

function DashboardView({ products, customers, sales, onNavigate, user }: { products: Product[], customers: Customer[], sales: Sale[], onNavigate: (tab: string) => void, user: User | null, key?: string }) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const stats = {
        inventory: products.reduce((acc, p) => acc + (p.shopStock || 0), 0),
        debtors: customers.filter(c => c.balance > 0).length,
        totalSales: sales.filter(s => {
            const saleDate = new Date(s.date);
            return saleDate >= startOfToday && saleDate < startOfTomorrow;
        }).reduce((acc, s) => acc + s.total, 0),
        lowStock: products.filter(p => (p.shopStock || 0) < 10).length,
        lowWarehouseStock: products.filter(p => {
            if (p.hasWarehouseInventory === false) return false;
            const totalWhUnits = (p.warehouseStock || 0) * (p.bulkUnitSize || 1) + ((p as any).warehouseLooseStock || 0);
            return totalWhUnits < 200;
        }).length
    };

    const dataTrend = sales.slice(-10).map(s => ({
        name: formatDate(s.date).split(',')[0],
        total: s.total
    }));

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-500">Quick overview of your safety business</p>
                </div>
            </header>

            {/* Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <Tile 
                    icon={ShoppingCart} 
                    label="Today's Revenue" 
                    value={formatCurrency(stats.totalSales)} 
                    color="bg-green-500" 
                    sublabel="Today's total sales"
                    onClick={() => {
                        if (user?.permissions?.sales.history) {
                            onNavigate("sales");
                        } else {
                            alert("Access denied. You do not have permission to view Sales History.");
                        }
                    }}
                />
                <Tile 
                    icon={Package} 
                    label="Shop Stock" 
                    value={stats.inventory} 
                    color="bg-blue-500" 
                    onClick={() => {
                        if (user?.permissions?.inventory.view) {
                            onNavigate("shop_inventory");
                        } else {
                            alert("Access denied. You do not have permission to view Shop Inventory.");
                        }
                    }}
                />
                <Tile 
                    icon={CreditCard} 
                    label="Debtors" 
                    value={stats.debtors} 
                    color="bg-orange-500" 
                    sublabel="Customers owing" 
                    onClick={() => {
                        if (user?.permissions?.credit.view) {
                            onNavigate("credit");
                        } else {
                            alert("Access denied. You do not have permission to view Credit/Debtors.");
                        }
                    }}
                />
                <Tile 
                    icon={ShieldAlert} 
                    label="Low Shop Stock" 
                    value={stats.lowStock} 
                    color="bg-red-500" 
                    sublabel="Items under 10 units"
                    onClick={() => {
                        if (user?.permissions?.inventory.view) {
                            onNavigate("shop_inventory");
                        } else {
                            alert("Access denied. You do not have permission to view Shop Inventory.");
                        }
                    }}
                />
                <Tile 
                    icon={ShieldAlert} 
                    label="Low WH Stock" 
                    value={stats.lowWarehouseStock} 
                    color="bg-amber-500" 
                    sublabel="Items under 200 units"
                    onClick={() => {
                        if (user?.permissions?.inventory.view) {
                            onNavigate("warehouse_inventory");
                        } else {
                            alert("Access denied. You do not have permission to view Warehouse Inventory.");
                        }
                    }}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Sales Trend</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dataTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} dot={{ fill: '#2563eb', r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Top Product Categories</h3>
                    <div className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={products.slice(0, 5).map(p => ({ name: p.name, stock: p.shopStock || 0 }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} hide />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="stock" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function ShopInventoryView({ products, refresh, userRole, userPermissions }: { products: Product[], refresh: () => void | Promise<void>, userRole?: string, userPermissions?: UserPermissions, key?: string }) {
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
    const canDelete = userRole === "admin";
    const [form, setForm] = useState({ 
        name: "", category: products[0]?.category || "Safety Vests", price: "", 
        shopStock: "", warehouseStock: "", 
        bulkUnitSize: "1", bulkUnitName: "Item", 
        sku: "", description: "" 
    });

    const [isNewCategory, setIsNewCategory] = useState(false);
    const categories = Array.from(new Set(products.map(p => p.category))).sort();

    const filteredProducts = products.filter(p => 
        (p.hasShopInventory !== false) && (
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const handleExportPDF = () => {
        const headers = ["Item", "Category", "SKU", "Shop Stock", "Wh Stock", "Price"];
        const data = filteredProducts.map(p => {
            const matchingWhItem = products.find(prod => 
                prod.hasWarehouseInventory && 
                prod.id !== p.id && 
                (
                    (p.sku && prod.sku && p.sku.trim().toLowerCase() === prod.sku.trim().toLowerCase()) ||
                    (p.name && prod.name && p.name.trim().toLowerCase() === prod.name.trim().toLowerCase())
                )
            );
            const whStockVal = matchingWhItem 
                ? (matchingWhItem.warehouseStock * (matchingWhItem.bulkUnitSize || 1)) + ((matchingWhItem as any).warehouseLooseStock || 0)
                : (p.warehouseStock * (p.bulkUnitSize || 1)) + ((p as any).warehouseLooseStock || 0);

            return [
                p.name, p.category, p.sku, 
                (p.shopStock || 0).toString(), 
                whStockVal.toString(), 
                formatCurrencyPDF(p.price)
            ];
        });
        exportToPDF("Shop Inventory Report", headers, data, "shop_inventory_report");
    };

    const handleExportExcel = () => {
        exportToExcel(filteredProducts, "shop_inventory_report");
    };

    const handleAdd = async () => {
        const method = editingProduct ? "PUT" : "POST";
        const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
        
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                ...form, 
                price: Number(form.price), 
                shopStock: Number(form.shopStock),
                warehouseStock: Number(form.warehouseStock),
                bulkUnitSize: Number(form.bulkUnitSize),
                hasShopInventory: true,
                hasWarehouseInventory: editingProduct ? (editingProduct.hasWarehouseInventory ?? false) : false
            }),
        });
        if (res.ok) {
            setShowModal(false);
            setEditingProduct(null);
            refresh();
            setForm({ 
                name: "", category: "Safety Vests", price: "", 
                shopStock: "", warehouseStock: "", 
                bulkUnitSize: "1", bulkUnitName: "Item", 
                sku: "", description: "" 
            });
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Shop Inventory</h1>
                    <p className="text-slate-500">Stock available for immediate sale at the shop</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportPDF} title="Download PDF" className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
                        <Download size={20} />
                    </button>
                    <button onClick={handleExportExcel} title="Download Excel" className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
                        <FileText size={20} />
                    </button>
                    {userPermissions?.inventory.create && (
                        <button 
                          onClick={() => setShowModal(true)}
                          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                         >
                            <Plus size={20} /> Add Product
                        </button>
                    )}
                </div>
            </header>

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by name, SKU or category..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all font-medium" 
                    />
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-[850px]">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest pl-8">Item</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Category</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Shop Stock</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Wh Stock</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Price</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right pr-8">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredProducts.map(p => {
                                const stock = (p.shopStock !== undefined ? p.shopStock : (p as any).stock) || 0;
                                const matchingWhItem = products.find(prod => 
                                    prod.hasWarehouseInventory && 
                                    prod.id !== p.id && 
                                    (
                                        (p.sku && prod.sku && p.sku.trim().toLowerCase() === prod.sku.trim().toLowerCase()) ||
                                        (p.name && prod.name && p.name.trim().toLowerCase() === prod.name.trim().toLowerCase())
                                    )
                                );
                                const whStockVal = matchingWhItem 
                                    ? (matchingWhItem.warehouseStock * (matchingWhItem.bulkUnitSize || 1)) + ((matchingWhItem as any).warehouseLooseStock || 0)
                                    : (p.warehouseStock * (p.bulkUnitSize || 1)) + ((p as any).warehouseLooseStock || 0);
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 pl-8">
                                            <div className="font-bold text-slate-800">{p.name}</div>
                                            <div className="text-xs text-slate-400">{p.description}</div>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="text-[10px] text-slate-400 font-mono">{p.sku || "No SKU"}</span>
                                                {matchingWhItem && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                                        🔗 Mapped to Warehouse ({whStockVal} pcs)
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">{p.category}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={cn(
                                                "font-bold px-3 py-1 rounded-lg",
                                                stock < 10 ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"
                                            )}>{stock}</span>
                                        </td>
                                        <td className="p-4 text-center font-bold text-slate-500">
                                            {whStockVal}
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(p.price)}</td>
                                        <td className="p-4 text-right pr-8">
                                            <div className="flex justify-end gap-2">
                                                {userRole === "admin" && (
                                                    <button 
                                                        onClick={() => {
                                                            setEditingProduct(p);
                                                            setForm({ 
                                                                name: p.name, 
                                                                category: p.category, 
                                                                price: p.price.toString(), 
                                                                shopStock: stock.toString(), 
                                                                warehouseStock: (p.warehouseStock || 0).toString(),
                                                                bulkUnitSize: (p.bulkUnitSize || 1).toString(),
                                                                bulkUnitName: p.bulkUnitName || "Item",
                                                                sku: p.sku, 
                                                                description: p.description 
                                                            });
                                                            setShowModal(true);
                                                        }} 
                                                        className="w-8 h-8 flex items-center justify-center text-blue-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors shadow-sm border border-slate-100"
                                                    >
                                                        <ShieldAlert size={14} className="rotate-180" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button 
                                                        onClick={() => setConfirmDeleteProduct(p)} 
                                                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors shadow-sm border border-slate-100"
                                                        title="Delete Product"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh] custom-scrollbar">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-slate-900">
                                        {editingProduct ? "Update Product Details" : "Register New Product"}
                                    </h2>
                                    {editingProduct && (
                                        <p className="text-xs text-blue-600 font-semibold flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                                            <span>Connected to Catalog Product: {editingProduct.sku ? `[${editingProduct.sku}] ` : ""}{editingProduct.name}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setEditingProduct(null);
                                                    setForm(prev => ({ ...prev, shopStock: "" }));
                                                }} 
                                                className="underline text-slate-400 hover:text-slate-600 ml-1.5"
                                            >
                                                Create as separate new product instead
                                            </button>
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => { setShowModal(false); setEditingProduct(null); }} className="p-2 border rounded-full hover:bg-slate-50 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Product Information</label>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <div className="col-span-2 space-y-1 relative">
                                            <label className="text-xs font-bold text-slate-700">Product Name</label>
                                            <input 
                                                value={form.name} 
                                                onChange={e => setForm({...form, name: e.target.value})} 
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none" 
                                                placeholder="Type item name..."
                                            />
                                            {form.name.trim().length >= 2 && !editingProduct && (
                                                (() => {
                                                    const matches = products.filter(p => p.name.toLowerCase().includes(form.name.toLowerCase())).slice(0, 4);
                                                    if (matches.length === 0) return null;
                                                    return (
                                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1">
                                                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-3 py-1 bg-slate-50 rounded-lg">Matching items in catalog (Click to link/autofill)</p>
                                                            {matches.map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingProduct(m);
                                                                        setForm({
                                                                            name: m.name,
                                                                            category: m.category,
                                                                            price: m.price.toString(),
                                                                            shopStock: (m.shopStock || 0).toString(),
                                                                            warehouseStock: (m.warehouseStock || 0).toString(),
                                                                            bulkUnitSize: (m.bulkUnitSize || 1).toString(),
                                                                            bulkUnitName: m.bulkUnitName || "Item",
                                                                            sku: m.sku || "",
                                                                            description: m.description || ""
                                                                        });
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex justify-between items-center text-sm font-sans"
                                                                >
                                                                    <div>
                                                                        <span className="font-bold text-slate-800">{m.name}</span>
                                                                        <span className="text-xs text-slate-400 font-mono ml-2">({m.sku})</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600">
                                                                        {m.hasShopInventory ? "In Shop" : "Only in Warehouse"}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Category</label>
                                            {!isNewCategory ? (
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={form.category} 
                                                        onChange={e => {
                                                            if (e.target.value === "NEW_CATEGORY") {
                                                                setIsNewCategory(true);
                                                                setForm({...form, category: ""});
                                                            } else {
                                                                setForm({...form, category: e.target.value});
                                                            }
                                                        }} 
                                                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl"
                                                    >
                                                        {categories.length > 0 ? categories.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        )) : (
                                                            <>
                                                                <option>Safety Vests</option>
                                                                <option>Safety Helmets</option>
                                                                <option>Safety Boots</option>
                                                                <option>Fire Extinguishers</option>
                                                            </>
                                                        )}
                                                        <option value="NEW_CATEGORY">+ Add New Category</option>
                                                    </select>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setIsNewCategory(true);
                                                            setForm({...form, category: ""});
                                                        }}
                                                        className="px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                                                    >
                                                        New
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        autoFocus
                                                        value={form.category} 
                                                        onChange={e => setForm({...form, category: e.target.value})} 
                                                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl" 
                                                        placeholder="Enter category name"
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setIsNewCategory(false);
                                                            setForm({...form, category: categories[0] || "Safety Vests"});
                                                        }}
                                                        className="px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">SKU / Model Number</label>
                                            <input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Price (GH₵)</label>
                                            <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Description</label>
                                            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Level 1: Shop Stock</label>
                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-blue-700">Current Shop Stock</label>
                                            <input type="number" value={form.shopStock} onChange={e => setForm({...form, shopStock: e.target.value})} className="w-full p-3 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-100" />
                                            <p className="text-[10px] text-blue-600 font-medium">Qty available for sale at shop</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Level 2: Warehouse Stock</label>
                                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-amber-700">Warehouse Stock (Total Items)</label>
                                            <input type="number" value={form.warehouseStock} onChange={e => setForm({...form, warehouseStock: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-xl focus:ring-4 focus:ring-amber-100" />
                                            <p className="text-[10px] text-amber-600 font-medium">Bulk storage quantity</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bulk Setup (Packaging)</label>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Bulk Unit Name</label>
                                            <input value={form.bulkUnitName} onChange={e => setForm({...form, bulkUnitName: e.target.value})} placeholder="e.g. Box, Sack, Carton" className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Items per {form.bulkUnitName}</label>
                                            <input type="number" value={form.bulkUnitSize} onChange={e => setForm({...form, bulkUnitSize: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleAdd} className="w-full bg-blue-600 text-white p-5 rounded-[2rem] font-bold text-lg hover:bg-blue-700 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">
                                {editingProduct ? "Save Changes" : "Register Product"}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {confirmDeleteProduct && (
                    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl space-y-6">
                            <div className="text-center space-y-3">
                                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl mx-auto flex items-center justify-center">
                                    <Trash2 size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Confirm Deletion</h3>
                                <p className="text-slate-500 text-sm">
                                    Are you sure you want to delete <span className="font-semibold text-slate-800">"{confirmDeleteProduct.name}"</span>? 
                                    This action will permanently remove it from the database.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setConfirmDeleteProduct(null)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all font-sans"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const res = await fetch(`/api/products/${confirmDeleteProduct.id}`, { method: "DELETE" });
                                        if (res.ok) {
                                            setConfirmDeleteProduct(null);
                                            refresh();
                                        }
                                    }}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/10 font-sans"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function WarehouseInventoryView({ products, refresh, userRole, userPermissions }: { products: Product[], refresh: () => void | Promise<void>, userRole?: string, userPermissions?: UserPermissions, key?: string }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [transferModal, setTransferModal] = useState<Product | null>(null);
    const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
    const canDelete = userRole === "admin";
    const [addModal, setAddModal] = useState(false);
    const [linkingProduct, setLinkingProduct] = useState<Product | null>(null);
    const [editingWarehouseProduct, setEditingWarehouseProduct] = useState<Product | null>(null);
    const [transferQty, setTransferQty] = useState("1");
    const [isBulkTransfer, setIsBulkTransfer] = useState(true);
    const [isCustomPackQty, setIsCustomPackQty] = useState(false);
    const [customPackQty, setCustomPackQty] = useState("");
    const [isNewCategory, setIsNewCategory] = useState(false);
    const categories = Array.from(new Set(products.map(p => p.category))).sort();
    const [form, setForm] = useState({ 
        name: "", category: "Safety Vests", price: "", 
        shopStock: "0", warehouseStock: "", 
        bulkUnitSize: "1", bulkUnitName: "Box", 
        sku: "", description: "" 
    });

    const filteredProducts = products.filter(p => 
        (p.hasWarehouseInventory !== false) && (
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const handleAdd = async () => {
        const url = editingWarehouseProduct ? `/api/products/${editingWarehouseProduct.id}` : (linkingProduct ? `/api/products/${linkingProduct.id}` : "/api/products");
        const method = (editingWarehouseProduct || linkingProduct) ? "PUT" : "POST";
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                ...form, 
                price: Number(form.price), 
                shopStock: Number(form.shopStock),
                warehouseStock: Number(form.warehouseStock),
                bulkUnitSize: Number(form.bulkUnitSize),
                hasShopInventory: editingWarehouseProduct ? (editingWarehouseProduct.hasShopInventory ?? false) : (linkingProduct ? (linkingProduct.hasShopInventory ?? false) : false),
                hasWarehouseInventory: true
            }),
        });
        if (res.ok) {
            setAddModal(false);
            setLinkingProduct(null);
            setEditingWarehouseProduct(null);
            refresh();
            setForm({ 
                name: "", category: "Safety Vests", price: "", 
                shopStock: "0", warehouseStock: "", 
                bulkUnitSize: "1", bulkUnitName: "Box", 
                sku: "", description: "" 
            });
            setIsNewCategory(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferModal) return;
        
        const calculatedQty = isBulkTransfer 
            ? Number(transferQty) * (isCustomPackQty ? (Number(customPackQty) || (transferModal.bulkUnitSize || 1)) : (transferModal.bulkUnitSize || 1)) 
            : Number(transferQty);

        const res = await fetch("/api/inventory/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: transferModal.id,
                quantity: calculatedQty,
                isBulk: false
            }),
        });
        if (res.ok) {
            setTransferModal(null);
            setTransferQty("1");
            setCustomPackQty("");
            setIsCustomPackQty(false);
            refresh();
        } else {
            const err = await res.json();
            alert(err.error || "Transfer failed");
        }
    };

    const handleExportPDF = () => {
        const headers = ["Item", "Category", "SKU", "Wh Stock", "Shop Stock", "Packaging"];
        const data = filteredProducts.map(p => [
            p.name, 
            p.category, 
            p.sku, 
            (p.warehouseStock || 0).toString(), 
            (p.shopStock || 0).toString(), 
            `${p.bulkUnitSize} per ${p.bulkUnitName}`
        ]);
        exportToPDF("Warehouse Inventory Report", headers, data, "warehouse_report");
    };

    const handleExportExcel = () => {
        exportToExcel(filteredProducts, "warehouse_report");
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 font-sans tracking-tight">Warehouse Inventory</h1>
                    <p className="text-slate-500">Manage bulk stock and movement to shop floor</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportPDF} className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
                        <Download size={18} />
                    </button>
                    <button onClick={handleExportExcel} title="Download Excel" className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
                        <FileText size={18} />
                    </button>
                    {userPermissions?.inventory.create && (
                        <button 
                            onClick={() => setAddModal(true)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all font-sans"
                        >
                            <Package size={20} />
                            Add to Warehouse
                        </button>
                    )}
                    <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl border border-amber-200 flex items-center gap-2 shadow-sm">
                        <Warehouse size={18} />
                        <span className="text-sm font-bold uppercase tracking-tighter">Bulk Active</span>
                    </div>
                </div>
            </header>

            <div className="relative">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Quick search warehouse stock..." 
                    className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all font-medium text-slate-700 shadow-sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/30">
                        <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-slate-200 mb-4 shadow-sm">
                            <Warehouse size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">No Warehouse Products Found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-2">Start by adding your bulk imported goods to the warehouse inventory.</p>
                        <button 
                            onClick={() => setAddModal(true)}
                            className="mt-6 text-blue-600 font-bold hover:underline"
                        >
                            Register your first item
                        </button>
                    </div>
                )}
                {filteredProducts.map(p => {
                    const boxes = p.warehouseStock || 0;
                    const singles = (p as any).warehouseLooseStock || 0;
                    const matchingShopItem = products.find(prod => 
                        prod.hasShopInventory && 
                        prod.id !== p.id && 
                        (
                            (p.sku && prod.sku && p.sku.trim().toLowerCase() === prod.sku.trim().toLowerCase()) ||
                            (p.name && prod.name && p.name.trim().toLowerCase() === prod.name.trim().toLowerCase())
                        )
                    );
                    const totalWhUnits = boxes * (p.bulkUnitSize || 1) + singles;
                    const isLowWarehouseStock = totalWhUnits < 200;
                    
                    return (
                        <div key={p.id} className={cn("bg-white p-8 rounded-[2rem] border shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group", isLowWarehouseStock ? "border-amber-200 bg-amber-50/10" : "border-slate-100")}>
                            <div className="flex justify-between items-start mb-6 w-full">
                                <div className="flex-1 min-w-0 pr-2">
                                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors truncate" title={p.name}>{p.name}</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{p.sku || "No SKU"}</p>
                                    
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                        {matchingShopItem ? (
                                            <div className="inline-flex items-center gap-1.5 text-[9px] text-green-600 font-bold bg-green-50 border border-green-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                                <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                                                <span>Mapped to Shop ({matchingShopItem.shopStock || 0} units)</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 text-[9px] text-slate-400 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span>Standalone Warehouse Stock</span>
                                            </div>
                                        )}

                                        {isLowWarehouseStock ? (
                                            <div className="inline-flex items-center gap-1.5 text-[9px] text-red-600 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                                <span>Low WH Stock ({totalWhUnits} / 200 pcs)</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 text-[9px] text-slate-500 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                                <span>Warehouse Total: {totalWhUnits} pcs</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-bold uppercase ring-1 ring-slate-100 shrink-0">{p.category}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{p.bulkUnitName || 'Unit'}s</p>
                                    <p className="text-2xl font-black text-slate-800">{boxes}</p>
                                </div>
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Loose Items</p>
                                    <p className="text-2xl font-black text-slate-800">{singles}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between p-4 bg-blue-50/30 border border-blue-50 rounded-2xl mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                        <Package size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase">Shop Stock</p>
                                        <p className="font-black text-blue-700">{p.shopStock || 0}</p>
                                    </div>
                                </div>
                                <ArrowLeftRight size={16} className="text-blue-200" />
                            </div>

                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        setTransferModal(p);
                                        setCustomPackQty((p.bulkUnitSize || 1).toString());
                                        setIsCustomPackQty(false);
                                        setTransferQty("1");
                                        setIsBulkTransfer(true);
                                    }}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-[1.5rem] font-bold hover:bg-blue-600 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-blue-500/20"
                                >
                                    <ArrowLeftRight size={18} />
                                    Move to Shop
                                </button>
                                {userRole === "admin" && (
                                    <button 
                                        onClick={() => {
                                            setEditingWarehouseProduct(p);
                                            setForm({
                                                name: p.name,
                                                category: p.category,
                                                price: p.price.toString(),
                                                shopStock: (p.shopStock || 0).toString(),
                                                warehouseStock: (p.warehouseStock || 0).toString(),
                                                bulkUnitSize: (p.bulkUnitSize || 1).toString(),
                                                bulkUnitName: p.bulkUnitName || "Box",
                                                sku: p.sku || "",
                                                description: p.description || ""
                                            });
                                            setAddModal(true);
                                        }}
                                        className="p-4 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-750 rounded-[1.5rem] transition-all border border-blue-100 flex items-center justify-center hover:scale-[1.05] active:scale-95 duration-150"
                                        title="Edit Warehouse Item"
                                    >
                                        <Edit size={18} />
                                    </button>
                                )}
                                {canDelete && (
                                    <button 
                                        onClick={() => setConfirmDeleteProduct(p)}
                                        className="p-4 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-750 rounded-[1.5rem] transition-all border border-red-100 flex items-center justify-center hover:scale-[1.05] active:scale-95 duration-150"
                                        title="Delete Product"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Transfer Modal */}
            <AnimatePresence>
                {transferModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl space-y-8">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-4">
                                    <ArrowLeftRight size={30} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">Transfer Inventory</h2>
                                <p className="text-slate-500">Moving <span className="font-bold text-slate-800">{transferModal.name}</span> from Warehouse to Shop Inventory</p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex p-2 bg-slate-100 rounded-2xl">
                                    <button 
                                        onClick={() => setIsBulkTransfer(true)}
                                        className={cn(
                                            "flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                                            isBulkTransfer ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                                        )}
                                    >
                                        Bulk ({transferModal.bulkUnitName || 'Box'})
                                    </button>
                                    <button 
                                        onClick={() => setIsBulkTransfer(false)}
                                        className={cn(
                                            "flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                                            !isBulkTransfer ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                                        )}
                                    >
                                        Individual Items
                                    </button>
                                </div>

                                {isBulkTransfer && (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input 
                                                type="checkbox" 
                                                checked={isCustomPackQty} 
                                                onChange={e => setIsCustomPackQty(e.target.checked)}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <span className="text-xs font-bold text-slate-700">This container has a partial quantity</span>
                                        </label>
                                        
                                        {isCustomPackQty && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Pieces inside this container</p>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        max={transferModal.bulkUnitSize || 1}
                                                        value={customPackQty}
                                                        onChange={e => setCustomPackQty(e.target.value)}
                                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/15 text-sm"
                                                        placeholder={`Standard is ${transferModal.bulkUnitSize || 1}`}
                                                    />
                                                    <span className="text-xs text-slate-400 whitespace-nowrap">/ {transferModal.bulkUnitSize || 1} standard pieces</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Quantity to move</label>
                                    <div className="relative">
                                        <input 
                                            type="number"
                                            value={transferQty}
                                            onChange={e => setTransferQty(e.target.value)}
                                            className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-3xl font-black text-center focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold uppercase text-[10px]">
                                            {isBulkTransfer ? transferModal.bulkUnitName : 'Items'}
                                        </div>
                                    </div>
                                    <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Total Items: {isBulkTransfer ? Number(transferQty) * (isCustomPackQty ? (Number(customPackQty) || 1) : (transferModal.bulkUnitSize || 1)) : transferQty}
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setTransferModal(null)}
                                        className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleTransfer}
                                        className="flex-1 py-4 px-6 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all font-sans uppercase tracking-widest"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Modal */}
            <AnimatePresence>
                {addModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl space-y-6 overflow-y-auto max-h-[90vh] custom-scrollbar">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-slate-900 font-sans">
                                        {editingWarehouseProduct ? "Edit Warehouse Product" : "New Warehouse Entry"}
                                    </h2>
                                    {linkingProduct && (
                                        <p className="text-xs text-blue-600 font-semibold flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                                            <span>Connected to Catalog Product: {linkingProduct.sku ? `[${linkingProduct.sku}] ` : ""}{linkingProduct.name}</span>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setLinkingProduct(null);
                                                    setForm(prev => ({ ...prev, warehouseStock: "" }));
                                                }} 
                                                className="underline text-slate-400 hover:text-slate-600 ml-1.5"
                                            >
                                                Create as separate new product instead
                                            </button>
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => { setAddModal(false); setLinkingProduct(null); setEditingWarehouseProduct(null); }} className="p-2 border rounded-full hover:bg-slate-50 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">General Information</label>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <div className="col-span-2 space-y-1 relative">
                                            <label className="text-xs font-bold text-slate-700">Product Name</label>
                                            <input 
                                                value={form.name} 
                                                onChange={e => setForm({...form, name: e.target.value})} 
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none" 
                                                placeholder="e.g. Industrial Safety Boots" 
                                            />
                                            {form.name.trim().length >= 2 && !linkingProduct && (
                                                (() => {
                                                    const matches = products.filter(p => p.name.toLowerCase().includes(form.name.toLowerCase())).slice(0, 4);
                                                    if (matches.length === 0) return null;
                                                    return (
                                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-1">
                                                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-3 py-1 bg-slate-50 rounded-lg">Matching items in catalog (Click to link/autofill)</p>
                                                            {matches.map(m => (
                                                                <button
                                                                    key={m.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setLinkingProduct(m);
                                                                        setForm({
                                                                            name: m.name,
                                                                            category: m.category,
                                                                            price: m.price.toString(),
                                                                            shopStock: (m.shopStock || 0).toString(),
                                                                            warehouseStock: (m.warehouseStock || 0).toString(),
                                                                            bulkUnitSize: (m.bulkUnitSize || 1).toString(),
                                                                            bulkUnitName: m.bulkUnitName || "Box",
                                                                            sku: m.sku || "",
                                                                            description: m.description || ""
                                                                        });
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex justify-between items-center text-sm font-sans"
                                                                >
                                                                    <div>
                                                                        <span className="font-bold text-slate-800">{m.name}</span>
                                                                        <span className="text-xs text-slate-400 font-mono ml-2">({m.sku})</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600">
                                                                        {m.hasWarehouseInventory ? "In Warehouse" : "Only in Shop"}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Category</label>
                                            {!isNewCategory ? (
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={form.category} 
                                                        onChange={e => {
                                                            if (e.target.value === "NEW_CATEGORY") {
                                                                setIsNewCategory(true);
                                                                setForm({...form, category: ""});
                                                            } else {
                                                                setForm({...form, category: e.target.value});
                                                            }
                                                        }} 
                                                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl"
                                                    >
                                                        {categories.length > 0 ? categories.map(cat => (
                                                            <option key={cat} value={cat}>{cat}</option>
                                                        )) : (
                                                            <>
                                                                <option>Safety Vests</option>
                                                                <option>Safety Helmets</option>
                                                                <option>Safety Boots</option>
                                                                <option>Fire Extinguishers</option>
                                                            </>
                                                        )}
                                                        <option value="NEW_CATEGORY">+ Add New Category</option>
                                                    </select>
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setIsNewCategory(true);
                                                            setForm({...form, category: ""});
                                                        }}
                                                        className="px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                                                    >
                                                        New
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        autoFocus
                                                        value={form.category} 
                                                        onChange={e => setForm({...form, category: e.target.value})} 
                                                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl" 
                                                        placeholder="Enter category name"
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            setIsNewCategory(false);
                                                            setForm({...form, category: categories[0] || "Safety Vests"});
                                                        }}
                                                        className="px-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">SKU / ID</label>
                                            <input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Selling Price (GH₵)</label>
                                            <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-amber-400 uppercase tracking-widest">Initial Warehouse Stock</label>
                                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-amber-700">Total Units in Warehouse</label>
                                            <input type="number" value={form.warehouseStock} onChange={e => setForm({...form, warehouseStock: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-blue-400 uppercase tracking-widest">Initial Shop Stock</label>
                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-blue-700">Shop Shelf Quantity</label>
                                            <input type="number" value={form.shopStock} onChange={e => setForm({...form, shopStock: e.target.value})} className="w-full p-3 bg-white border border-blue-200 rounded-xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Packaging Details (Bulk)</label>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Bulk Unit Name</label>
                                            <input value={form.bulkUnitName} onChange={e => setForm({...form, bulkUnitName: e.target.value})} placeholder="e.g. Box, Sack, Carton" className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700">Qty per {form.bulkUnitName}</label>
                                            <input type="number" value={form.bulkUnitSize} onChange={e => setForm({...form, bulkUnitSize: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleAdd} className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-bold text-lg hover:bg-blue-600 transition-all font-sans uppercase tracking-widest shadow-2xl shadow-blue-500/10">
                                Save to Inventory
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {confirmDeleteProduct && (
                    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl space-y-6">
                            <div className="text-center space-y-3">
                                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl mx-auto flex items-center justify-center">
                                    <Trash2 size={28} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Confirm Deletion</h3>
                                <p className="text-slate-500 text-sm">
                                    Are you sure you want to delete <span className="font-semibold text-slate-800">"{confirmDeleteProduct.name}"</span>? 
                                    This action will permanently remove it from the database.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setConfirmDeleteProduct(null)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all font-sans"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const res = await fetch(`/api/products/${confirmDeleteProduct.id}`, { method: "DELETE" });
                                        if (res.ok) {
                                            setConfirmDeleteProduct(null);
                                            refresh();
                                        }
                                    }}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/10 font-sans"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function POSView({ products, customers, refresh, businessName }: { products: Product[], customers: Customer[], refresh: () => void | Promise<void>, businessName: string, key?: string }) {
    const [cart, setCart] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [customerName, setCustomerName] = useState(""); // For walk-in identified by name
    const [amountPaid, setAmountPaid] = useState("");
    const [discount, setDiscount] = useState("");
    const [paymentType, setPaymentType] = useState<"cash" | "credit" | "mobile_money">("cash");
    const [lastSale, setLastSale] = useState<any>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const filteredProducts = products.filter(p => 
        (p.hasShopInventory !== false) && (
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const addToCart = (product: Product) => {
        const stock = (product.shopStock !== undefined ? product.shopStock : (product as any).stock) || 0;
        const existing = cart.find(i => i.id === product.id);
        if (existing) {
            const currentQty = Number(existing.quantity) || 0;
            if (currentQty >= stock) return;
            setCart(cart.map(i => i.id === product.id ? { ...i, quantity: currentQty + 1 } : i));
        } else {
            if (stock <= 0) return;
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const total = cart.reduce((acc, i) => acc + (i.price * (Number(i.quantity) || 0)), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setErrorMsg("");
        if (paymentType === "credit" && !selectedCustomer) {
            setErrorMsg("Please SELECT a customer for credit sales!");
            return;
        }
        
        try {
            const discountAmt = Number(discount) || 0;
            const finalTotal = Math.max(0, total - discountAmt);
            const paid = Number(amountPaid) || (paymentType !== "credit" ? finalTotal : 0);

            const res = await fetch("/api/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: cart,
                    customerId: selectedCustomer,
                    customerName: customerName || (customers.find(c => c.id === selectedCustomer)?.name || "Walk-in"),
                    total,
                    discount: discountAmt,
                    paymentType,
                    amountPaid: paid
                }),
            });

            if (res.ok) {
                const sale = await res.json();
                setLastSale(sale);
                setShowReceipt(true);
                setCart([]);
                setSelectedCustomer("");
                setCustomerName("");
                setAmountPaid("");
                setDiscount("");
                setErrorMsg("");
                await refresh();
            } else {
                const errData = await res.json().catch(() => ({}));
                setErrorMsg(`Error processing checkout: ${errData.error || res.statusText || "Unknown server error"}`);
            }
        } catch (error: any) {
            console.error("Checkout error:", error);
            setErrorMsg(`Checkout error: ${error.message || "Failed to connect to server"}`);
        }
    };

    const handleReceiptPrint = () => {
        if (!lastSale) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Please allow popups to print your receipt.");
            return;
        }
        
        const receiptHtml = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>POS Receipt - ${lastSale.id.split('-')[0].toUpperCase()}</title>
                    <style>
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 13px;
                            line-height: 1.4;
                            color: #000;
                            margin: 0;
                            padding: 20px;
                            max-width: 320px;
                        }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .my-4 { margin-top: 16px; margin-bottom: 16px; }
                        .border-t { border-top: 1px dashed #000; }
                        .border-b { border-bottom: 1px dashed #000; }
                        .py-2 { padding-top: 8px; padding-bottom: 8px; }
                        .flex { display: flex; justify-content: space-between; }
                        .mt-2 { margin-top: 8px; }
                        .mb-1 { margin-bottom: 4px; }
                        .header-title { font-size: 18px; font-weight: 900; margin: 0 0 4px 0; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <div class="text-center">
                        <h2 class="header-title">${businessName || "Genesys Retail"}</h2>
                        <div class="font-bold">SALES RECEIPT</div>
                        <div>Thank You For Shopping!</div>
                    </div>
                    
                    <div class="my-4 border-t border-b py-2 text-xs">
                        <div class="flex"><span>Receipt ID:</span> <span>${lastSale.id.split('-')[0].toUpperCase()}</span></div>
                        <div class="flex"><span>Date:</span> <span>${new Date(lastSale.date).toLocaleString()}</span></div>
                        <div class="flex"><span>Customer:</span> <span>${lastSale.customerName}</span></div>
                        <div class="flex"><span>Payment:</span> <span style="text-transform: uppercase;">${lastSale.paymentType}</span></div>
                    </div>
                    
                    <div class="my-4 border-b pb-2">
                        <div class="flex font-bold" style="font-size: 11px; margin-bottom: 6px;">
                            <span style="flex: 2;">Item</span>
                            <span style="flex: 1; text-align: center;">Qty</span>
                            <span style="flex: 1; text-align: right;">Total</span>
                        </div>
                        ${lastSale.items.map((item: any) => `
                            <div class="mb-1">
                                <div class="font-bold">${item.name}</div>
                                <div class="flex" style="font-size: 11px;">
                                    <span style="flex: 2; color: #555;">${formatCurrency(item.price)} each</span>
                                    <span style="flex: 1; text-align: center;">x${item.quantity}</span>
                                    <span style="flex: 1; text-align: right;">${formatCurrency(item.price * item.quantity)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="my-4 text-sm space-y-1">
                        <div class="flex"><span>Subtotal:</span> <span>${formatCurrency(lastSale.total)}</span></div>
                        ${lastSale.discount > 0 ? `<div class="flex font-bold" style="color: #000;"><span>Discount:</span> <span>-${formatCurrency(lastSale.discount)}</span></div>` : ''}
                        <div class="flex font-black border-t pt-2 mt-2" style="font-size: 15px;">
                            <span>TOTAL DUE:</span>
                            <span>${formatCurrency(Math.max(0, lastSale.total - (lastSale.discount || 0)))}</span>
                        </div>
                    </div>
                    
                    <div class="text-center" style="margin-top: 40px; font-size: 11px;">
                        <div>SYSTEM POWERED BY GENESYS POS</div>
                        <div style="font-style: italic;">We Hope to See You Again!</div>
                    </div>
                </body>
            </html>
        `;
        
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
    };

    const handleReceiptPDFDownload = () => {
        if (!lastSale) return;
        const doc = new jsPDF() as any;
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.text(businessName || "Genesys Retail", 105, 25, { align: "center" });
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text("SALES TRANSACTION RECEIPT", 105, 32, { align: "center" });
        
        doc.setDrawColor(226, 232, 240); // Slate-200
        doc.setLineWidth(0.5);
        doc.line(20, 38, 190, 38);
        
        // Transaction Info Meta Grid
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105); // Slate-600
        doc.text(`Receipt ID: ${lastSale.id.split('-')[0].toUpperCase()}`, 20, 46);
        doc.text(`Date/Time: ${new Date(lastSale.date).toLocaleString()}`, 20, 52);
        
        doc.text(`Customer Name: ${lastSale.customerName}`, 120, 46);
        doc.text(`Payment Type: ${lastSale.paymentType.toUpperCase()}`, 120, 52);
        
                // Headers and rows of purchase
        const headers = [["Product / Item Description", "Unit Price", "Purchased Qty", "Net Value"]];
        const rows = lastSale.items.map((item: any) => [
            item.name,
            formatCurrencyPDF(item.price),
            item.quantity.toString(),
            formatCurrencyPDF(item.price * item.quantity)
        ]);
        
        autoTable(doc, {
            startY: 58,
            head: headers,
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [51, 65, 85] },
            styles: { font: "Helvetica", fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { halign: 'right' },
                2: { halign: 'center' },
                3: { halign: 'right' }
            }
        });
        
        let finalY = 120;
        if ((doc as any).lastAutoTable && typeof (doc as any).lastAutoTable.finalY === 'number') {
            finalY = (doc as any).lastAutoTable.finalY + 10;
        } else if ((doc as any).previousAutoTable && typeof (doc as any).previousAutoTable.finalY === 'number') {
            finalY = (doc as any).previousAutoTable.finalY + 10;
        }
        
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Subtotal Assessment:", 115, finalY);
        doc.text(formatCurrencyPDF(lastSale.total), 175, finalY, { align: "right" });
        
        let currentY = finalY;
        if (lastSale.discount > 0) {
            currentY += 6;
            doc.setTextColor(217, 119, 6); // amber-600
            doc.text("Applied Discount:", 115, currentY);
            doc.text(`-${formatCurrencyPDF(lastSale.discount)}`, 175, currentY, { align: "right" });
        }
        
        currentY += 8;
        doc.setLineWidth(0.5);
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.line(115, currentY - 4, 175, currentY - 4);
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("Final Total Paid:", 115, currentY);
        doc.text(formatCurrencyPDF(Math.max(0, lastSale.total - (lastSale.discount || 0))), 175, currentY, { align: "right" });
        
        // Footer message
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("All amounts are parsed in Ghana Cedis. Thank you for your partnership!", 105, currentY + 20, { align: "center" });
        
        doc.save(`Receipt_${lastSale.id.split('-')[0].toUpperCase()}.pdf`);
    };

    return (
        <div className="h-full w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex gap-6 min-h-0 min-w-[950px] lg:min-w-0 pr-1">
                <div className="flex-1 flex flex-col h-full min-h-0">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h1 className="text-3xl font-bold text-slate-900">POS</h1>
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search products..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none" 
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto px-1 min-h-0 pb-2 custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {filteredProducts.map(p => (
                            <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all text-left group">
                                <h3 className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{p.name}</h3>
                                <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-tight">{p.category}</p>
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-blue-600">{formatCurrency(p.price)}</span>
                                    <span className={cn(
                                        "text-[10px] px-2 py-1 rounded-md font-bold",
                                        (p.shopStock || 0) < 5 ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-500"
                                    )}>
                                        Shop: {p.shopStock || 0}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="w-96 bg-white rounded-[2rem] border border-slate-200 p-6 flex flex-col shadow-sm h-full max-h-full overflow-hidden shrink-0">
                <h3 className="text-xl font-bold text-slate-800 mb-4 font-sans uppercase tracking-tight shrink-0">Current Sale</h3>
                
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0 flex flex-col">
                    {/* Cart Items List */}
                    <div className="space-y-4 mb-4">
                        {cart.map(i => {
                            const stock = (i.shopStock !== undefined ? i.shopStock : (i as any).stock) || 0;
                            return (
                                <div key={i.id} className="flex flex-col gap-1 border-b border-slate-50 pb-3">
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-slate-800 text-sm truncate max-w-[180px]" title={i.name}>{i.name}</span>
                                        <span className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(i.price * (Number(i.quantity) || 0))}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <span className="font-medium">Qty:</span>
                                            <input 
                                                type="number" 
                                                min="1"
                                                max={stock}
                                                value={i.quantity === 0 || i.quantity === "" ? "" : i.quantity} 
                                                onChange={e => {
                                                    const rawVal = e.target.value;
                                                    if (rawVal === "") {
                                                        setCart(cart.map(item => item.id === i.id ? { ...item, quantity: "" as any } : item));
                                                        return;
                                                    }
                                                    const num = Number(rawVal);
                                                    const val = Math.max(0, Math.min(stock, num));
                                                    setCart(cart.map(item => item.id === i.id ? { ...item, quantity: val } : item));
                                                }}
                                                onBlur={() => {
                                                    const finalQty = Math.max(1, Number(i.quantity) || 1);
                                                    setCart(cart.map(item => item.id === i.id ? { ...item, quantity: finalQty } : item));
                                                }}
                                                className="w-14 p-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-800"
                                            />
                                            <span className="text-[10px] text-slate-400">/ stock {stock}</span>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setCart(cart.filter(item => item.id !== i.id))}
                                            className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {cart.length === 0 && <div className="text-center py-20 text-slate-300">Cart is empty</div>}
                    </div>

                    {/* Original Spacious Form Controls */}
                    <div className="space-y-3.5 border-t border-slate-100 pt-4 mt-auto">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer Selection</label>
                            <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none">
                                <option value="">Walk-in Customer</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {!selectedCustomer && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Walk-in Name (Optional)</label>
                                <input 
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Customer Name"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none"
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment Type</label>
                            <div className="grid grid-cols-3 gap-1">
                                <button type="button" onClick={() => setPaymentType("cash")} className={cn("p-2 rounded-xl text-xs font-bold border-2 transition-all text-center cursor-pointer", paymentType === "cash" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-400")}>Cash</button>
                                <button type="button" onClick={() => setPaymentType("mobile_money")} className={cn("p-2 rounded-xl text-xs font-bold border-2 transition-all text-center cursor-pointer", paymentType === "mobile_money" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-400")}>Momo</button>
                                <button type="button" onClick={() => setPaymentType("credit")} className={cn("p-2 rounded-xl text-xs font-bold border-2 transition-all text-center cursor-pointer", paymentType === "credit" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-400")}>Credit</button>
                            </div>
                        </div>

                        {paymentType === "credit" && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Initial Deposit</label>
                                <input type="number" placeholder="0.00" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 text-sm outline-none" />
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Discount Amount (GH₵)</label>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                value={discount} 
                                onChange={e => setDiscount(e.target.value)} 
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 font-bold text-sm outline-none" 
                            />
                        </div>

                        <div className="pt-3 space-y-1 border-t border-slate-100">
                            <div className="flex justify-between text-slate-400 text-xs font-semibold">
                                <span>Subtotal</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                            {Number(discount) > 0 && (
                                <div className="flex justify-between text-amber-600 text-xs font-bold">
                                    <span>Discount</span>
                                    <span>-{formatCurrency(Number(discount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-black text-slate-900 pt-1 border-t border-slate-50 mt-1">
                                <span>Total Due</span>
                                <span>{formatCurrency(Math.max(0, total - (Number(discount) || 0)))}</span>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold text-center animate-pulse">
                                {errorMsg}
                            </div>
                        )}

                        <button type="button" onClick={handleCheckout} className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/15 disabled:opacity-50 text-sm cursor-pointer" disabled={cart.length === 0}>
                            Checkout & Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            <AnimatePresence>
                {showReceipt && lastSale && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 overflow-y-auto">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl space-y-8 print:shadow-none print:p-0"
                        >
                            <div className="text-center space-y-2 border-b border-slate-100 pb-8">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-4 font-black text-xl">
                                    {businessName ? businessName.slice(0, 2).toUpperCase() : <Check size={32} />}
                                </div>
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight">{businessName || "Genesys Retail"}</h1>
                                <h2 className="text-lg font-bold text-green-600">Sale Confirmed!</h2>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Transaction Receipt</p>
                            </div>

                            <div className="space-y-6 font-mono text-sm bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                <div className="flex justify-between items-center text-slate-400 text-xs border-b border-slate-200 border-dashed pb-4 mb-4">
                                    <span>ID: {lastSale.id.split('-')[0].toUpperCase()}</span>
                                    <span>{new Date(lastSale.date).toLocaleString()}</span>
                                </div>

                                <div className="space-y-3 pb-4 border-b border-slate-200 border-dashed">
                                    {lastSale.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800">{item.name}</p>
                                                <p className="text-[10px] text-slate-400">{item.quantity} x {formatCurrency(item.price)}</p>
                                            </div>
                                            <span className="font-bold text-slate-700">{formatCurrency(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(lastSale.total)}</span>
                                    </div>
                                    {lastSale.discount > 0 && (
                                        <div className="flex justify-between text-amber-600 font-bold">
                                            <span>Discount</span>
                                            <span>-{formatCurrency(lastSale.discount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-black text-slate-900 pt-2 border-t border-slate-200 border-dashed mt-2">
                                        <span>TOTAL</span>
                                        <span>{formatCurrency(Math.max(0, lastSale.total - (lastSale.discount || 0)))}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 pt-4 font-bold uppercase">
                                        <span>Method: {lastSale.paymentType}</span>
                                        <span>Customer: {lastSale.customerName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button 
                                    onClick={() => setShowReceipt(false)}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm cursor-pointer"
                                >
                                    Dismiss
                                </button>
                                <button 
                                    onClick={handleReceiptPDFDownload}
                                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/10 active:scale-95 transition-all flex items-center justify-center gap-2 font-sans text-sm cursor-pointer"
                                >
                                    <Download size={16} />
                                    Download PDF
                                </button>
                                <button 
                                    onClick={handleReceiptPrint}
                                    className="flex-1 py-3 px-4 rounded-xl bg-slate-950 text-white font-bold hover:bg-black shadow-lg shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-2 font-sans text-sm cursor-pointer"
                                >
                                    <Printer size={16} />
                                    Print Receipt
                                </button>
                            </div>
                            
                            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tighter">Thank you for shopping with us!</p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    </div>
);
}

function CreditView({ customers, refresh, userPermissions }: { customers: Customer[], refresh: () => void | Promise<void>, userPermissions?: UserPermissions, key?: string }) {
    const [searchTerm, setSearchTerm] = useState("");
    const debtors = customers.filter(c => 
        c.balance > 0 && 
        (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
    );
    const totalCreditOwed = debtors.reduce((acc, c) => acc + (c.balance || 0), 0);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [payModal, setPayModal] = useState(false);
    const [payAmount, setPayAmount] = useState("");

    const handleExportPDF = () => {
        const headers = ["Customer", "Phone", "Balance Due"];
        const data = debtors.map(c => [c.name, c.phone, formatCurrencyPDF(c.balance)]);
        exportToPDF("Debtors Report", headers, data, "debtors_report");
    };

    const handleExportExcel = () => {
        exportToExcel(debtors, "debtors_report");
    };

    const viewHistory = async (c: Customer) => {
        setSelectedCustomer(c);
        const res = await fetch(`/api/payments/${c.id}`);
        const data = await res.json();
        setHistory(data);
    };

    const handlePayment = async () => {
        if (!selectedCustomer) return;
        const res = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId: selectedCustomer.id, amount: Number(payAmount) }),
        });
        if (res.ok) {
            setPayModal(false);
            setPayAmount("");
            refresh();
            viewHistory(selectedCustomer);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Credit Management</h1>
                    <p className="text-slate-500">Track outstanding balances and payment history</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportPDF} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black shadow-lg flex items-center gap-2">
                        <Download size={18} /> PDF
                    </button>
                    <button onClick={handleExportExcel} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black shadow-lg flex items-center gap-2">
                        Excel
                    </button>
                </div>
            </header>

            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search debtors by name or phone..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-4 pl-8 text-xs font-bold text-slate-400 uppercase">Customer</th>
                                <th className="p-4 text-xs font-bold text-slate-400 uppercase text-right">Balance</th>
                                <th className="p-4 pr-8 text-xs font-bold text-slate-400 uppercase text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {debtors.map(c => (
                                <tr key={c.id} className={cn("hover:bg-slate-50 transition-colors", selectedCustomer?.id === c.id && "bg-blue-50/50")}>
                                    <td className="p-4 pl-8">
                                        <p className="font-bold text-slate-800">{c.name}</p>
                                        <p className="text-xs text-slate-400">{c.phone}</p>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="font-bold text-red-500">{formatCurrency(c.balance)}</span>
                                    </td>
                                    <td className="p-4 pr-8 text-right">
                                        <button onClick={() => viewHistory(c)} className="text-blue-600 font-bold text-sm hover:underline">View History</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-100 font-bold">
                            <tr>
                                <td className="p-4 pl-8 text-slate-700 text-sm font-black">Total Outstanding Credit</td>
                                <td className="p-4 text-right text-red-600 text-base font-black">{formatCurrency(totalCreditOwed)}</td>
                                <td className="p-4 pr-8"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm h-[600px] flex flex-col">
                    {selectedCustomer ? (
                        <>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selectedCustomer.name}</h3>
                                    <p className="text-red-500 font-bold text-lg">{formatCurrency(selectedCustomer.balance)} Due</p>
                                </div>
                                {userPermissions?.credit.payment && (
                                    <button onClick={() => setPayModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-500/20">Receive Payment</button>
                                )}
                            </div>
                            <div className="flex-1 overflow-auto space-y-3 pr-1">
                                {history.map(h => {
                                    const isDebtEntry = h.isDebt || h.type === "credit_purchase";
                                    const isReturnEntry = h.type === "goods_return";
                                    
                                    return (
                                        <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2 transition-all hover:bg-slate-100/50">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className={cn(
                                                        "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider",
                                                        isDebtEntry 
                                                            ? "bg-red-50 text-red-600 border border-red-100" 
                                                            : isReturnEntry 
                                                                ? "bg-amber-50 text-amber-600 border border-amber-100" 
                                                                : "bg-green-50 text-green-600 border border-green-100"
                                                    )}>
                                                        {h.type.replace('_', ' ')}
                                                    </span>
                                                    <p className="text-xs font-semibold text-slate-700 mt-2">{h.description || "Transaction"}</p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(h.date)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "font-black text-sm",
                                                        isDebtEntry ? "text-red-600" : isReturnEntry ? "text-amber-600" : "text-green-600"
                                                    )}>
                                                        {isDebtEntry ? "+" : "-"} {formatCurrency(h.amount)}
                                                    </span>
                                                    {h.remainingBalance !== undefined && (
                                                        <div className="text-[11px] text-slate-500 font-medium mt-1">
                                                            Bal: <span className="font-bold text-slate-700">{formatCurrency(h.remainingBalance)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                            <History size={48} className="mb-4" />
                            <p>Select a debtor to see history</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            <AnimatePresence>
                {payModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl space-y-6">
                            <h2 className="text-2xl font-bold">Receive Payment</h2>
                            <div className="space-y-4">
                                <p className="text-slate-500 text-sm">Customer: <span className="font-bold">{selectedCustomer?.name}</span></p>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold">Amount to Pay (GH₵)</label>
                                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl text-xl font-bold" />
                                </div>
                                <button onClick={handlePayment} className="w-full bg-green-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-green-500/20">Confirm Payment</button>
                                <button onClick={() => setPayModal(false)} className="w-full text-slate-400 font-bold py-2">Cancel</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function CustomerView({ customers, refresh, userPermissions }: { customers: Customer[], refresh: () => void | Promise<void>, userPermissions?: UserPermissions, key?: string }) {
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [form, setForm] = useState({ name: "", phone: "", address: "" });

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
    );

    const handleExportPDF = () => {
        const headers = ["Name", "Phone", "Address", "Balance"];
        const data = filteredCustomers.map(c => [c.name, c.phone, c.address, formatCurrencyPDF(c.balance)]);
        exportToPDF("Customer Directory", headers, data, "customers_report");
    };

    const handleExportExcel = () => {
        exportToExcel(filteredCustomers, "customers_report");
    };

    const handleAdd = async () => {
         const res = await fetch("/api/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setShowModal(false);
            refresh();
            setForm({ name: "", phone: "", address: "" });
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
                    <p className="text-slate-500">Directory of your regular clients</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportPDF} title="Download PDF" className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600">
                        <Download size={20} />
                    </button>
                    <button onClick={handleExportExcel} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black shadow-lg">
                        Export Excel
                    </button>
                    {userPermissions?.customers.create && (
                        <button 
                            onClick={() => setShowModal(true)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                        >
                            <UserPlus size={20} /> Add Customer
                        </button>
                    )}
                </div>
            </header>

            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search customers..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10" 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.map(c => (
                    <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-slate-800 mb-1">{c.name}</h3>
                            <p className="text-slate-500 text-sm mb-4">{c.phone}</p>
                            <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Balance</p>
                                    <p className={cn("text-lg font-bold", c.balance > 0 ? "text-red-500" : "text-green-500")}>{formatCurrency(c.balance)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Address</p>
                                    <p className="text-xs text-slate-600 line-clamp-1 max-w-[150px]">{c.address || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

             {/* Add Customer Modal */}
             <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl space-y-6">
                            <h2 className="text-2xl font-bold">New Customer</h2>
                            <div className="space-y-4">
                                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full Name" className="w-full p-4 bg-slate-50 border rounded-xl" />
                                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone Number" className="w-full p-4 bg-slate-50 border rounded-xl" />
                                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Address" className="w-full p-4 bg-slate-50 border rounded-xl" />
                                <button onClick={handleAdd} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-xl shadow-blue-500/20">Register</button>
                                <button onClick={() => setShowModal(false)} className="w-full text-slate-400 font-bold py-2">Cancel</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function SalesHistoryView({ sales, customers, returns = [], refresh, userRole }: { sales: Sale[], customers: Customer[], returns?: any[], refresh?: () => void | Promise<void>, userRole?: string, key?: string }) {
    const [viewMode, setViewMode] = useState<"sales" | "returns">("sales");
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState<"all" | "day" | "week" | "month" | "year" | "custom">("day");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    
    const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
    const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

    const filteredSales = sales.filter(s => {
        // Date Filtering
        if (dateFilter !== "all") {
            const saleDate = new Date(s.date);
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfTomorrow = new Date(startOfToday);
            startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

            if (dateFilter === "day") {
                if (!(saleDate >= startOfToday && saleDate < startOfTomorrow)) return false;
            } else if (dateFilter === "week") {
                const currentDayOfWeek = now.getDay();
                const startOfWeek = new Date(startOfToday);
                startOfWeek.setDate(startOfWeek.getDate() - currentDayOfWeek);
                
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 7);
                
                if (!(saleDate >= startOfWeek && saleDate < endOfWeek)) return false;
            } else if (dateFilter === "month") {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                
                if (!(saleDate >= startOfMonth && saleDate < nextMonth)) return false;
            } else if (dateFilter === "year") {
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const nextYear = new Date(now.getFullYear() + 1, 0, 1);
                
                if (!(saleDate >= startOfYear && saleDate < nextYear)) return false;
            } else if (dateFilter === "custom") {
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (saleDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (saleDate > end) return false;
                }
            }
        }

        const customer = customers.find(c => c.id === s.customerId);
        const searchLower = searchTerm.toLowerCase();
        return (
            s.id.toLowerCase().includes(searchLower) ||
            (s.customerName || "").toLowerCase().includes(searchLower) ||
            (customer?.name || "").toLowerCase().includes(searchLower) ||
            s.paymentType.toLowerCase().includes(searchLower)
        );
    }).reverse();

    const totalSalesAmount = filteredSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const totalPaidAmount = filteredSales.reduce((acc, s) => acc + (s.amountPaid || 0), 0);

    const filteredReturns = returns.filter(r => {
        // Date Filtering
        if (dateFilter !== "all") {
            const retDate = new Date(r.date);
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfTomorrow = new Date(startOfToday);
            startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

            if (dateFilter === "day") {
                if (!(retDate >= startOfToday && retDate < startOfTomorrow)) return false;
            } else if (dateFilter === "week") {
                const currentDayOfWeek = now.getDay();
                const startOfWeek = new Date(startOfToday);
                startOfWeek.setDate(startOfWeek.getDate() - currentDayOfWeek);
                
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 7);
                
                if (!(retDate >= startOfWeek && retDate < endOfWeek)) return false;
            } else if (dateFilter === "month") {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                
                if (!(retDate >= startOfMonth && retDate < nextMonth)) return false;
            } else if (dateFilter === "year") {
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const nextYear = new Date(now.getFullYear() + 1, 0, 1);
                
                if (!(retDate >= startOfYear && retDate < nextYear)) return false;
            } else if (dateFilter === "custom") {
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (retDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (retDate > end) return false;
                }
            }
        }

        const searchLower = searchTerm.toLowerCase();
        return (
            r.id.toLowerCase().includes(searchLower) ||
            (r.customerName || "").toLowerCase().includes(searchLower) ||
            r.paymentType.toLowerCase().includes(searchLower) ||
            r.items.some((it: any) => it.name.toLowerCase().includes(searchLower))
        );
    }).reverse();

    const returnsStats = {
        totalReturned: filteredReturns.reduce((acc, r) => acc + r.totalAmount, 0),
        creditCleared: filteredReturns.filter(r => r.paymentType === "credit").reduce((acc, r) => acc + r.totalAmount, 0),
        cashMomoReturned: filteredReturns.filter(r => r.paymentType !== "credit").reduce((acc, r) => acc + r.totalAmount, 0)
    };

    const handleExportPDF = () => {
        if (viewMode === "sales") {
            const headers = ["Date", "Customer", "Total", "Paid", "Type"];
            const data = filteredSales.map(s => {
                const customer = customers.find(c => c.id === s.customerId);
                return [
                    formatDate(s.date),
                    s.customerName || customer?.name || "Walk-in",
                    formatCurrencyPDF(s.total),
                    formatCurrencyPDF(s.amountPaid),
                    s.paymentType.toUpperCase()
                ];
            });
            exportToPDF("Sales History Report", headers, data, "sales_report");
        } else {
            const headers = ["Date", "Return ID", "Customer", "Orig. Type", "Returned Items", "Refund Amount"];
            const data = filteredReturns.map(r => [
                formatDate(r.date),
                r.id.split('-')[0].toUpperCase(),
                r.customerName || "Walk-in",
                r.paymentType?.toUpperCase() || "N/A",
                r.items.map((it: any) => `${it.name} (x${it.quantity})`).join(", "),
                formatCurrencyPDF(r.totalAmount)
            ]);
            
            const periodString = dateFilter === "custom" 
                ? `Period: ${startDate || "Start"} to ${endDate || "End"}` 
                : `Period Filter: ${dateFilter.toUpperCase()}`;
            
            exportToPDF(`Audit Returned Goods Report (${periodString})`, headers, data, "returned_goods_report");
        }
    };

    const handleExportExcel = () => {
        if (viewMode === "sales") {
            const data = filteredSales.map(s => {
                const customer = customers.find(c => c.id === s.customerId);
                return {
                    Date: formatDate(s.date),
                    Customer: s.customerName || customer?.name || "Walk-in",
                    Total: s.total,
                    Paid: s.amountPaid,
                    Type: s.paymentType,
                    Items: s.items.map(i => `${i.name}(x${i.quantity})`).join(', ')
                };
            });
            exportToExcel(data, "sales_report");
        } else {
            const data = filteredReturns.map(r => ({
                "Return Date": formatDate(r.date),
                "Return ID": r.id,
                "Original Sale ID": r.saleId,
                "Customer Name": r.customerName || "Walk-in",
                "Original Payment Type": r.paymentType?.toUpperCase() || "N/A",
                "Returned Items": r.items.map((it: any) => `${it.name} (x${it.quantity})`).join(", "),
                "Total Refund/Offset Amount": r.totalAmount
            }));
            exportToExcel(data, "returned_goods_report");
        }
    };

    const handleSubmitReturn = async () => {
        if (!selectedSaleForReturn) return;
        const itemsToSubmit = Object.entries(returnQuantities)
            .map(([itemId, qty]) => ({ id: itemId, quantity: Number(qty) }))
            .filter(item => item.quantity > 0);

        if (itemsToSubmit.length === 0) {
            alert("Please input a return quantity of at least 1 unit to proceed.");
            return;
        }

        try {
            const res = await fetch("/api/returns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    saleId: selectedSaleForReturn.id,
                    items: itemsToSubmit
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert("Returned goods processed successfully! Product inventory has been restocked and customer ledger updated.");
                setSelectedSaleForReturn(null);
                setReturnQuantities({});
                if (refresh) await refresh();
            } else {
                alert(data.error || "Failed to process returned goods.");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to submit returns because of a network error.");
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Ledger & History</h1>
                    <p className="text-slate-500">Track and manage sales records and returned items</p>
                </div>
                
                {/* Sub-Tabs Selector */}
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner max-w-sm">
                    <button 
                        type="button"
                        onClick={() => setViewMode("sales")}
                        className={cn(
                            "px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                            viewMode === "sales" 
                                ? "bg-white text-slate-900 shadow-sm" 
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        Sales Transactions
                    </button>
                    <button 
                        type="button"
                        onClick={() => setViewMode("returns")}
                        className={cn(
                            "px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                            viewMode === "returns" 
                                ? "bg-white text-slate-900 shadow-sm" 
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        Returned Goods ({returns.length})
                    </button>
                </div>

                <div className="flex gap-3">
                    <button onClick={handleExportPDF} className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 cursor-pointer" title="Download Report PDF">
                        <Download size={20} />
                    </button>
                    <button onClick={handleExportExcel} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black shadow-lg cursor-pointer">
                        Export Excel
                    </button>
                </div>
            </header>

            {/* Sub-Ledger Metrics */}
            {viewMode === "returns" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm relative overflow-hidden flex items-center gap-4">
                        <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
                            <Undo2 size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">All Returns Volume</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(returnsStats.totalReturned)}</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm relative overflow-hidden flex items-center gap-4">
                        <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Credit Debts Cleared</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(returnsStats.creditCleared)}</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm relative overflow-hidden flex items-center gap-4">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <ArrowLeftRight size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cash/Momo Offset</p>
                            <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(returnsStats.cashMomoReturned)}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={viewMode === "sales" ? "Search by customer name, payment type or sale ID..." : "Search returns by customer name, payment type or item name..."} 
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 text-sm" 
                        />
                    </div>
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl scroll-behavior self-start md:self-auto overflow-x-auto max-w-full shrink-0">
                        {(["day", "all", "week", "month", "year", "custom"] as const).map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => {
                                    setDateFilter(filter);
                                    if (filter !== "custom") {
                                        setStartDate("");
                                        setEndDate("");
                                    }
                                }}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap cursor-pointer",
                                    dateFilter === filter 
                                        ? "bg-white text-slate-900 shadow-sm shadow-slate-200" 
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                {filter === "all" ? "All Time" : filter === "day" ? "Today" : filter === "custom" ? "Custom Range" : `This ${filter}`}
                            </button>
                        ))}
                    </div>
                </div>

                {dateFilter === "custom" && (
                    <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-100 rounded-[1.5rem] p-4 shadow-sm animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">From:</span>
                            <input 
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">To:</span>
                            <input 
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button 
                                type="button" 
                                onClick={() => { setStartDate(""); setEndDate(""); }}
                                className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
                            >
                                Clear Dates
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Standard Sales Ledger */}
            {viewMode === "sales" ? (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-sm">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[850px]">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 pl-8 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Items</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Type</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Total</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Paid</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center pr-8">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredSales.map(s => {
                                    const customer = customers.find(c => c.id === s.customerId);
                                    const isFullyReturned = s.total <= 0;

                                    return (
                                        <tr key={s.id} className={cn("hover:bg-slate-50/50 transition-colors", isFullyReturned && "bg-slate-50/50 opacity-60 text-slate-400")}>
                                            <td className="p-4 pl-8 text-slate-500">{formatDate(s.date)}</td>
                                            <td className="p-4 font-bold text-slate-800">{s.customerName || customer?.name || "Walk-in"}</td>
                                            <td className="p-4 text-slate-500 max-w-[200px] truncate" title={s.items.map(i => `${i.name} (x${i.quantity})`).join(", ")}>
                                                {s.items.map(i => i.name).join(", ")}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={cn(
                                                    "text-[10px] uppercase font-bold px-2 py-1 rounded-md",
                                                    s.paymentType === "cash" ? "bg-green-100 text-green-700" :
                                                    s.paymentType === "credit" ? "bg-red-100 text-red-700" :
                                                    "bg-blue-100 text-blue-700"
                                                )}>
                                                    {s.paymentType.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(s.total)}</td>
                                            <td className="p-4 text-right text-slate-500">
                                                {formatCurrency(s.amountPaid)}
                                                {(s as any).returnedAmount > 0 && (
                                                    <span className="block text-[9px] text-red-500 font-bold">
                                                        (Ret: -{formatCurrency((s as any).returnedAmount)})
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center pr-8">
                                                {userRole === "admin" && (
                                                    <button 
                                                        type="button"
                                                    onClick={() => {
                                                        setSelectedSaleForReturn(s);
                                                        const initialQtys: Record<string, number> = {};
                                                        s.items.forEach(it => {
                                                            initialQtys[it.id] = 0;
                                                        });
                                                        setReturnQuantities(initialQtys);
                                                    }}
                                                    disabled={isFullyReturned}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold cursor-pointer transition-all shrink-0"
                                                >
                                                    <Undo2 size={12} />
                                                    Return Goods
                                                </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-100 font-bold">
                                <tr>
                                    <td className="p-4 pl-8 text-slate-700 text-sm font-black" colSpan={4}>
                                        Total for {dateFilter === "all" ? "All Time" : dateFilter === "day" ? "Today" : dateFilter === "week" ? "This Week" : dateFilter === "month" ? "This Month" : dateFilter === "year" ? "This Year" : "Selected Range"}
                                    </td>
                                    <td className="p-4 text-right text-slate-900 text-sm font-black whitespace-nowrap">{formatCurrency(totalSalesAmount)}</td>
                                    <td className="p-4 text-right text-slate-900 text-sm font-black whitespace-nowrap">{formatCurrency(totalPaidAmount)}</td>
                                    <td className="p-4 pr-8 text-center"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {filteredSales.length === 0 && (
                        <div className="p-12 text-center text-slate-400">
                            <p>No sales records match the selection.</p>
                        </div>
                    )}
                </div>
            ) : (
                /* Returns Audit Ledgers */
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-sm animate-in fade-in duration-300">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left min-w-[850px]">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 pl-8 text-xs font-bold text-slate-400 uppercase tracking-widest">Date & Time</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Return ID</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Returned Products</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Original Billing</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Value Offset</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center pr-8">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredReturns.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 pl-8 text-slate-500 font-medium">{formatDate(r.date)} {new Date(r.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                        <td className="p-4 font-mono text-xs text-slate-400" title={r.id}>{r.id.split('-')[0].toUpperCase()}</td>
                                        <td className="p-4 font-bold text-slate-800">{r.customerName || "Walk-in"}</td>
                                        <td className="p-4 text-slate-600">
                                            <div className="flex flex-col gap-1">
                                                {r.items.map((it: any) => (
                                                    <span key={it.id} className="text-xs text-slate-500 font-semibold">
                                                        {it.name} <span className="text-red-500 font-bold">x{it.quantity}</span> @ {formatCurrency(it.price)}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={cn(
                                                "text-[10px] uppercase font-bold px-2 py-1 rounded-md",
                                                r.paymentType === "cash" ? "bg-green-100 text-green-700" :
                                                r.paymentType === "credit" ? "bg-red-100 text-red-700" :
                                                "bg-blue-100 text-blue-700"
                                            )}>
                                                {r.paymentType?.replace('_', ' ') || "N/A"}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-black text-rose-600">-{formatCurrency(r.totalAmount)}</td>
                                        <td className="p-4 text-center pr-8">
                                            <span className={cn(
                                                "text-[9px] uppercase font-bold px-2.5 py-1.5 rounded-lg border",
                                                r.paymentType === "credit" 
                                                    ? "bg-amber-50 text-amber-600 border-amber-100" 
                                                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            )}>
                                                {r.paymentType === "credit" ? "Credit Cleared" : "Amount Cleared"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredReturns.length === 0 && (
                        <div className="p-12 text-center text-slate-400">
                            <p>No records of returned goods found for this selection.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Goods Return Dialog Modal */}
            <AnimatePresence>
                {selectedSaleForReturn && (
                    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Process Goods Return</h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Sale ID: {selectedSaleForReturn.id} | Customer: <span className="font-bold text-slate-700">{selectedSaleForReturn.customerName}</span>
                                    </p>
                                </div>
                                <button 
                                    onClick={() => { setSelectedSaleForReturn(null); setReturnQuantities({}); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-slate-50/50 p-4 space-y-4">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wide px-2 pb-2 border-b border-slate-100">
                                    <span className="flex-1">Item Description</span>
                                    <span className="w-24 text-right">Price</span>
                                    <span className="w-32 text-center">Purchased / Ret.</span>
                                    <span className="w-36 text-center">Qty to Return</span>
                                </div>
                                
                                {selectedSaleForReturn.items.map((item) => {
                                    const alreadyReturned = item.returnedQuantity || 0;
                                    const maxReturnable = item.quantity - alreadyReturned;
                                    const toReturn = returnQuantities[item.id] || 0;

                                    return (
                                        <div key={item.id} className="flex items-center justify-between text-sm py-3 px-2">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="font-bold text-slate-800 truncate">{item.name}</p>
                                                {alreadyReturned > 0 && (
                                                    <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                                        Already returned: {alreadyReturned} units
                                                    </p>
                                                )}
                                            </div>
                                            <div className="w-24 text-right text-slate-600 font-medium">
                                                {formatCurrency(item.price)}
                                            </div>
                                            <div className="w-32 text-center text-xs text-slate-500 font-semibold">
                                                {item.quantity} units / <span className="text-amber-600 font-bold">{alreadyReturned}</span>
                                            </div>
                                            <div className="w-36 flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReturnQuantities(prev => ({
                                                            ...prev,
                                                            [item.id]: Math.max(0, toReturn - 1)
                                                        }));
                                                    }}
                                                    disabled={toReturn <= 0}
                                                    className="w-7 h-7 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center justify-center text-lg font-bold shadow-sm cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <span className="w-10 text-center font-bold text-slate-800">
                                                    {toReturn}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReturnQuantities(prev => ({
                                                            ...prev,
                                                            [item.id]: Math.min(maxReturnable, toReturn + 1)
                                                        }));
                                                    }}
                                                    disabled={toReturn >= maxReturnable}
                                                    className="w-7 h-7 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center justify-center text-lg font-bold shadow-sm cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Calculations & Feedback */}
                            {(() => {
                                const totalRefundValue = selectedSaleForReturn.items.reduce((acc, item) => {
                                    const toReturn = returnQuantities[item.id] || 0;
                                    return acc + (toReturn * item.price);
                                }, 0);

                                return (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                                            <div>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Total Return Value</p>
                                                <p className="text-2xl font-black text-blue-600 mt-1">{formatCurrency(totalRefundValue)}</p>
                                            </div>
                                            <div className="text-right max-w-sm">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Account Resolution</p>
                                                {selectedSaleForReturn.paymentType === "credit" ? (
                                                    <p className="text-xs text-slate-600 mt-1 font-bold">
                                                        Will clear up to <span className="text-red-500">{formatCurrency(totalRefundValue)}</span> from customer's outstanding balance credit.
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-slate-600 mt-1 font-bold">
                                                        Will reduce sale volume and adjust cash flow total by <span className="text-green-600">{formatCurrency(totalRefundValue)}</span>.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={handleSubmitReturn}
                                                disabled={totalRefundValue <= 0}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all text-center flex items-center justify-center gap-2"
                                            >
                                                <Undo2 size={18} />
                                                Process Goods Return
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedSaleForReturn(null); setReturnQuantities({}); }}
                                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 px-6 rounded-2xl cursor-pointer transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function AdminView({ user, refresh, userRole, userPermissions, license }: { user: any, refresh: () => void | Promise<void>, userRole?: string, userPermissions?: UserPermissions, license?: License, key?: string }) {
    const [activeSubTab, setActiveSubTab] = useState("general");
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [generatedKey, setGeneratedKey] = useState("");
    const [keyType, setKeyType] = useState("TRIAL");

    const handleGenerateKey = async () => {
        const res = await fetch("/api/admin/generate-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: keyType, password: "genesys_admin_key_gen_2026" }),
        });
        const data = await res.json();
        if (data.key) setGeneratedKey(data.key);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await fetch("/api/admin/export");
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `genesys_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = ev.target?.result as string;
            const res = await fetch("/api/admin/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: content,
            });
            if (res.ok) {
                alert("Data imported successfully! App will reload.");
                window.location.reload();
            }
        };
        reader.readAsText(file);
    };

    if (userRole !== "admin" && !userPermissions?.admin.view) return <div>Access Denied. Admins only.</div>;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
                    <p className="text-slate-500">System maintenance and user management</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border border-slate-100 flex-wrap gap-1">
                    <button onClick={() => setActiveSubTab("general")} className={cn("px-4 py-2 rounded-xl font-bold transition-all", activeSubTab === "general" ? "bg-slate-900 text-white" : "text-slate-400")}>General</button>
                    {userPermissions?.admin.users && (
                         <button onClick={() => setActiveSubTab("users")} className={cn("px-4 py-2 rounded-xl font-bold transition-all", activeSubTab === "users" ? "bg-slate-900 text-white" : "text-slate-400")}>Users</button>
                    )}
                    {userPermissions?.admin.settings && (
                         <button onClick={() => setActiveSubTab("data")} className={cn("px-4 py-2 rounded-xl font-bold transition-all", activeSubTab === "data" ? "bg-slate-900 text-white" : "text-slate-400")}>Data</button>
                    )}
                    {user?.username === "genesys_owner" && (
                         <button onClick={() => setActiveSubTab("customers")} className={cn("px-4 py-2 rounded-xl font-bold transition-all", activeSubTab === "customers" ? "bg-slate-900 text-white" : "text-slate-400")}>License Tracker</button>
                    )}
                </div>
            </header>

            {activeSubTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-xl font-bold text-slate-800">System Information</h3>
                        <div className="space-y-4 text-sm font-medium">
                            <div className="flex justify-between border-b border-slate-50 pb-3">
                                <span className="text-slate-400">Software Variant</span>
                                <span className="text-slate-800 font-bold">Genesys PRO</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-50 pb-3">
                                <span className="text-slate-400">License Type</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] uppercase font-black",
                                    license?.type === "TRIAL" ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"
                                )}>
                                    {license?.type === "TRIAL" ? "Trial Version" : (license?.type || "Standard")}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-50 pb-3">
                                <span className="text-slate-400">Expiry Date</span>
                                <span className={cn(
                                    "text-slate-800 font-bold",
                                    license?.expiresAt && new Date(license.expiresAt).getTime() < Date.now() + (7 * 24 * 60 * 60 * 1000) ? "text-red-500" : ""
                                )}>
                                    {license?.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-50 pb-3">
                                <span className="text-slate-400">Build Info</span>
                                <span className="text-slate-500">v2.4.0 (2026-MAY)</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-8 rounded-[2rem] flex gap-4">
                        <ShieldCheck className="text-blue-600 shrink-0" size={32} />
                        <div className="text-sm text-blue-800 space-y-2">
                            <p className="text-lg font-bold">Admin Privileges Active</p>
                            <p>You are operating with administrative rights. Be careful when modifying system users or importing large datasets as these actions are irreversible.</p>
                        </div>
                    </div>

                    {user?.username === "genesys_owner" && (
                         <div className="md:col-span-2 bg-slate-900 p-8 rounded-[2rem] text-white space-y-6">
                            <div className="flex items-center gap-4">
                                <ShieldCheck size={24} className="text-blue-400" />
                                <h3 className="text-xl font-bold">Genesys Key Generator</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end font-sans">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Key Category</label>
                                    <select 
                                      value={keyType}
                                      onChange={(e) => setKeyType(e.target.value)}
                                      className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-white"
                                    >
                                        <option value="TRIAL">Trial (7 Days)</option>
                                        <option value="3MONTH">3 Months</option>
                                        <option value="6MONTH">6 Months</option>
                                        <option value="1YEAR">1 Year</option>
                                        <option value="2YEAR">2 Years</option>
                                    </select>
                                </div>
                                <button 
                                    onClick={handleGenerateKey}
                                    className="bg-blue-600 hover:bg-blue-700 p-3 rounded-xl font-bold transition-all"
                                >
                                    Generate New Key
                                </button>
                                {generatedKey && (
                                    <div className="bg-slate-800 p-3 rounded-xl font-mono text-blue-400 border border-blue-500/30 text-center select-all">
                                        {generatedKey}
                                    </div>
                                )}
                            </div>
                         </div>
                    )}
                </div>
            )}

            {activeSubTab === "users" && <UserManagementView currentUser={user} />}

            {activeSubTab === "data" && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                 <Download size={24} />
                            </div>
                            <div>
                                 <h3 className="text-xl font-bold text-slate-800">Export Data</h3>
                                 <p className="text-sm text-slate-400">Download system state for backup or migration</p>
                            </div>
                        </div>
                        <button 
                          onClick={handleExport}
                          disabled={exporting}
                          className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
                        >
                            {exporting ? "Generating..." : "Download JSON Backup"}
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                                 <Upload size={24} />
                            </div>
                            <div>
                                 <h3 className="text-xl font-bold text-slate-800">Import Data</h3>
                                 <p className="text-sm text-slate-400">Restore system state from a JSON backup</p>
                            </div>
                        </div>
                        <div className="relative">
                            <input 
                              type="file" 
                              accept=".json" 
                              onChange={handleImport}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            />
                            <div className="w-full bg-slate-50 border-2 border-dashed border-slate-200 p-4 rounded-2xl text-center text-slate-400 font-bold hover:border-blue-400 hover:text-blue-400 transition-all">
                                {importing ? "Importing..." : "Click to select backup file"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === "customers" && <RegisteredCustomersView currentUser={user} />}
        </motion.div>
    );
}

function RegisteredCustomersView({ currentUser }: { currentUser: User | null }) {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRegistrations = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/central/registrations", {
                headers: {
                    "X-User": currentUser?.username || ""
                }
            });
            if (res.ok) {
                const data = await res.json();
                setRegistrations(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const getRemainingDays = (expiryStr: string) => {
        const expiry = new Date(expiryStr).getTime();
        const now = new Date().getTime();
        const diff = expiry - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const getStatusBadge = (expiryStr: string) => {
        const days = getRemainingDays(expiryStr);
        if (days <= 0) {
            return <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase">Expired</span>;
        } else if (days <= 7) {
            return <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase">Expiring ({days}d)</span>;
        } else {
            return <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">Active ({days}d)</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                 <div>
                     <h2 className="text-xl font-bold text-slate-800">License Tracker</h2>
                     <p className="text-xs text-slate-400 font-medium">Live status and durations of all activated Genesys customer installations</p>
                 </div>
                 <button 
                     onClick={fetchRegistrations}
                     className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2"
                 >
                     <RotateCcw size={14} /> Refresh Tracker
                 </button>
            </div>

            {loading ? (
                <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    Retrieving customer registries...
                </div>
            ) : registrations.length === 0 ? (
                <div className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center text-slate-400">
                    No activated customer instances have connected to this server yet.
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-4 pl-6 text-xs font-bold text-slate-400 uppercase">Customer Business</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">License Key</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Type</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center">Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Duration & Expiry</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center">Staff Count</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {registrations.map((reg) => (
                                    <tr key={reg.licenseKey} className="hover:bg-slate-50/50">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-slate-800">{reg.businessName}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{reg.domain || 'Local Instance'}</div>
                                        </td>
                                        <td className="p-4 font-mono text-xs text-slate-600 select-all">
                                            {reg.licenseKey}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                                                {reg.licenseType}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            {getStatusBadge(reg.expiresAt)}
                                        </td>
                                        <td className="p-4 text-xs">
                                            <div className="text-slate-700 font-semibold">
                                                Expires: {new Date(reg.expiresAt).toLocaleDateString()}
                                            </div>
                                            <div className="text-slate-400 mt-0.5">
                                                Activated: {new Date(reg.activatedAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-bold text-slate-700">
                                            {reg.activeUsersCount || 1}
                                        </td>
                                        <td className="p-4 text-xs text-slate-400">
                                            {new Date(reg.lastPingAt || reg.activatedAt).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

const DEFAULT_PERMISSIONS: UserPermissions = {
    inventory: { view: true, create: false, edit: false, delete: false },
    customers: { view: true, create: true, edit: false, delete: false },
    sales: { view: true, create: true, history: false },
    credit: { view: true, payment: false },
    admin: { view: false, users: false, settings: false },
};

function UserManagementView({ currentUser }: { currentUser: User | null }) {
    const [users, setUsers] = useState<User[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form, setForm] = useState({ 
        username: "", 
        password: "", 
        fullName: "", 
        role: "user" as "user" | "admin" | "manager",
        permissions: DEFAULT_PERMISSIONS
    });

    const fetchUsers = async () => {
        const res = await fetch("/api/users", {
            headers: {
                "X-User": currentUser?.username || ""
            }
        });
        setUsers(await res.json());
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleSubmit = async () => {
        const method = editingUser ? "PUT" : "POST";
        const url = editingUser ? `/api/users/${editingUser.username}` : "/api/users";
        
        const res = await fetch(url, {
            method,
            headers: { 
                "Content-Type": "application/json",
                "X-User": currentUser?.username || ""
            },
            body: JSON.stringify(form),
        });

        if (res.ok) {
            setShowModal(false);
            setEditingUser(null);
            fetchUsers();
            alert("User updated successfully");
        } else {
            const err = await res.json();
            alert(err.error);
        }
    };

    const togglePermission = (path: string) => {
        const parts = path.split('.');
        const newPermissions = JSON.parse(JSON.stringify(form.permissions || DEFAULT_PERMISSIONS));
        let curr = newPermissions;
        for (let i = 0; i < parts.length - 1; i++) curr = curr[parts[i]];
        curr[parts[parts.length - 1]] = !curr[parts[parts.length - 1]];
        setForm({ ...form, permissions: newPermissions });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-slate-800">System Users</h2>
                 <button onClick={() => {
                     setEditingUser(null);
                     setForm({ 
                        username: "", password: "", fullName: "", role: "user",
                        permissions: DEFAULT_PERMISSIONS
                     });
                     setShowModal(true);
                 }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700">
                     <Plus size={18} /> New User
                 </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 pl-6 text-xs font-bold text-slate-400 uppercase">User</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase text-center">Role</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase">Capabilities</th>
                            <th className="p-4 text-right pr-6 text-xs font-bold text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users
                            .filter(u => currentUser?.username === "genesys_owner" || u.username !== "genesys_owner")
                            .map(u => (
                            <tr key={u.username} className="hover:bg-slate-50">
                                <td className="p-4 pl-6">
                                    <div className="font-bold text-slate-800">{u.fullName}</div>
                                    <div className="text-xs text-slate-400">@{u.username}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                                        u.role === "admin" ? "bg-red-100 text-red-600" :
                                        u.role === "manager" ? "bg-blue-100 text-blue-600" :
                                        "bg-green-100 text-green-600"
                                    )}>{u.role}</span>
                                </td>
                                <td className="p-4 space-x-1">
                                    {u.permissions?.inventory.create && <span title="Inventory Write" className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>}
                                    {u.permissions?.sales.create && <span title="POS Sales" className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>}
                                    {u.permissions?.admin.users && <span title="User Management" className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>}
                                </td>
                                <td className="p-4 text-right pr-6">
                                    <button onClick={() => {
                                        setEditingUser(u);
                                        // Merge existing permissions with defaults to prevent crashes
                                        const mergedPermissions = {
                                            ...DEFAULT_PERMISSIONS,
                                            ...(u.permissions || {}),
                                            inventory: { ...DEFAULT_PERMISSIONS.inventory, ...(u.permissions?.inventory || {}) },
                                            customers: { ...DEFAULT_PERMISSIONS.customers, ...(u.permissions?.customers || {}) },
                                            sales: { ...DEFAULT_PERMISSIONS.sales, ...(u.permissions?.sales || {}) },
                                            credit: { ...DEFAULT_PERMISSIONS.credit, ...(u.permissions?.credit || {}) },
                                            admin: { ...DEFAULT_PERMISSIONS.admin, ...(u.permissions?.admin || {}) },
                                        };
                                        setForm({ ...form as any, ...u, password: "", permissions: mergedPermissions });
                                        setShowModal(true);
                                    }} className="text-blue-500 hover:underline font-bold mr-3">Edit Privileges</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl space-y-6 max-h-[90vh] overflow-auto">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-slate-900">{editingUser ? "Edit Privileges" : "Create New User"}</h2>
                                <button onClick={() => setShowModal(false)} className="p-2 border rounded-full hover:bg-slate-50"><X size={18} /></button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                    <input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
                                    <input disabled={!!editingUser} value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl disabled:opacity-50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={editingUser ? "Leave blank to keep current" : ""} className="w-full p-3 bg-slate-50 border rounded-xl" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Base Role</label>
                                    <select value={form.role} onChange={e => setForm({...form, role: e.target.value as any})} className="w-full p-3 bg-slate-50 border rounded-xl">
                                        <option value="user">User</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-800 border-b pb-2">Granular Permissions</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    {/* Inventory */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-blue-600 uppercase">Inventory</p>
                                        {Object.keys(form.permissions?.inventory || DEFAULT_PERMISSIONS.inventory).map(perm => (
                                            <label key={`inv-${perm}`} className="flex items-center gap-2 cursor-pointer transition-all hover:bg-slate-50 p-1 rounded">
                                                <input type="checkbox" checked={((form.permissions?.inventory || DEFAULT_PERMISSIONS.inventory) as any)[perm]} onChange={() => togglePermission(`inventory.${perm}`)} className="rounded text-blue-600" />
                                                <span className="text-xs capitalize">{perm}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {/* Customers */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-blue-600 uppercase">Customers</p>
                                        {Object.keys(form.permissions?.customers || DEFAULT_PERMISSIONS.customers).map(perm => (
                                            <label key={`cust-${perm}`} className="flex items-center gap-2 cursor-pointer transition-all hover:bg-slate-50 p-1 rounded">
                                                <input type="checkbox" checked={((form.permissions?.customers || DEFAULT_PERMISSIONS.customers) as any)[perm]} onChange={() => togglePermission(`customers.${perm}`)} className="rounded text-blue-600" />
                                                <span className="text-xs capitalize">{perm}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {/* Sales */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-blue-600 uppercase">Sales & History</p>
                                        {Object.keys(form.permissions?.sales || DEFAULT_PERMISSIONS.sales).map(perm => (
                                            <label key={`sales-${perm}`} className="flex items-center gap-2 cursor-pointer transition-all hover:bg-slate-50 p-1 rounded">
                                                <input type="checkbox" checked={((form.permissions?.sales || DEFAULT_PERMISSIONS.sales) as any)[perm]} onChange={() => togglePermission(`sales.${perm}`)} className="rounded text-blue-600" />
                                                <span className="text-xs capitalize">{perm}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {/* Admin */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-red-600 uppercase">System Admin</p>
                                        {Object.keys(form.permissions?.admin || DEFAULT_PERMISSIONS.admin).map(perm => (
                                            <label key={`adm-${perm}`} className="flex items-center gap-2 cursor-pointer transition-all hover:bg-slate-50 p-1 rounded">
                                                <input type="checkbox" checked={((form.permissions?.admin || DEFAULT_PERMISSIONS.admin) as any)[perm]} onChange={() => togglePermission(`admin.${perm}`)} className="rounded text-blue-600" />
                                                <span className="text-xs capitalize">{perm}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleSubmit} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-black transition-all">
                                {editingUser ? "Save Privileges" : "Create User Account"}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
