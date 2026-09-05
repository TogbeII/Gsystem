import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  Download, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Info,
  Sparkles,
  ShoppingBag,
  Warehouse,
  Users,
  FileText,
  ScanLine,
  CreditCard,
  ShieldCheck,
  Package,
  Undo2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "../lib/utils";

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
}

interface ManualStep {
  id: string;
  title: string;
  shortDesc: string;
  category: string;
  iconName: string;
  instructions: string[];
  tips: string[];
  callouts: { number: number; label: string; x: number; y: number; targetX: number; targetY: number }[];
  drawDiagram: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function UserManualModal({ isOpen, onClose, businessName = "Genesys Sales & Inventory" }: UserManualModalProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 10 Detailed, Authentic System Steps matching actual UI & Fields
  const steps: ManualStep[] = [
    {
      id: "license_activation",
      title: "Step 1: License Activation (System Gate)",
      shortDesc: "Unlocking your system with your purchased software license key.",
      category: "Getting Started",
      iconName: "ShieldCheck",
      instructions: [
        "Launch the Genesys application in your web browser or desktop window.",
        "You will see the dark System Gate screen with the title 'Welcome to Genesys'.",
        "In the 'Enter License Key' box, paste or type your purchased License Key (e.g. GENESYS-TRIAL or GENESYS-XXXX-XXXX-XXXX).",
        "Click the black 'Activate Now' button to verify your license.",
        "Once verified, the system unlocks immediately and proceeds to Initial Setup."
      ],
      tips: [
        "Your license key is tied to your store data and provides multi-tenant data isolation.",
        "Trial licenses show a 30-day banner. Upgrading to a 1-Year or Lifetime license preserves all your products and records."
      ],
      callouts: [
        { number: 1, label: "Enter License Key (e.g. GENESYS-XXXX...)", x: 130, y: 195, targetX: 280, targetY: 190 },
        { number: 2, label: "Click 'Activate Now' button", x: 620, y: 245, targetX: 470, targetY: 240 }
      ],
      drawDiagram: (ctx, w, h) => {
        // Dark background matching SystemGate
        ctx.fillStyle = "#090d16";
        drawRoundedRect(ctx, 0, 0, w, h, 14);
        ctx.fill();

        // Ambient blue glow
        const glow = ctx.createRadialGradient(w - 100, 60, 10, w - 100, 60, 200);
        glow.addColorStop(0, "rgba(59, 130, 246, 0.25)");
        glow.addColorStop(1, "rgba(9, 13, 22, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        // Center card
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 190, 30, 400, 260, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        // Blue Logo icon
        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 220, 50, 36, 36, 10);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("G", 238, 76);
        ctx.textAlign = "left";

        // Card header text
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 15px sans-serif";
        ctx.fillText("Welcome to Genesys", 270, 65);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Enter your license key to activate your dedicated space.", 270, 80);

        // License Key Input Box
        ctx.fillStyle = "#475569";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("ENTER LICENSE KEY", 220, 115);

        ctx.fillStyle = "#f8fafc";
        drawRoundedRect(ctx, 220, 125, 340, 42, 10);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px monospace";
        ctx.fillText("GENESYS-TRIAL", 235, 151);

        // Activate Now Button
        ctx.fillStyle = "#0f172a";
        drawRoundedRect(ctx, 220, 185, 340, 44, 12);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Activate Now", 390, 212);
        ctx.textAlign = "left";

        // Footer subtext
        ctx.fillStyle = "#2563eb";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Already activated? Sign In instead", 390, 255);
        ctx.textAlign = "left";
      }
    },
    {
      id: "initial_setup",
      title: "Step 2: Business Setup & Administrator Account",
      shortDesc: "Setting your store name and creating the master administrator login.",
      category: "Getting Started",
      iconName: "ShieldCheck",
      instructions: [
        "After activation, the 'Initial Setup' card opens automatically.",
        "Enter your real Store or Business Name (e.g. 'Safety Pro Ghana Ltd'). This name appears automatically on all receipts and invoices.",
        "Click the black 'Confirm & Continue' button.",
        "Next, the 'Create Admin Account' screen appears.",
        "Enter your Full Name, choose an Admin Username (e.g. 'admin'), and set a secure Password.",
        "Click 'Create Administrator' to log in and open your active Dashboard."
      ],
      tips: [
        "You only do this once during initial setup.",
        "Your Business Name can also be updated later from the Admin Panel if your business details change."
      ],
      callouts: [
        { number: 1, label: "Enter Business Name (e.g. Safety Pro Ghana)", x: 80, y: 150, targetX: 200, targetY: 140 },
        { number: 2, label: "Click 'Confirm & Continue'", x: 80, y: 220, targetX: 230, targetY: 200 },
        { number: 3, label: "Enter Admin Username & Password", x: 670, y: 130, targetX: 520, targetY: 135 },
        { number: 4, label: "Click 'Create Administrator'", x: 670, y: 240, targetX: 540, targetY: 225 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Genesys — Initial Setup & Admin Account");

        // Left Card: Business Setup
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 40, 50, 330, 235, 16);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 60, 68, 28, 28, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("1", 74, 87);
        ctx.textAlign = "left";

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("Initial Setup", 98, 80);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Provide your business details to continue.", 98, 95);

        drawInput(ctx, 60, 115, 290, "Business Name", "Safety Pro Ghana Ltd");

        ctx.fillStyle = "#0f172a";
        drawRoundedRect(ctx, 60, 185, 290, 40, 10);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Confirm & Continue", 205, 210);
        ctx.textAlign = "left";

        // Right Card: Admin Account Setup
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 410, 50, 330, 235, 16);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#10b981";
        drawRoundedRect(ctx, 430, 68, 28, 28, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("2", 444, 87);
        ctx.textAlign = "left";

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("Create Admin Account", 468, 80);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Set up master credentials.", 468, 95);

        drawInput(ctx, 430, 110, 290, "Full Name", "Kwame Mensah");
        drawInput(ctx, 430, 150, 135, "Username", "admin");
        drawInput(ctx, 580, 150, 140, "Password", "••••••••••••");

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 430, 205, 290, 40, 10);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Create Administrator", 575, 230);
        ctx.textAlign = "left";
      }
    },
    {
      id: "shop_stock",
      title: "Step 3: Registering Products & Adding Shop Stock",
      shortDesc: "Adding new products, setting selling prices, inputting counter stock, and spooling inventory reports.",
      category: "Shop Inventory",
      iconName: "Package",
      instructions: [
        "Click 'Shop Inventory' from the left sidebar navigation.",
        "In the top right of the inventory header, click the blue '+ Register New Product' button.",
        "Under 'Product Information', enter the Product Name (e.g. 'Safety Vest Hi-Vis Orange').",
        "Select Category from the dropdown or click 'New' to add a custom category (e.g. Safety Boots, Helmets).",
        "Type or scan the Barcode / UPC (or enter SKU). A live Barcode graphic renders in real time!",
        "Set the Selling Price in Ghana Cedis (Price GH₵).",
        "Under 'Level 1: Shop Stock', enter Current Shop Stock (units ready on the shelf for immediate counter sale).",
        "Under 'Level 2: Warehouse Stock', enter Bulk storage quantity if you have backroom stock.",
        "Click the big blue 'Register Product' button to save.",
        "Spooling Inventory Reports: In the top header, click the 'Download PDF' icon to spool an official Shop Inventory Report, or click 'Export Excel' to spool all products, categories, stock counts, and total inventory valuation to spreadsheet."
      ],
      tips: [
        "Shop Stock is what is decremented when you make sales at the POS counter.",
        "Data Spooling: Spooling to PDF includes company headers and total inventory valuation (GH₵), ideal for tax compliance and stocktaking audits."
      ],
      callouts: [
        { number: 1, label: "Click '+ Add Product'", x: 620, y: 70, targetX: 670, targetY: 65 },
        { number: 2, label: "Product Name & Category", x: 120, y: 140, targetX: 280, targetY: 130 },
        { number: 3, label: "Barcode with Live Preview", x: 620, y: 155, targetX: 470, targetY: 150 },
        { number: 4, label: "Level 1: Current Shop Stock", x: 120, y: 220, targetX: 280, targetY: 215 },
        { number: 5, label: "Click 'Register Product'", x: 620, y: 275, targetX: 460, targetY: 265 },
        { number: 6, label: "Spool Data: PDF & Excel buttons", x: 440, y: 35, targetX: 500, targetY: 46 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Shop Inventory — Register Product & Spool Data");

        // Background Inventory Header
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 35, w, 40);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, w, 40);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Shop Inventory", 30, 60);

        // Header spooling buttons (matching real App.tsx)
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 470, 44, 28, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("PDF", 475, 61);

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 504, 44, 42, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#16a34a";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Excel", 510, 61);

        // Barcode Studio button
        ctx.fillStyle = "#eff6ff";
        drawRoundedRect(ctx, 552, 44, 58, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#bfdbfe";
        ctx.stroke();
        ctx.fillStyle = "#1d4ed8";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Studio", 564, 61);

        // Header Add button
        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 616, 44, 134, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("+ Add Product", 645, 61);

        // Modal Box
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 160, 80, 460, 215, 14);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Register New Product", 185, 104);

        // Row 1: Name & Category
        drawInput(ctx, 185, 114, 210, "Product Name", "Safety Vest Hi-Vis Orange");
        drawInput(ctx, 405, 114, 195, "Category", "Safety Vests");

        // Row 2: SKU, Barcode, Price
        drawInput(ctx, 185, 150, 100, "SKU", "VEST-HV-01");
        drawInput(ctx, 295, 150, 170, "Barcode / UPC", "2026880012");
        drawInput(ctx, 475, 150, 125, "Price (GH₵)", "45.00");

        // Blue Container: Level 1 Shop Stock
        ctx.fillStyle = "#eff6ff"; // blue-50
        drawRoundedRect(ctx, 185, 190, 205, 52, 8);
        ctx.fill();
        ctx.strokeStyle = "#bfdbfe";
        ctx.stroke();

        ctx.fillStyle = "#1d4ed8";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("LEVEL 1: SHOP STOCK", 195, 204);
        ctx.fillStyle = "#1e40af";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Current Shop Stock: 50 units", 195, 222);
        ctx.fillStyle = "#3b82f6";
        ctx.font = "8px sans-serif";
        ctx.fillText("Qty available for sale at counter", 195, 234);

        // Amber Container: Level 2 Warehouse Stock
        ctx.fillStyle = "#fef3c7"; // amber-50
        drawRoundedRect(ctx, 400, 190, 200, 52, 8);
        ctx.fill();
        ctx.strokeStyle = "#fde68a";
        ctx.stroke();

        ctx.fillStyle = "#b45309";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("LEVEL 2: WAREHOUSE STOCK", 410, 204);
        ctx.fillStyle = "#92400e";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Warehouse Stock: 200 items", 410, 222);
        ctx.fillStyle = "#d97706";
        ctx.font = "8px sans-serif";
        ctx.fillText("Bulk backroom storage quantity", 410, 234);

        // Submit button
        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 185, 252, 415, 30, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Register Product", 392, 271);
        ctx.textAlign = "left";
      }
    },
    {
      id: "warehouse_stock",
      title: "Step 4: Adding Warehouse Stock & Stock Transfers",
      shortDesc: "Managing bulk carton inventory, transferring stock to the shop floor, and spooling warehouse reports.",
      category: "Warehouse",
      iconName: "Warehouse",
      instructions: [
        "Click 'Warehouse Stock' from the left navigation sidebar.",
        "To add new incoming bulk shipments, click '+ Add to Warehouse'. Set Bulk Unit Name (e.g. Box, Sack) and Items per Box (e.g. 24 pcs).",
        "The inventory table shows both: 'Warehouse Storage' (Boxes & pieces) and 'Shop Floor' (current counter stock).",
        "To restock the shop, click the blue '⇄ Transfer to Shop' button on that product row.",
        "In the transfer modal, choose either: 'Bulk Transfer (Boxes)' or 'Loose Units (Items)'.",
        "Enter the quantity to move (e.g. 2 Boxes = 48 pcs) and click 'Complete Transfer'.",
        "The system immediately deducts from warehouse storage and replenishes the shop counter stock automatically!",
        "Spooling Bulk Stock: Click the 'Download PDF' icon in the top header for a printable bulk inventory audit, or click 'Export Excel' to spool all warehouse cartons, packaging quantities, and loose unit conversions to spreadsheet."
      ],
      tips: [
        "No duplicate entries required! Transferring connects directly with the existing product in your shop.",
        "Data Spooling: Spooling warehouse data to Excel allows warehouse managers to reconcile physical carton and pallet counts directly against digital container logs."
      ],
      callouts: [
        { number: 1, label: "Click '+ Add to Warehouse'", x: 120, y: 70, targetX: 250, targetY: 65 },
        { number: 2, label: "Warehouse Storage vs Shop Floor counts", x: 120, y: 150, targetX: 320, targetY: 135 },
        { number: 3, label: "Click '⇄ Transfer to Shop'", x: 640, y: 130, targetX: 680, targetY: 135 },
        { number: 4, label: "Choose Bulk Boxes / Loose & Confirm", x: 640, y: 240, targetX: 520, targetY: 220 },
        { number: 5, label: "Spool Data: PDF & Excel buttons", x: 440, y: 35, targetX: 500, targetY: 46 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Warehouse Stock Management & Shop Restocking");

        // Top Header
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 35, w, 40);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, w, 40);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Warehouse Inventory", 30, 60);

        // Header Spooling buttons
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 430, 44, 28, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("PDF", 435, 61);

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 464, 44, 42, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#16a34a";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Excel", 470, 61);

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 514, 44, 135, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("+ Add to Warehouse", 524, 61);

        ctx.fillStyle = "#fef3c7";
        drawRoundedRect(ctx, 655, 44, 85, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#b45309";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("📦 Bulk Active", 663, 61);

        // Table Header
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(30, 85, 720, 26);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(30, 85, 720, 26);

        ctx.fillStyle = "#64748b";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("ITEM NAME", 45, 101);
        ctx.fillText("CATEGORY", 230, 101);
        ctx.fillText("WAREHOUSE STORAGE", 360, 101);
        ctx.fillText("SHOP FLOOR", 515, 101);
        ctx.fillText("ACTION", 650, 101);

        // Row 1
        drawWhRow(ctx, 115, "Safety Boots Heavy Duty", "20 Boxes (240 pcs)", "12 pairs", true);
        drawWhRow(ctx, 150, "Hi-Vis Reflective Jackets", "15 Sacks (300 pcs)", "35 pcs", false);
        drawWhRow(ctx, 185, "Industrial Safety Helmets", "10 Cartons (200 pcs)", "8 pcs", false);

        // Transfer modal overlay mock
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 240, 140, 350, 145, 12);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("Transfer to Shop Floor", 260, 165);

        ctx.fillStyle = "#64748b";
        ctx.font = "9px sans-serif";
        ctx.fillText("Packaging: 12 pairs per Box", 260, 180);

        // Transfer Mode radio
        drawRadio(ctx, 260, 192, "Bulk Boxes (12/box)", true);
        drawRadio(ctx, 410, 192, "Loose Pieces", false);

        drawInput(ctx, 260, 212, 140, "Boxes to Transfer", "2");

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 420, 222, 150, 30, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Complete Transfer", 495, 241);
        ctx.textAlign = "left";

        ctx.fillStyle = "#16a34a";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("✓ Restocks Shop Floor by +24 units", 260, 272);
      }
    },
    {
      id: "customers_directory",
      title: "Step 5: Customer Directory & Debt Tracking",
      shortDesc: "Registering customer contacts, tracking client credit balances, and spooling customer reports.",
      category: "Customers",
      iconName: "Users",
      instructions: [
        "Click 'Customers' from the left sidebar navigation.",
        "Click the blue '+ Add Customer' button in the top right header.",
        "Enter the customer's Full Name (e.g. 'John Boateng / BuildCo').",
        "Enter their Phone Number (used for contact and debt SMS tracking).",
        "Enter their Physical Address or Company location, and click 'Register'.",
        "Each customer profile automatically tracks their active Balance: Green (GH₵ 0.00 = Paid up) or Red (Shows exact credit/debt owed).",
        "Use the instant search bar to find any client in seconds by name or phone.",
        "Spooling Customer Ledgers: Click the 'Download PDF' icon in the header to print an official customer directory with account balances, or click 'Export Excel' to spool all client phone numbers, physical addresses, and debt balances to spreadsheet."
      ],
      tips: [
        "When selling on credit at the POS, always select the customer's name so their debt balance updates automatically.",
        "Data Spooling: Debt recovery teams can spool customers to Excel to filter and sort clients with outstanding balances above specific debt thresholds."
      ],
      callouts: [
        { number: 1, label: "Click '+ Add Customer'", x: 620, y: 70, targetX: 630, targetY: 65 },
        { number: 2, label: "Enter Name, Phone & Address", x: 140, y: 150, targetX: 270, targetY: 150 },
        { number: 3, label: "Customer Debt Balance (Red/Green)", x: 620, y: 180, targetX: 530, targetY: 175 },
        { number: 4, label: "Search by Name or Phone", x: 140, y: 250, targetX: 240, targetY: 245 },
        { number: 5, label: "Spool Data: PDF & Excel buttons", x: 440, y: 35, targetX: 520, targetY: 46 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Customer Directory & Client Profiles");

        // Top Header
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 35, w, 40);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, w, 40);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Customers", 30, 60);

        // Header Spooling buttons
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 480, 44, 28, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("PDF", 485, 61);

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 514, 44, 42, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#16a34a";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Excel", 520, 61);

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 565, 44, 115, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("+ Add Customer", 578, 61);

        // Search bar
        ctx.fillStyle = "#f8fafc";
        drawRoundedRect(ctx, 30, 85, 300, 28, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText("🔍 Search by customer name or phone...", 45, 103);

        // Customer Cards
        // Card 1: Debt balance
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 30, 125, 230, 150, 14);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("Kofi Mensah Construction", 45, 150);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("024 412 3456", 45, 168);
        ctx.fillText("Tema Industrial Area", 45, 184);

        ctx.fillStyle = "#fee2e2"; // red-100
        drawRoundedRect(ctx, 45, 205, 200, 48, 8);
        ctx.fill();
        ctx.fillStyle = "#991b1b";
        ctx.font = "bold 8px sans-serif";
        ctx.fillText("OUTSTANDING BALANCE (DEBT)", 55, 220);
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("GH₵ 1,450.00", 55, 240);

        // Card 2: Zero balance (green)
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 275, 125, 230, 150, 14);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("Apex Logistics Ghana", 290, 150);
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("050 889 9000", 290, 168);
        ctx.fillText("Spintex Road, Accra", 290, 184);

        ctx.fillStyle = "#dcfce7"; // green-100
        drawRoundedRect(ctx, 290, 205, 200, 48, 8);
        ctx.fill();
        ctx.fillStyle = "#166534";
        ctx.font = "bold 8px sans-serif";
        ctx.fillText("OUTSTANDING BALANCE", 300, 220);
        ctx.fillStyle = "#16a34a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("GH₵ 0.00 (Cleared)", 300, 240);

        // Modal Mock for New Customer
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 520, 115, 230, 165, 12);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("New Customer", 535, 135);

        drawInput(ctx, 535, 143, 200, "Full Name", "Emmanuel Ofori");
        drawInput(ctx, 535, 175, 200, "Phone", "020 123 4567");
        drawInput(ctx, 535, 207, 200, "Address", "Kasoa Main St");

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 535, 245, 200, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Register", 635, 261);
        ctx.textAlign = "left";
      }
    },
    {
      id: "barcode_studio",
      title: "Step 6: Barcode Studio & Thermal Label Printing",
      shortDesc: "Generating scannable barcodes and printing physical shelf and product stickers.",
      category: "Barcodes",
      iconName: "ScanLine",
      instructions: [
        "Click 'Barcode Studio' from the left sidebar or the top header button.",
        "Under 'Barcode Generator & Label Studio', pick any product from your catalog or enter custom code.",
        "Choose format: Code-128 (Universal) or EAN-13 (Standard retail).",
        "Inspect the Live Barcode SVG preview. You can zoom in and inspect line clarity.",
        "Under Print Settings, customize whether to print Product Name, Price (GH₵), and Barcode text on the sticker.",
        "Enter the label quantity (e.g. 20, 50, 100 stickers) and click 'Print Barcode Labels'.",
        "The system sends standard thermal ESC/POS or A4 sheet printable layouts directly to your printer."
      ],
      tips: [
        "Supports all standard handheld USB and Bluetooth barcode scanner guns (Honeywell, Netum, Zebra, Inateck) with zero driver installation.",
        "Test your scanner anytime using the 'Live Scanner Test' tab to verify beep sound and scan speed."
      ],
      callouts: [
        { number: 1, label: "Select Product to Barcode", x: 120, y: 110, targetX: 250, targetY: 105 },
        { number: 2, label: "Live Scalable Barcode SVG", x: 620, y: 140, targetX: 470, targetY: 135 },
        { number: 3, label: "Sticker Options (Show Price & Name)", x: 120, y: 220, targetX: 250, targetY: 215 },
        { number: 4, label: "Click 'Print Barcode Labels'", x: 620, y: 260, targetX: 480, targetY: 250 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Barcode Studio & Label Print Engine");

        // Tabs
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 35, w, 35);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, w, 35);

        ctx.fillStyle = "#9333ea"; // purple-600
        drawRoundedRect(ctx, 30, 42, 190, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Barcode Generator & Label Studio", 42, 58);

        ctx.fillStyle = "#64748b";
        ctx.fillText("Live Scanner Test", 240, 58);

        // Left Panel: Settings
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 30, 80, 340, 205, 12);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Label Configuration", 45, 102);

        drawInput(ctx, 45, 110, 310, "Select Product", "Industrial Safety Helmet (Yellow)");
        drawInput(ctx, 45, 146, 150, "Barcode Format", "Code-128 (Universal)");
        drawInput(ctx, 205, 146, 150, "Number of Labels", "50 Labels");

        drawCheckbox(ctx, 45, 186, "Print Product Name on sticker", true);
        drawCheckbox(ctx, 45, 204, "Print Retail Price (GH₵) on sticker", true);
        drawCheckbox(ctx, 45, 222, "Include human-readable barcode numbers", true);

        // Right Panel: Live SVG Preview & Print
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 390, 80, 360, 205, 12);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Live Barcode Preview (50x30mm Thermal)", 405, 102);

        // Label preview box
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 450, 115, 240, 105, 8);
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GENESYS SAFETY ENTERPRISE", 570, 130);
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Safety Helmet (Yellow)", 570, 143);

        drawBarcodeBars(ctx, 480, 150, 180, 32);

        ctx.font = "bold 9px monospace";
        ctx.fillText("2026-HLM-8890", 570, 194);
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#16a34a";
        ctx.fillText("GH₵ 65.00", 570, 208);
        ctx.textAlign = "left";

        ctx.fillStyle = "#9333ea";
        drawRoundedRect(ctx, 450, 235, 240, 36, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🖨️ Print Barcode Labels (Thermal / A4)", 570, 257);
        ctx.textAlign = "left";
      }
    },
    {
      id: "pos_checkout",
      title: "Step 7: High-Speed POS Cash & Credit Checkout",
      shortDesc: "Scanning items, processing sales, and printing receipts with cash, credit, or mobile money.",
      category: "Point of Sale",
      iconName: "ShoppingBag",
      instructions: [
        "Open 'POS (Sale)' from the dashboard or sidebar navigation.",
        "Add products to cart: simply scan the barcode with your handheld gun, scan with the camera, or click any product tile.",
        "Select Customer: Keep as 'Walk-in Customer' for regular buyers, or select a registered customer from the dropdown for credit/ledger tracking.",
        "Adjust quantities in the cart with '+' and '-' buttons or apply an optional discount (GH₵).",
        "Choose Payment Method tab: 'Cash', 'Credit / Debt', or 'Mobile Money' (MTN, Telecel, AT).",
        "For Cash: Type the Amount Paid. The system computes exact Change Due instantly.",
        "Click 'Complete Sale'. The sale is logged, stock is decremented, and an instant printable thermal/A4 receipt pops up."
      ],
      tips: [
        "Credit Sales: Selecting 'Credit / Debt' automatically adds the sale amount to the chosen customer's debt ledger.",
        "Barcode Beep: You can toggle the scanner audio chime on/off using the speaker icon."
      ],
      callouts: [
        { number: 1, label: "Scan Barcode or click product tile", x: 120, y: 130, targetX: 250, targetY: 130 },
        { number: 2, label: "Select Customer (Walk-in or Registered)", x: 620, y: 90, targetX: 520, targetY: 80 },
        { number: 3, label: "Payment Tabs (Cash, Credit, MoMo)", x: 620, y: 190, targetX: 520, targetY: 185 },
        { number: 4, label: "Click 'Complete Sale' & Print Receipt", x: 620, y: 265, targetX: 520, targetY: 255 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Point of Sale (POS) — Express Checkout Screen");

        // Left 60%: Product Catalog
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 35, 460, h - 35);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, 460, h - 35);

        // Search & Barcode Scan Bar
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 20, 48, 290, 30, 8);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText("🔍 Scan barcode or search items...", 35, 67);

        // Category pills
        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 320, 50, 45, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("All", 335, 65);

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 370, 50, 65, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#475569";
        ctx.fillText("Vests", 385, 65);

        // Product Grid
        drawProductCard(ctx, 20, 90, "Hi-Vis Safety Vest", "GH₵ 45.00", "#f97316");
        drawProductCard(ctx, 175, 90, "Steel Toe Boots", "GH₵ 350.00", "#3b82f6");
        drawProductCard(ctx, 330, 90, "Safety Helmet", "GH₵ 65.00", "#eab308");

        drawProductCard(ctx, 20, 175, "Fire Extinguisher 6kg", "GH₵ 280.00", "#ef4444");
        drawProductCard(ctx, 175, 175, "Ear Muffs Pro", "GH₵ 55.00", "#10b981");
        drawProductCard(ctx, 330, 175, "Welding Goggles", "GH₵ 35.00", "#8b5cf6");

        // Right 40%: Active Cart Drawer
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(460, 35, w - 460, h - 35);
        ctx.strokeStyle = "#cbd5e1";
        ctx.strokeRect(460, 35, w - 460, h - 35);

        // Customer Select Dropdown
        drawInput(ctx, 480, 50, 270, "Customer", "Walk-in Customer");

        // Cart items
        ctx.fillStyle = "#f8fafc";
        drawRoundedRect(ctx, 480, 85, 270, 65, 8);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Hi-Vis Safety Vest (x2)", 490, 105);
        ctx.fillText("Steel Toe Boots (x1)", 490, 125);

        ctx.fillStyle = "#16a34a";
        ctx.fillText("GH₵ 90.00", 685, 105);
        ctx.fillText("GH₵ 350.00", 685, 125);

        // Payment Tabs
        ctx.fillStyle = "#f1f5f9";
        drawRoundedRect(ctx, 480, 160, 270, 26, 6);
        ctx.fill();

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 482, 162, 85, 22, 5);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Cash", 512, 177);

        ctx.fillStyle = "#64748b";
        ctx.fillText("Credit / Debt", 580, 177);
        ctx.fillText("MoMo", 670, 177);

        // Total & Amount Paid
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Total: GH₵ 440.00", 480, 206);

        drawInput(ctx, 480, 215, 130, "Amount Paid", "500.00");
        drawInput(ctx, 620, 215, 130, "Change Due", "GH₵ 60.00");

        // Complete Sale Button
        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 480, 255, 270, 32, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Complete Sale & Print", 615, 275);
        ctx.textAlign = "left";
      }
    },
    {
      id: "returned_goods",
      title: "Step 8: Returned Goods & Restocking (Audit & Spooling)",
      shortDesc: "Processing customer returns, automatic inventory restocking, debt balance adjustment, and spooling audit reports.",
      category: "Sales & Returns",
      iconName: "Undo2",
      instructions: [
        "Click 'Ledger & History' from the left sidebar navigation.",
        "Under 'Sales Transactions', locate the customer's purchase using the instant search bar or date filters (Today, This Week, Month, Custom Range).",
        "Click the red 'Return Goods' button on that transaction line (requires Admin permissions).",
        "In the 'Process Goods Return' modal, use the '+' and '-' stepper buttons to enter the exact quantity being returned for each item.",
        "Click 'Confirm & Process Return': The system immediately restocks the items back into your Shop Inventory with zero manual counting!",
        "Automatic Financial Ledger Offset: If the sale was made on Credit, the returned value is automatically deducted from the customer's debt ledger. If Cash or MoMo, it calculates the refund offset.",
        "Click the 'Returned Goods' sub-tab to inspect the permanent audit log (Return ID, Date, Customer, Item details, Value Offset, and Cleared Status).",
        "Spooling Data: Click the 'Download PDF' icon to generate an official Audit Returned Goods Report, or click 'Export Excel' to download a spreadsheet (also available for Sales History Report)."
      ],
      tips: [
        "Every return is permanently timestamped with a unique Return ID (e.g. RET-XXXXX) for tamper-proof audits.",
        "Date Filtering works on both Sales and Returns: select 'Custom Range' to spool quarterly or annual tax returns easily."
      ],
      callouts: [
        { number: 1, label: "Click 'Return Goods' on sale row", x: 620, y: 130, targetX: 700, targetY: 135 },
        { number: 2, label: "Set Qty to Return with +/- stepper", x: 620, y: 195, targetX: 535, targetY: 190 },
        { number: 3, label: "Auto-restocks Shop & clears customer debt", x: 130, y: 245, targetX: 280, targetY: 235 },
        { number: 4, label: "Switch to 'Returned Goods' audit tab", x: 130, y: 65, targetX: 235, targetY: 55 },
        { number: 5, label: "Spool Data: PDF & Excel buttons", x: 620, y: 65, targetX: 530, targetY: 55 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Ledger & History — Sales Transactions & Goods Return Modal");

        // Sub-tabs (matching real App.tsx viewMode)
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 35, w, 40);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, w, 40);

        // Sales Transactions Tab (Active)
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 30, 42, 140, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Sales Transactions", 42, 59);

        // Returned Goods Tab
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Returned Goods (14)", 185, 59);

        // Search & Filter
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 320, 42, 160, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px sans-serif";
        ctx.fillText("🔍 Search transactions...", 330, 59);

        // Spool buttons in header (matching real App.tsx)
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 490, 42, 28, 26, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("PDF", 495, 59);

        ctx.fillStyle = "#0f172a"; // slate-900 Excel button in App.tsx
        drawRoundedRect(ctx, 524, 42, 45, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Excel", 532, 59);

        // Table Header
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(30, 85, 720, 26);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(30, 85, 720, 26);

        ctx.fillStyle = "#64748b";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("DATE / TIME", 45, 101);
        ctx.fillText("CUSTOMER", 160, 101);
        ctx.fillText("ITEMS", 310, 101);
        ctx.fillText("TOTAL", 460, 101);
        ctx.fillText("PAYMENT", 540, 101);
        ctx.fillText("ACTION", 650, 101);

        // Row 1: Cash sale
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(30, 111, 720, 36);
        ctx.strokeStyle = "#f1f5f9";
        ctx.strokeRect(30, 111, 720, 36);
        ctx.fillStyle = "#0f172a";
        ctx.font = "9px sans-serif";
        ctx.fillText("12/09 14:20", 45, 133);
        ctx.fillText("Kwame Mensah", 160, 133);
        ctx.fillText("Hi-Vis Vest (x2)", 310, 133);
        ctx.fillStyle = "#16a34a";
        ctx.fillText("GH₵ 90.00", 460, 133);
        ctx.fillStyle = "#2563eb";
        ctx.fillText("Cash", 540, 133);

        // Return Goods button
        ctx.fillStyle = "#fee2e2"; // red-100
        drawRoundedRect(ctx, 640, 118, 95, 22, 5);
        ctx.fill();
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("↺ Return Goods", 648, 133);

        // Row 2: Credit sale
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(30, 147, 720, 36);
        ctx.strokeStyle = "#f1f5f9";
        ctx.strokeRect(30, 147, 720, 36);
        ctx.fillStyle = "#0f172a";
        ctx.font = "9px sans-serif";
        ctx.fillText("12/09 11:05", 45, 169);
        ctx.fillText("BuildCo Ghana", 160, 169);
        ctx.fillText("Boots (x1)", 310, 169);
        ctx.fillStyle = "#dc2626";
        ctx.fillText("GH₵ 350.00", 460, 169);
        ctx.fillStyle = "#b45309";
        ctx.fillText("Credit", 540, 169);

        ctx.fillStyle = "#fee2e2";
        drawRoundedRect(ctx, 640, 154, 95, 22, 5);
        ctx.fill();
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("↺ Return Goods", 648, 169);

        // Modal Overlay for "Process Goods Return"
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 160, 75, 460, 225, 14);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Process Goods Return", 185, 100);
        ctx.fillStyle = "#64748b";
        ctx.font = "9px sans-serif";
        ctx.fillText("Sale ID: SL-2026-904 • Customer: Kwame Mensah • Original Sale: GH₵ 90.00", 185, 115);

        // Item Card inside modal
        ctx.fillStyle = "#f8fafc";
        drawRoundedRect(ctx, 185, 125, 410, 52, 8);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("Hi-Vis Safety Vest Orange", 195, 144);
        ctx.fillStyle = "#64748b";
        ctx.font = "9px sans-serif";
        ctx.fillText("Price: GH₵ 45.00 • Purchased: 2 units (0 returned)", 195, 162);

        // Stepper: [-] [1] [+]
        ctx.fillStyle = "#e2e8f0";
        drawRoundedRect(ctx, 475, 137, 24, 24, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("-", 484, 153);

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 503, 137, 30, 24, 4);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("1", 514, 153);

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 537, 137, 24, 24, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("+", 545, 153);

        // Automated Restock & Debt offset feedback
        ctx.fillStyle = "#eff6ff"; // blue-50
        drawRoundedRect(ctx, 185, 185, 410, 48, 8);
        ctx.fill();
        ctx.strokeStyle = "#bfdbfe";
        ctx.stroke();

        ctx.fillStyle = "#1d4ed8";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("AUTOMATED SYSTEM IMPACT:", 195, 198);
        ctx.fillStyle = "#166534";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("✓ Restocks +1 unit to Shop Floor Inventory immediately", 195, 212);
        ctx.fillStyle = "#1e40af";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("✓ Offsets GH₵ 45.00 value (Credit debt reduction or refund calculation)", 195, 225);

        // Confirm button
        ctx.fillStyle = "#dc2626"; // red-600
        drawRoundedRect(ctx, 185, 242, 410, 32, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Confirm & Process Return (Restock Shop)", 390, 262);
        ctx.textAlign = "left";
      }
    },
    {
      id: "invoicing_menu",
      title: "Step 9: Professional Invoicing (Quotes & Tax Invoices)",
      shortDesc: "Drafting formal invoices with client details, automatic VAT calculation, and PDF export.",
      category: "Invoicing",
      iconName: "FileText",
      instructions: [
        "Click 'Invoice Menu' from the left navigation sidebar.",
        "Make sure you are on the '+ Create Invoice' tab.",
        "Under 'Client Information', enter the Client or Business Name (e.g. 'Volta Hydro Corp') and Contact Phone/Email.",
        "Under 'Select Products', search or click any item from your catalog to add it to the Invoice Draft.",
        "Adjust quantities with '+' and '-' buttons or apply an optional general discount (GH₵).",
        "Toggle the 'Apply 15% VAT Tax' switch if you need to generate a formal VAT-inclusive invoice.",
        "Click 'Save & Preview Invoice' to generate an official branded PDF invoice ready for printing or emailing to clients.",
        "View, reprint, or download past invoices anytime from the 'Invoice History' tab."
      ],
      tips: [
        "Invoices generate official sequential reference numbers (e.g. INV-202609-001) for professional corporate accounting.",
        "Your business address, phone number, and logo appear automatically at the top of every generated PDF invoice."
      ],
      callouts: [
        { number: 1, label: "Enter Client Name & Phone/Email", x: 120, y: 130, targetX: 250, targetY: 125 },
        { number: 2, label: "Search & Click Products to Add", x: 620, y: 120, targetX: 470, targetY: 115 },
        { number: 3, label: "Toggle 15% VAT Tax & Discount", x: 120, y: 240, targetX: 280, targetY: 235 },
        { number: 4, label: "Click 'Save & Preview Invoice'", x: 620, y: 265, targetX: 490, targetY: 255 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Invoice Menu — Create & Preview Formal Invoices");

        // Top Navigation Tabs
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 35, w, 35);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(0, 35, w, 35);

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 30, 42, 130, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("+ Create Invoice", 45, 58);

        ctx.fillStyle = "#64748b";
        ctx.fillText("Invoice History", 185, 58);

        // Left Panel: Client Info & Item Selection
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 30, 80, 340, 205, 12);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("1. Client Details", 45, 100);

        drawInput(ctx, 45, 108, 160, "Client Name", "Volta Hydro Corp");
        drawInput(ctx, 215, 108, 140, "Phone / Email", "024 999 8888");

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("2. Add Products from Catalog", 45, 158);

        drawInput(ctx, 45, 166, 310, "Search Catalog", "🔍 Type product name...");

        // Quick add product chips
        ctx.fillStyle = "#eff6ff";
        drawRoundedRect(ctx, 45, 202, 150, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("+ Safety Vest (GH₵ 45)", 52, 216);

        ctx.fillStyle = "#eff6ff";
        drawRoundedRect(ctx, 205, 202, 150, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#1d4ed8";
        ctx.fillText("+ Helmet Yellow (GH₵ 65)", 212, 216);

        drawCheckbox(ctx, 45, 240, "Apply 15% VAT Tax (Tax Invoice)", true);

        // Right Panel: Invoice Draft & Totals
        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 390, 80, 360, 205, 12);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Invoice Summary Draft (INV-2026-001)", 405, 100);

        // Items table preview
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(405, 110, 330, 75);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(405, 110, 330, 75);

        ctx.fillStyle = "#64748b";
        ctx.font = "bold 8px sans-serif";
        ctx.fillText("ITEM DESCRIPTION", 415, 122);
        ctx.fillText("QTY", 560, 122);
        ctx.fillText("PRICE", 610, 122);
        ctx.fillText("TOTAL", 680, 122);

        ctx.fillStyle = "#0f172a";
        ctx.font = "9px sans-serif";
        ctx.fillText("Safety Vest Hi-Vis Orange", 415, 140);
        ctx.fillText("10", 565, 140);
        ctx.fillText("45.00", 610, 140);
        ctx.fillText("450.00", 680, 140);

        ctx.fillText("Industrial Safety Helmet", 415, 160);
        ctx.fillText("5", 565, 160);
        ctx.fillText("65.00", 610, 160);
        ctx.fillText("325.00", 680, 160);

        // Totals
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Subtotal: GH₵ 775.00", 410, 200);
        ctx.fillText("15% VAT: GH₵ 116.25", 410, 215);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("Grand Total: GH₵ 891.25", 410, 235);

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 560, 215, 175, 36, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("📄 Save & Preview Invoice", 647, 237);
        ctx.textAlign = "left";
      }
    },
    {
      id: "credit_debtors",
      title: "Step 10: Credit Customers & Recording Repayments",
      shortDesc: "Tracking total outstanding company debt, reviewing customer ledgers, and recording repayments.",
      category: "Finance",
      iconName: "CreditCard",
      instructions: [
        "Click 'Credit/Debtors' from the left sidebar navigation.",
        "Review the top stat tiles: 'Total Outstanding Debt', 'Active Debtors', and 'Debt Recovered'.",
        "Browse the list of customers who have unpaid balances.",
        "To record a full or partial debt repayment, click 'Record Payment' on that customer line.",
        "Enter the repayment amount and choose payment method (Cash, Mobile Money, or Bank).",
        "The system updates the customer's balance in real time and offers an instant Printable Debt Repayment Receipt.",
        "Spooling Debt Reports: In the top header, click 'PDF' to generate the official Debtors Report for debt recovery follow-ups, or click 'Excel' to spool debtor balances, phone contacts, and debt ages to spreadsheet."
      ],
      tips: [
        "When customer debt is fully paid, their account balance automatically turns to green (GH₵ 0.00).",
        "Data Spooling: Debt recovery teams can spool customers to Excel to filter and sort clients with outstanding balances above specific debt thresholds."
      ],
      callouts: [
        { number: 1, label: "Total Outstanding Debt summary tile", x: 120, y: 90, targetX: 220, targetY: 85 },
        { number: 2, label: "Customer balance in red (Debt owed)", x: 120, y: 180, targetX: 300, targetY: 175 },
        { number: 3, label: "Click 'Record Payment' button", x: 620, y: 175, targetX: 680, targetY: 170 },
        { number: 4, label: "Enter repayment amount & print receipt", x: 620, y: 255, targetX: 520, targetY: 240 },
        { number: 5, label: "Spool Data: PDF & Excel buttons", x: 620, y: 48, targetX: 620, targetY: 55 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Credit Customers & Debt Management");

        // Top Spooling buttons in Debtors Header
        ctx.fillStyle = "#0f172a";
        drawRoundedRect(ctx, 580, 42, 60, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("⬇ PDF", 596, 58);

        ctx.fillStyle = "#0f172a";
        drawRoundedRect(ctx, 648, 42, 60, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("Excel", 665, 58);

        // Summary tiles
        drawStatTile(ctx, 30, 50, 170, 60, "Total Outstanding Debt", "GH₵ 12,450.00", "#ef4444");
        drawStatTile(ctx, 210, 50, 170, 60, "Active Debtors", "8 Customers", "#f59e0b");
        drawStatTile(ctx, 390, 50, 170, 60, "Recovered This Month", "GH₵ 4,200.00", "#10b981");

        // Debtor list table
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(30, 125, 720, 155);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(30, 125, 720, 155);

        // Header
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("CUSTOMER NAME", 45, 142);
        ctx.fillText("PHONE", 240, 142);
        ctx.fillText("OUTSTANDING BALANCE", 400, 142);
        ctx.fillText("ACTION", 650, 142);

        // Rows
        drawDebtorRow(ctx, 155, "Kofi Mensah Construction", "+233 24 412 3456", "GH₵ 1,450.00", true);
        drawDebtorRow(ctx, 190, "Volta Logistics Co.", "+233 20 333 4444", "GH₵ 2,800.00", false);
        drawDebtorRow(ctx, 225, "BuildRight Ghana Ltd", "+233 55 777 8888", "GH₵ 850.00", false);
      }
    },
    {
      id: "users_permissions",
      title: "Step 11: Staff Accounts & Role-Based Permissions",
      shortDesc: "Creating accounts for cashiers and store managers with restricted permissions.",
      category: "Administration",
      iconName: "Users",
      instructions: [
        "Click 'Admin Panel' from the sidebar and open the 'Users' tab.",
        "Click '+ Add New User' to create a staff member account.",
        "Enter Staff Full Name, Login Username, and Password.",
        "Select User Role: 'Admin', 'Manager', or 'User (Cashier)'.",
        "Configure Granular Permissions: toggle whether the cashier can delete inventory, edit selling prices, or view profit summaries.",
        "Click 'Save User'. Cashiers log in with their assigned username and only access permitted screens."
      ],
      tips: [
        "Cashiers only see POS and permitted inventory; administrative settings and license keys remain strictly hidden.",
        "Every transaction, discount, and return is permanently stamped with the active cashier's name for audit trails."
      ],
      callouts: [
        { number: 1, label: "Click '+ Add New User' in Admin Panel", x: 620, y: 70, targetX: 680, targetY: 65 },
        { number: 2, label: "Set Staff Username & Password", x: 120, y: 130, targetX: 270, targetY: 130 },
        { number: 3, label: "Select Role (Cashier / Manager / Admin)", x: 120, y: 190, targetX: 270, targetY: 185 },
        { number: 4, label: "Granular Permission Checkboxes", x: 620, y: 210, targetX: 490, targetY: 200 }
      ],
      drawDiagram: (ctx, w, h) => {
        drawWindowChrome(ctx, w, h, "Admin Panel — Staff Accounts & Permission Controls");

        ctx.fillStyle = "#ffffff";
        drawRoundedRect(ctx, 140, 50, 500, 235, 14);
        ctx.fill();
        ctx.strokeStyle = "#e2e8f0";
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("Staff Account Management", 165, 75);

        drawInput(ctx, 165, 95, 220, "Staff Full Name", "Abena Osei (Cashier 1)");
        drawInput(ctx, 400, 95, 215, "Login Username", "abena_cashier");

        // Role select
        ctx.fillStyle = "#475569";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("ASSIGNED ROLE", 165, 150);

        ctx.fillStyle = "#f8fafc";
        drawRoundedRect(ctx, 165, 158, 220, 28, 6);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "10px sans-serif";
        ctx.fillText("User (Cashier - Restricted POS)", 175, 176);

        // Permissions checkboxes
        ctx.fillStyle = "#475569";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("PERMISSION TOGGLES", 400, 150);

        drawCheckbox(ctx, 400, 165, "POS & Sales Checkout", true);
        drawCheckbox(ctx, 400, 185, "View Shop Inventory", true);
        drawCheckbox(ctx, 400, 205, "Delete Products / Inventory", false);
        drawCheckbox(ctx, 400, 225, "Access Financial Reports & Settings", false);

        ctx.fillStyle = "#2563eb";
        drawRoundedRect(ctx, 165, 230, 220, 34, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Save Staff Account", 275, 252);
        ctx.textAlign = "left";
      }
    }
  ];

  const currentStep = steps[activeStepIndex];

  // Draw current diagram onto screen canvas whenever activeStep changes
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI Retina scaling
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 780;
    const displayHeight = 320;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw UI diagram
    currentStep.drawDiagram(ctx, displayWidth, displayHeight);

    // Draw Callout Arrows on canvas
    currentStep.callouts.forEach(callout => {
      drawCalloutArrow(ctx, callout.x, callout.y, callout.targetX, callout.targetY, callout.number, callout.label);
    });
  }, [isOpen, activeStepIndex]);

  // Comprehensive Multi-Page Illustrated PDF Generator
  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      setPdfProgress(10);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      }) as any;

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      // --- COVER PAGE ---
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // Accent top bar
      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 0, pageWidth, 8, "F");

      // Title & Branding
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("GENESYS POS & INVENTORY", margin + 6, 60);

      doc.setFontSize(18);
      doc.setTextColor(147, 197, 253); // blue-300
      doc.text("Complete Step-by-Step User Manual", margin + 6, 72);

      doc.setFontSize(11);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.setFont("helvetica", "normal");
      doc.text("Illustrated Real-Screen Operations, Stock Transfers, Barcode Studio & Setup", margin + 6, 82);

      // Decorative divider
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.8);
      doc.line(margin + 6, 90, margin + 130, 90);

      // Document Metadata Box
      doc.setFillColor(30, 41, 59); // slate-800
      doc.roundedRect(margin + 6, 105, contentWidth - 12, 60, 4, 4, "F");
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(margin + 6, 105, contentWidth - 12, 60, 4, 4, "S");

      doc.setFontSize(10.5);
      doc.setTextColor(148, 163, 184);
      doc.text("System Edition:", margin + 14, 120);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Genesys Retail & Warehouse Enterprise Suite", margin + 55, 120);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Business Profile:", margin + 14, 132);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(businessName, margin + 55, 132);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Release Version:", margin + 14, 144);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("v1.2 (Standalone Offline & Cloud Connected)", margin + 55, 144);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Manual Generated:", margin + 14, 156);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(new Date().toLocaleDateString("en-US", { dateStyle: "long" }), margin + 55, 156);

      // Key modules list on cover
      const features = [
        "✓ Step 1: System License Activation & Tenant Space Setup",
        "✓ Step 2: One-Time Business Name & Master Admin Account",
        "✓ Step 3: Registering Products, Prices & Shop Stock (PDF/Excel Spooling)",
        "✓ Step 4: Warehouse Bulk Storage & Seamless Restocking (PDF/Excel Spooling)",
        "✓ Step 5: Customer Directory & Debt Ledger Tracking (PDF/Excel Spooling)",
        "✓ Step 6: Barcode Studio & ESC/POS Thermal Label Printing",
        "✓ Step 7: High-Speed POS Checkout (Cash, Credit & MoMo)",
        "✓ Step 8: Returned Goods & Auto Restock (Audit Trail & PDF/Excel Spooling)",
        "✓ Step 9: Professional Invoicing (Drafting, 15% VAT & PDF Quotes)",
        "✓ Step 10: Credit/Debtors Ledger & Repayments (PDF/Excel Spooling)",
        "✓ Step 11: Staff Accounts & Granular Permission Controls"
      ];

      doc.setFontSize(9.5);
      doc.setTextColor(226, 232, 240);
      features.forEach((feat, i) => {
        doc.text(feat, margin + 6, 178 + (i * 7.8));
      });

      // Cover footer
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Powered by Genesys © 2026 Generic Systems. All rights reserved.", margin + 6, 280);

      setPdfProgress(20);

      // Helper off-screen canvas to render each step's diagram with pointer arrows
      const offscreenCanvas = document.createElement("canvas");
      const offscreenCtx = offscreenCanvas.getContext("2d")!;
      const canvasW = 780;
      const canvasH = 320;
      offscreenCanvas.width = canvasW * 2;
      offscreenCanvas.height = canvasH * 2;
      offscreenCtx.scale(2, 2);

      // Loop through each step to create dedicated illustrated pages
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        doc.addPage();

        // Page Header
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 20, "F");
        doc.setDrawColor(226, 232, 240);
        doc.line(0, 20, pageWidth, 20);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("GENESYS POS & INVENTORY — USER OPERATIONS MANUAL", margin, 13);

        doc.setFont("helvetica", "normal");
        doc.text(`Page ${i + 2} of ${steps.length + 1}`, pageWidth - margin - 22, 13);

        // Step Title Banner
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42);
        doc.text(step.title, margin, 31);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(step.shortDesc, margin, 37);

        // Render Canvas Diagram with Pointer Arrows
        offscreenCtx.clearRect(0, 0, canvasW, canvasH);
        step.drawDiagram(offscreenCtx, canvasW, canvasH);

        step.callouts.forEach(callout => {
          drawCalloutArrow(offscreenCtx, callout.x, callout.y, callout.targetX, callout.targetY, callout.number, callout.label);
        });

        const imgData = offscreenCanvas.toDataURL("image/png");
        const imgWidth = contentWidth;
        const imgHeight = (canvasH / canvasW) * imgWidth; // proportional height (~74mm)
        const imgY = 41;

        // Image background border
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin - 1, imgY - 1, imgWidth + 2, imgHeight + 2, 2, 2, "F");
        doc.addImage(imgData, "PNG", margin, imgY, imgWidth, imgHeight);

        // Step-by-Step Instructions Section
        const instructionStartY = imgY + imgHeight + 7;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text("Step-by-Step Instructions:", margin, instructionStartY);

        let currentY = instructionStartY + 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);

        step.instructions.forEach((instr, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(37, 99, 235);
          doc.text(`${idx + 1}.`, margin, currentY);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          const lines = doc.splitTextToSize(instr, contentWidth - 8);
          doc.text(lines, margin + 6, currentY);
          currentY += lines.length * 4.4 + 1.2;
        });

        // Diagram Pointer Legend Box
        currentY += 1.5;
        const legendHeight = 14 + (step.callouts.length * 4.5);
        doc.setFillColor(238, 242, 255); // indigo-50
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(margin, currentY, contentWidth, legendHeight, 2.5, 2.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(67, 56, 202);
        doc.text("🔍 Illustrated Area Pointers (Refer to diagram above):", margin + 4, currentY + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(55, 48, 163);

        step.callouts.forEach((c, idx) => {
          doc.text(`[${c.number}] ${c.label}`, margin + 6, currentY + 11.5 + (idx * 4.5));
        });

        // Pro Tips Box
        currentY += legendHeight + 3;
        doc.setFillColor(254, 243, 199); // amber-50
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(margin, currentY, contentWidth, 16, 2.5, 2.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(146, 64, 14);
        doc.text("💡 Professional Tip:", margin + 4, currentY + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(180, 83, 9);
        const tipLines = doc.splitTextToSize(step.tips.join(" "), contentWidth - 8);
        doc.text(tipLines, margin + 4, currentY + 9.5);

        // Page footer
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Genesys POS & Inventory Manual • ${businessName}`, margin, pageHeight - 6);

        setPdfProgress(Math.round(20 + ((i + 1) / steps.length) * 75));
      }

      // Save document
      doc.save("Genesys_POS_User_Manual.pdf");
      setPdfProgress(100);
      setTimeout(() => {
        setIsGeneratingPdf(false);
      }, 800);
    } catch (err) {
      console.error("Failed to generate PDF manual:", err);
      alert("Failed to generate PDF manual. Please try again.");
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="user-manual-modal-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white">Genesys Interactive User Manual</h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Real System Guide
                </span>
              </div>
              <p className="text-xs text-slate-400">Step-by-step instructions with exact system images and action pointers</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="download-manual-pdf-btn"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              title="Download full printable PDF manual with illustrations"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating PDF ({pdfProgress}%)...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Download PDF Manual</span>
                </>
              )}
            </button>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Manual"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Step Pills */}
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-2.5 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setActiveStepIndex(idx)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer",
                activeStepIndex === idx
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                  : "bg-white hover:bg-slate-200/70 text-slate-600 border border-slate-200"
              )}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                {idx + 1}
              </span>
              <span>{step.title.split(":")[1]?.trim() || step.title}</span>
            </button>
          ))}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Active Step Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
                  {currentStep.category}
                </span>
                <h3 className="font-bold text-xl text-slate-900">{currentStep.title}</h3>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{currentStep.shortDesc}</p>
            </div>

            <div className="text-xs text-slate-400 font-bold self-start sm:self-auto">
              Step {activeStepIndex + 1} of {steps.length}
            </div>
          </div>

          {/* Interactive Illustrated Canvas Diagram */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Sparkles size={14} className="text-amber-500" />
                <span>Exact Screen UI & Action Pointers</span>
              </div>
              <span className="text-[11px] text-slate-400">Red numbered arrows show exactly where to click and type</span>
            </div>

            <div className="bg-slate-950 rounded-2xl p-2 border border-slate-800 shadow-inner flex justify-center overflow-x-auto">
              <canvas 
                ref={canvasRef} 
                className="rounded-xl shadow-lg max-w-full h-auto block"
              />
            </div>
          </div>

          {/* Legend of Pointer Numbers */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
              <Info size={14} className="text-indigo-600" />
              <span>Area Action Pointers (Refer to diagram above):</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {currentStep.callouts.map((c) => (
                <div key={c.number} className="bg-white p-2.5 rounded-xl border border-indigo-100/80 flex items-start gap-2 shadow-2xs">
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {c.number}
                  </span>
                  <span className="text-xs font-medium text-slate-700 leading-snug">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step Instructions & Pro-Tips */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-blue-600" />
                <span>Step-by-Step Walkthrough</span>
              </h4>
              <ul className="space-y-2.5">
                {currentStep.instructions.map((instruction, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed pt-0.5">{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-600" />
                  <span>Pro-Tips & Notes</span>
                </h4>
                <div className="space-y-2 mt-2">
                  {currentStep.tips.map((tip, idx) => (
                    <p key={idx} className="text-xs text-amber-800 leading-relaxed">
                      • {tip}
                    </p>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-amber-200/60 text-[11px] text-amber-700 font-medium">
                Tip: Download the full PDF manual to distribute printed copies to cashiers, warehouse staff, and branch managers.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Navigation */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            onClick={() => setActiveStepIndex(prev => Math.max(0, prev - 1))}
            disabled={activeStepIndex === 0}
            className="px-4 py-2 border border-slate-200 hover:bg-white disabled:opacity-40 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Previous Step</span>
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveStepIndex(i)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all cursor-pointer",
                  activeStepIndex === i ? "w-6 bg-blue-600" : "bg-slate-300 hover:bg-slate-400"
                )}
                title={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {activeStepIndex < steps.length - 1 ? (
            <button
              onClick={() => setActiveStepIndex(prev => Math.min(steps.length - 1, prev + 1))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-200"
            >
              <span>Next Step</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-200"
            >
              <Download size={15} />
              <span>Download PDF Manual</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// --- DIAGRAM DRAWING HELPER FUNCTIONS ---

function drawWindowChrome(ctx: CanvasRenderingContext2D, w: number, h: number, title: string) {
  // Desktop Window Frame
  ctx.fillStyle = "#0f172a";
  drawRoundedRect(ctx, 0, 0, w, h, 14);
  ctx.fill();

  // Header Title Bar
  ctx.fillStyle = "#1e293b";
  drawRoundedRect(ctx, 0, 0, w, 35, 14);
  ctx.fill();
  ctx.fillRect(0, 25, w, 10); // flatten bottom corners of header

  // Window control dots
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(20, 18, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(36, 18, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(52, 18, 5, 0, Math.PI * 2);
  ctx.fill();

  // Window title
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, w / 2, 22);
  ctx.textAlign = "left";

  // App Body canvas background
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 35, w, h - 35);
}

function drawCalloutArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  num: number,
  label: string
) {
  ctx.save();

  // Red pointer line with clear visibility
  ctx.strokeStyle = "#dc2626"; // red-600
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead at target
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = 10;
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  // Number Badge Circle at start of arrow
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(fromX, fromY, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(num.toString(), fromX, fromY);

  ctx.restore();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawInput(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, label: string, placeholder: string) {
  ctx.fillStyle = "#475569";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText(label.toUpperCase(), x, y);

  ctx.fillStyle = "#f8fafc";
  drawRoundedRect(ctx, x, y + 4, w, 26, 6);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "10px sans-serif";
  ctx.fillText(placeholder, x + 8, y + 21);
}

function drawRadio(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, selected: boolean) {
  ctx.strokeStyle = selected ? "#2563eb" : "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + 6, y + 6, 6, 0, Math.PI * 2);
  ctx.stroke();

  if (selected) {
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = selected ? "#0f172a" : "#64748b";
  ctx.font = "10px sans-serif";
  ctx.fillText(label, x + 18, y + 9);
}

function drawBarcodeBars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#0f172a";
  const barPattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 2, 1, 3, 2, 1, 4, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 4, 1, 2];
  let curX = x;
  let draw = true;
  for (let i = 0; i < barPattern.length && curX < x + w; i++) {
    const barW = barPattern[i] * 1.6;
    if (draw) {
      ctx.fillRect(curX, y, barW, h);
    }
    curX += barW + 1.2;
    draw = !draw;
  }
}

function drawProductCard(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, price: string, color: string) {
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, x, y, 140, 72, 8);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  ctx.fillStyle = color;
  drawRoundedRect(ctx, x + 8, y + 8, 18, 18, 4);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9.5px sans-serif";
  ctx.fillText(name, x + 8, y + 40);

  ctx.fillStyle = "#16a34a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(price, x + 8, y + 58);
}

function drawWhRow(ctx: CanvasRenderingContext2D, y: number, name: string, warehouseStock: string, shopStock: string, highlighted: boolean) {
  ctx.fillStyle = highlighted ? "#eff6ff" : "#ffffff";
  ctx.fillRect(30, y, 720, 32);
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(30, y, 720, 32);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText(name, 45, y + 20);

  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("Safety Gear", 230, y + 20);

  ctx.fillStyle = "#b45309";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText(warehouseStock, 360, y + 20);

  ctx.fillStyle = "#1d4ed8";
  ctx.fillText(shopStock, 515, y + 20);

  ctx.fillStyle = "#2563eb";
  drawRoundedRect(ctx, 630, y + 6, 110, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("⇄ Transfer to Shop", 638, y + 19);
}

function drawDebtorRow(ctx: CanvasRenderingContext2D, y: number, name: string, phone: string, balance: string, highlighted: boolean) {
  ctx.fillStyle = highlighted ? "#fef2f2" : "#ffffff";
  ctx.fillRect(30, y, 720, 32);
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(30, y, 720, 32);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText(name, 45, y + 20);

  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(phone, 240, y + 20);

  ctx.fillStyle = "#dc2626";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(balance, 400, y + 20);

  ctx.fillStyle = "#16a34a";
  drawRoundedRect(ctx, 630, y + 6, 110, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText("Record Payment", 645, y + 19);
}

function drawStatTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, val: string, color: string) {
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  ctx.fillStyle = color;
  drawRoundedRect(ctx, x + 8, y + 8, 4, h - 16, 2);
  ctx.fill();

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 9px sans-serif";
  ctx.fillText(label.toUpperCase(), x + 20, y + 22);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(val, x + 20, y + 44);
}

function drawCheckbox(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, checked: boolean) {
  ctx.fillStyle = checked ? "#2563eb" : "#ffffff";
  drawRoundedRect(ctx, x, y, 12, 12, 3);
  ctx.fill();
  ctx.strokeStyle = checked ? "#2563eb" : "#cbd5e1";
  ctx.stroke();

  if (checked) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 2.5, y + 6);
    ctx.lineTo(x + 5, y + 9);
    ctx.lineTo(x + 9.5, y + 3);
    ctx.stroke();
  }

  ctx.fillStyle = "#334155";
  ctx.font = "10px sans-serif";
  ctx.fillText(label, x + 18, y + 10);
}
