import React, { useState, useEffect, useRef } from "react";
import { 
  Barcode, 
  Camera, 
  ScanLine, 
  Volume2, 
  VolumeX, 
  Printer, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  ShoppingCart, 
  Copy, 
  Check, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  ExternalLink,
  Info,
  SlidersHorizontal,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Product, User } from "../types";
import { BarcodeSvg } from "./BarcodeView";
import { BarcodeLabelModal } from "./BarcodeLabelModal";
import { cn, formatCurrency, playScanSound } from "../lib/utils";
import jsPDF from "jspdf";

interface BarcodeScannerHubViewProps {
  products: Product[];
  refresh: () => void | Promise<void>;
  user: User | null;
  config: { businessName: string; businessAddress?: string; businessPhone?: string };
  onNavigateToPOS?: () => void;
  key?: string;
}

interface ScanHistoryItem {
  id: string;
  code: string;
  timestamp: string;
  source: "camera" | "hardware" | "manual";
  status: "found" | "not_found";
  product?: Product;
}

export default function BarcodeScannerHubView({
  products,
  refresh,
  user,
  config,
  onNavigateToPOS
}: BarcodeScannerHubViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"scanner" | "catalog" | "bulk_print">("scanner");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("pos_beep_sound") !== "false";
  });

  // Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [manualInput, setManualInput] = useState("");
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string>("");
  const [scanStatus, setScanStatus] = useState<"idle" | "found" | "not_found">("idle");
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isAssigningBarcode, setIsAssigningBarcode] = useState(false);
  const [selectedProductToAssign, setSelectedProductToAssign] = useState<string>("");

  // Catalog / Label Studio State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [barcodeModalProduct, setBarcodeModalProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk Print State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [labelsPerProduct, setLabelsPerProduct] = useState<number>(4);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  // Hardware Scanner buffer
  const scanBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "barcode-camera-reader-viewport";

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("pos_beep_sound", next ? "true" : "false");
  };

  // Hardware Scanner Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement).isContentEditable
      );

      // If user is focused on the search box or manual box, allow normal typing unless fast barcode stream
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const buffer = scanBufferRef.current.trim();
        scanBufferRef.current = "";

        if (buffer.length >= 3) {
          e.preventDefault();
          processBarcode(buffer, "hardware");
          return;
        }

        // If in manual search input and pressed Enter
        if (isInput && manualInput.trim().length >= 3) {
          e.preventDefault();
          processBarcode(manualInput.trim(), "manual");
          setManualInput("");
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (timeDiff < 55) {
          scanBufferRef.current += e.key;
        } else {
          scanBufferRef.current = e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [products, soundEnabled, manualInput]);

  // Load available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch(() => {
        // Fallback gracefully if permissions aren't requested yet
      });

    return () => {
      stopCameraScanner();
    };
  }, []);

  const startCameraScanner = async (cameraId?: string) => {
    setCameraError(null);
    setCameraActive(true);

    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
      }

      const qrScanner = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = qrScanner;

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: "environment" };

      await qrScanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.777778,
        },
        (decodedText) => {
          if (decodedText) {
            processBarcode(decodedText, "camera");
          }
        },
        () => {
          // Ignore parse errors per frame
        }
      );
    } catch (err: any) {
      console.error("Camera scanner failed to start:", err);
      setCameraError(err?.message || "Camera access was denied or no camera device was found.");
      setCameraActive(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  // Central Barcode Resolution Engine
  const processBarcode = (rawCode: string, source: "camera" | "hardware" | "manual"): boolean => {
    const clean = rawCode.trim();
    if (!clean) return false;

    setLastScannedCode(clean);

    const lower = clean.toLowerCase();
    const cleanDigits = clean.replace(/\D/g, "");

    const matched = products.find((p) => {
      const pBarcode = (p.barcode || "").trim().toLowerCase();
      const pSku = (p.sku || "").trim().toLowerCase();

      // 1. Exact Barcode or SKU match
      if (pBarcode && pBarcode === lower) return true;
      if (pSku && pSku === lower) return true;

      // 2. Numeric Digit Matching (handles leading zero UPC / EAN differences)
      if (cleanDigits.length >= 6) {
        const pBarcodeDigits = (p.barcode || "").replace(/\D/g, "");
        if (
          pBarcodeDigits &&
          (pBarcodeDigits === cleanDigits ||
            pBarcodeDigits.replace(/^0+/, "") === cleanDigits.replace(/^0+/, ""))
        ) {
          return true;
        }
      }

      // 3. Fallback ID match
      if (p.id.toLowerCase() === lower || p.id.split("-")[0].toLowerCase() === lower) return true;

      return false;
    });

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (matched) {
      if (soundEnabled) playScanSound("success");
      setLastScannedProduct(matched);
      setScanStatus("found");

      setScanHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          code: clean,
          timestamp,
          source,
          status: "found",
          product: matched,
        },
        ...prev.slice(0, 19),
      ]);
      return true;
    } else {
      if (soundEnabled) playScanSound("error");
      setLastScannedProduct(null);
      setScanStatus("not_found");

      setScanHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          code: clean,
          timestamp,
          source,
          status: "not_found",
        },
        ...prev.slice(0, 19),
      ]);
      return false;
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Quick Barcode Auto-Generator & Assigner
  const handleAutoAssignBarcode = async (productId: string, customCode?: string) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;

    // Generate standard 12-digit EAN-style code if not specified
    const generated = customCode || `GN${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User": user?.username || "",
        },
        body: JSON.stringify({
          ...targetProduct,
          barcode: generated,
        }),
      });

      if (res.ok) {
        await refresh();
        setIsAssigningBarcode(false);
        setSelectedProductToAssign("");
        if (soundEnabled) playScanSound("success");
      } else {
        alert("Failed to assign barcode to product.");
      }
    } catch (err) {
      console.error("Error assigning barcode:", err);
    }
  };

  // Filter Catalog Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesMissing = !filterMissingOnly || !p.barcode;

    return matchesSearch && matchesCategory && matchesMissing;
  });

  // Bulk Label PDF Generation
  const handleGenerateBulkPDF = () => {
    const selectedList = products.filter((p) => selectedProductIds.has(p.id));
    if (selectedList.length === 0) {
      alert("Please select at least one product to generate barcode labels.");
      return;
    }

    setBulkGenerating(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const cols = 3;
      const rows = 5;
      const labelWidth = 60;
      const labelHeight = 44;
      const startX = 12;
      const startY = 24;
      const gapX = 6;
      const gapY = 8;
      const labelsPerPage = cols * rows;

      // Expand list by labelsPerProduct count
      const allLabels: Product[] = [];
      selectedList.forEach((prod) => {
        for (let i = 0; i < labelsPerProduct; i++) {
          allLabels.push(prod);
        }
      });

      const totalPages = Math.ceil(allLabels.length / labelsPerPage) || 1;
      let labelIdx = 0;

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage();

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("GENESYS PRODUCT BARCODE SHEET", 105, 12, { align: "center" });

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          `${config.businessName || "Genesys POS"} | Total Labels: ${allLabels.length} (Page ${page + 1} of ${totalPages})`,
          105,
          17,
          { align: "center" }
        );

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (labelIdx >= allLabels.length) break;

            const p = allLabels[labelIdx];
            const codeVal = p.barcode || p.sku || p.id.slice(0, 10).toUpperCase();

            const x = startX + c * (labelWidth + gapX);
            const y = startY + r * (labelHeight + gapY);

            // Border box
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(x, y, labelWidth, labelHeight, 2, 2);

            // Tag Header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text("GENESYS INVENTORY", x + labelWidth / 2, y + 5.5, { align: "center" });

            // Product Name
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            const truncated = p.name.length > 24 ? p.name.slice(0, 24) + "..." : p.name;
            doc.text(truncated, x + labelWidth / 2, y + 11, { align: "center" });

            // Price
            doc.setFontSize(10.5);
            doc.setTextColor(37, 99, 235);
            doc.text(`GH₵ ${Number(p.price).toFixed(2)}`, x + labelWidth / 2, y + 17, { align: "center" });

            // Barcode Display Box
            doc.setFillColor(248, 250, 252);
            doc.rect(x + 3, y + 20, labelWidth - 6, 16, "F");

            doc.setFont("courier", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(`||| ${codeVal} |||`, x + labelWidth / 2, y + 27, { align: "center" });

            doc.setFontSize(7.5);
            doc.setFont("courier", "normal");
            doc.text(codeVal, x + labelWidth / 2, y + 32.5, { align: "center" });

            // Category & SKU Footer
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(140, 140, 140);
            doc.text(`${p.category} | SKU: ${p.sku || "N/A"}`, x + labelWidth / 2, y + 40, { align: "center" });

            labelIdx++;
          }
          if (labelIdx >= allLabels.length) break;
        }
      }

      doc.save(`genesys_bulk_barcodes_${selectedList.length}products_${allLabels.length}labels.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate bulk PDF.");
    } finally {
      setBulkGenerating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleProductSelect = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-200">
            <ScanLine size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Barcode Studio & Scanner</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-200">
                Online & Hardware Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Live camera scanning, handheld scanner auto-capture, label printing & barcode generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
              soundEnabled
                ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
            )}
            title={soundEnabled ? "Scan beep sound ON (Click to mute)" : "Scan beep sound MUTED (Click to unmute)"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span className="hidden sm:inline">{soundEnabled ? "Sound ON" : "Muted"}</span>
          </button>

          {/* Navigation Pill Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveSubTab("scanner")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeSubTab === "scanner"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Camera size={15} />
              <span>Live Scanner</span>
            </button>

            <button
              onClick={() => setActiveSubTab("catalog")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeSubTab === "catalog"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Barcode size={15} />
              <span>Barcode Catalog</span>
            </button>

            <button
              onClick={() => setActiveSubTab("bulk_print")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeSubTab === "bulk_print"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Printer size={15} />
              <span>Bulk Label Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LIVE SCANNER TAB */}
      {/* ========================================================================= */}
      {activeSubTab === "scanner" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Camera Viewport & Manual Input */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Camera Scanner Box */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    cameraActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                  )} />
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    Camera Barcode Scanner
                  </h3>
                </div>

                {availableCameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      if (cameraActive) startCameraScanner(e.target.value);
                    }}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-none"
                  >
                    {availableCameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Viewport Box */}
              <div className="relative bg-slate-950 rounded-2xl overflow-hidden min-h-[300px] flex flex-col items-center justify-center text-white border border-slate-800">
                <div
                  id={scannerContainerId}
                  className={cn("w-full h-full min-h-[300px]", !cameraActive && "hidden")}
                />

                {!cameraActive && (
                  <div className="text-center p-8 space-y-4 max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-blue-400">
                      <Camera size={32} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-base">Camera Scanner Idle</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Use your device webcam, mobile camera, or scan instantly with your USB/Bluetooth hardware scanner barcode gun.
                      </p>
                    </div>
                    <button
                      onClick={() => startCameraScanner(selectedCameraId)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <Camera size={16} />
                      Start Camera Scanner
                    </button>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl text-xs z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-bold text-slate-200">Live Detecting (Code128, EAN, UPC)</span>
                    </div>
                    <button
                      onClick={stopCameraScanner}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Hardware Scanner Terminal & Manual Barcode Input */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanLine size={18} className="text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    Hardware Scanner & Manual Entry
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  Scanner Listener: ACTIVE
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Any handheld USB or Bluetooth scanner connected to your computer will scan directly into this screen automatically without needing to focus on an input box.
              </p>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3.5 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && manualInput.trim()) {
                        processBarcode(manualInput.trim(), "manual");
                        setManualInput("");
                      }
                    }}
                    placeholder="Scan with gun or type barcode / SKU here..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-500/10 outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    if (manualInput.trim()) {
                      processBarcode(manualInput.trim(), "manual");
                      setManualInput("");
                    }
                  }}
                  className="px-5 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Lookup
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Scanned Product Details & Recent Scan History */}
          <div className="lg:col-span-5 space-y-6">
            {/* Scanned Result Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Package size={16} className="text-blue-600" />
                  Product Scanned Card
                </h3>
                {scanStatus !== "idle" && (
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      scanStatus === "found"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    )}
                  >
                    {scanStatus === "found" ? "Product Matched" : "Not Found"}
                  </span>
                )}
              </div>

              {lastScannedProduct ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                          {lastScannedProduct.category}
                        </span>
                        <h4 className="text-lg font-black text-slate-900 mt-0.5">
                          {lastScannedProduct.name}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-bold block">Selling Price</span>
                        <span className="text-xl font-black text-blue-600">
                          {formatCurrency(lastScannedProduct.price)}
                        </span>
                      </div>
                    </div>

                    {/* Stock Breakdown */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Shop Stock</span>
                        <span className={cn(
                          "text-base font-black font-mono",
                          (lastScannedProduct.shopStock || 0) < 5 ? "text-rose-600" : "text-slate-800"
                        )}>
                          {lastScannedProduct.shopStock || 0} pcs
                        </span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Warehouse</span>
                        <span className="text-base font-black font-mono text-slate-800">
                          {lastScannedProduct.warehouseStock || 0} pcs
                        </span>
                      </div>
                    </div>

                    {/* Barcode Display */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/60 flex flex-col items-center">
                      <BarcodeSvg
                        value={lastScannedProduct.barcode || lastScannedProduct.sku || lastScannedProduct.id.slice(0, 10)}
                        height={40}
                        showText={true}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => setBarcodeModalProduct(lastScannedProduct)}
                      className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer size={15} />
                      Print Barcode Label
                    </button>

                    {onNavigateToPOS && (
                      <button
                        onClick={onNavigateToPOS}
                        className="p-3 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ShoppingCart size={15} />
                        Go to POS Sale
                      </button>
                    )}
                  </div>
                </div>
              ) : scanStatus === "not_found" ? (
                <div className="py-8 text-center space-y-3 bg-rose-50/50 rounded-2xl border border-rose-100 p-6">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Barcode Not in Database</h4>
                    <p className="text-xs text-slate-500 font-mono mt-1">Code: "{lastScannedCode}"</p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setIsAssigningBarcode(true);
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      Assign this Barcode to a Product
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Barcode size={36} className="mx-auto text-slate-300" />
                  <p className="text-xs font-medium">Ready to scan. Point camera or scan with barcode gun.</p>
                </div>
              )}
            </div>

            {/* Quick Assign Modal / Overlay */}
            <AnimatePresence>
              {isAssigningBarcode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 border-2 border-blue-500 shadow-xl space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm">Assign Barcode: {lastScannedCode}</h4>
                    <button onClick={() => setIsAssigningBarcode(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                      <X size={16} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    Select which inventory product to link to barcode <strong className="font-mono">{lastScannedCode}</strong>:
                  </p>

                  <select
                    value={selectedProductToAssign}
                    onChange={(e) => setSelectedProductToAssign(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category}) - {p.barcode ? `Current: ${p.barcode}` : "No Barcode"}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAssigningBarcode(false)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!selectedProductToAssign}
                      onClick={() => handleAutoAssignBarcode(selectedProductToAssign, lastScannedCode)}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs"
                    >
                      Save Barcode
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recent Scan History */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                  Recent Scan Activity
                </h3>
                {scanHistory.length > 0 && (
                  <button
                    onClick={() => setScanHistory([])}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {scanHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-bold",
                          item.status === "found" ? "bg-emerald-500" : "bg-rose-500"
                        )}
                      >
                        {item.status === "found" ? <Check size={14} /> : <X size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {item.product ? item.product.name : `Unknown (${item.code})`}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.timestamp} • {item.source}
                        </p>
                      </div>
                    </div>

                    {item.product && (
                      <span className="font-black text-blue-600 shrink-0 font-mono">
                        {formatCurrency(item.product.price)}
                      </span>
                    )}
                  </div>
                ))}

                {scanHistory.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-400">No recent scans recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BARCODE CATALOG & LABEL STUDIO */}
      {/* ========================================================================= */}
      {activeSubTab === "catalog" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products by name, SKU, or barcode..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white outline-none"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterMissingOnly}
                  onChange={(e) => setFilterMissingOnly(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Missing Barcode Only</span>
              </label>
            </div>

            <button
              onClick={refresh}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} /> Refresh Catalog
            </button>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const codeVal = p.barcode || p.sku || p.id.slice(0, 10).toUpperCase();

              return (
                <div
                  key={p.id}
                  className="p-5 bg-white border border-slate-200 hover:border-blue-300 rounded-2xl shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {p.category}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      </div>
                      <span className="font-black text-blue-600 text-sm">
                        {formatCurrency(p.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span>SKU: {p.sku || "N/A"}</span>
                      <span>•</span>
                      <span>Shop: {p.shopStock || 0}</span>
                      <span>•</span>
                      <span>WH: {p.warehouseStock || 0}</span>
                    </div>
                  </div>

                  {/* Scannable SVG Barcode preview */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                    <BarcodeSvg value={codeVal} height={36} showText={true} />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setBarcodeModalProduct(p)}
                      className="flex-1 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer size={14} /> Print Label
                    </button>

                    {!p.barcode && (
                      <button
                        onClick={() => handleAutoAssignBarcode(p.id)}
                        className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        title="Auto-generate a new barcode for this product"
                      >
                        <Sparkles size={14} /> Auto-Code
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(codeVal, p.id)}
                      className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
                      title="Copy Barcode Value"
                    >
                      {copiedId === p.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 space-y-2">
                <Barcode size={36} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700">No products match your filter</p>
                <p className="text-xs text-slate-400">Try changing your search terms or category selection</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BULK LABEL PRINTING STUDIO */}
      {/* ========================================================================= */}
      {activeSubTab === "bulk_print" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-black text-slate-900 text-base">Bulk Printable A4 Barcode Sheets</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate high-resolution printable PDF sheets (15 labels per A4 page) for inventory tagging & thermal sticker rolls.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700">Labels per Product:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={labelsPerProduct}
                  onChange={(e) => setLabelsPerProduct(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 px-2 py-1 font-bold font-mono text-center bg-slate-50 rounded-lg text-xs outline-none"
                />
              </div>

              <button
                disabled={selectedProductIds.size === 0 || bulkGenerating}
                onClick={handleGenerateBulkPDF}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer size={16} />
                {bulkGenerating ? "Generating PDF..." : `Generate PDF (${selectedProductIds.size * labelsPerProduct} Labels)`}
              </button>
            </div>
          </div>

          {/* Table of Selectable Products */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-4">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded text-blue-600"
                    />
                  </th>
                  <th className="p-3 font-bold text-slate-600 uppercase">Product Name</th>
                  <th className="p-3 font-bold text-slate-600 uppercase">Category</th>
                  <th className="p-3 font-bold text-slate-600 uppercase">SKU / Code</th>
                  <th className="p-3 font-bold text-slate-600 uppercase text-right">Price</th>
                  <th className="p-3 font-bold text-slate-600 uppercase text-center">Shop Stock</th>
                  <th className="p-3 font-bold text-slate-600 uppercase text-center">Warehouse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => toggleProductSelect(p.id)}
                    className={cn(
                      "hover:bg-blue-50/40 cursor-pointer transition-colors",
                      selectedProductIds.has(p.id) && "bg-blue-50/60 font-medium"
                    )}
                  >
                    <td className="p-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(p.id)}
                        onChange={() => toggleProductSelect(p.id)}
                        className="rounded text-blue-600"
                      />
                    </td>
                    <td className="p-3 font-bold text-slate-900">{p.name}</td>
                    <td className="p-3 text-slate-500">{p.category}</td>
                    <td className="p-3 font-mono text-slate-600">{p.barcode || p.sku || "N/A"}</td>
                    <td className="p-3 font-bold text-blue-600 text-right">{formatCurrency(p.price)}</td>
                    <td className="p-3 text-center font-mono">{p.shopStock || 0}</td>
                    <td className="p-3 text-center font-mono">{p.warehouseStock || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barcode Label Modal */}
      <BarcodeLabelModal
        product={barcodeModalProduct}
        onClose={() => setBarcodeModalProduct(null)}
      />
    </div>
  );
}
