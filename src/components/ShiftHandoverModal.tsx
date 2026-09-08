import React, { useState, useEffect } from "react";
import { 
  X, 
  Printer, 
  Download, 
  Clock, 
  User as UserIcon, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Receipt, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  LogOut,
  History,
  RotateCcw
} from "lucide-react";
import { User, Sale, CashierShift } from "../types";
import { cn, formatCurrency, formatDate, formatCurrencyPDF } from "../lib/utils";
import { exportToPDF } from "../lib/exportUtils";

interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  sales: Sale[];
  businessName?: string;
  onShiftClosed?: (shift: CashierShift) => void;
  onSignOutAfterClose?: () => void;
}

export function ShiftHandoverModal({
  isOpen,
  onClose,
  currentUser,
  sales,
  businessName = "Genesys Supermarket & Retail",
  onShiftClosed,
  onSignOutAfterClose,
}: ShiftHandoverModalProps) {
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  const [openingFloat, setOpeningFloat] = useState<string>("0");
  const [actualCash, setActualCash] = useState<string>("");
  const [handoverNotes, setHandoverNotes] = useState<string>("");
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<CashierShift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHistoryShift, setSelectedHistoryShift] = useState<CashierShift | null>(null);

  const username = currentUser?.username || "admin";
  const fullName = currentUser?.fullName || "Administrator";

  // Fetch or initialize active shift
  useEffect(() => {
    if (!isOpen) return;

    const loadShiftData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch active shift from server
        const activeRes = await fetch(`/api/shifts/active?username=${encodeURIComponent(username)}`);
        const activeData = await activeRes.json();

        if (activeData && activeData.id) {
          setActiveShift(activeData);
          setOpeningFloat(String(activeData.openingFloat || 0));
        } else {
          // Initialize active shift session
          const startRes = await fetch("/api/shifts/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cashierUsername: username,
              cashierName: fullName,
              openingFloat: Number(openingFloat) || 0,
            }),
          });
          if (startRes.ok) {
            const newShift = await startRes.json();
            setActiveShift(newShift);
            setOpeningFloat(String(newShift.openingFloat || 0));
          }
        }

        // 2. Fetch history shifts
        const historyRes = await fetch("/api/shifts");
        const historyData = await historyRes.json();
        if (Array.isArray(historyData)) {
          setShiftHistory(historyData);
        }
      } catch (err) {
        console.error("Failed to load shift data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadShiftData();
  }, [isOpen, username, fullName]);

  if (!isOpen) return null;

  // Determine shift start time
  const shiftStartTime = activeShift?.startedAt ? new Date(activeShift.startedAt) : new Date();
  
  // Calculate elapsed duration string
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - shiftStartTime.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const durationString = `${diffHours}h ${diffMinutes}m`;

  // Filter sales made during this shift by this cashier
  const shiftSales = sales.filter((s) => {
    const saleDate = new Date(s.date);
    const isSameCashier = 
      (s.cashierUsername && s.cashierUsername.toLowerCase() === username.toLowerCase()) ||
      (!s.cashierUsername && username === "admin");

    // Match sales occurred after shift start, or fallback to today if startedAt is unavailable
    const isAfterStart = saleDate >= shiftStartTime;
    return isSameCashier && isAfterStart;
  });

  // Calculate totals
  const totalSalesCount = shiftSales.length;
  const totalItemsSold = shiftSales.reduce((acc, s) => {
    return acc + (s.items?.reduce((iAcc, item) => iAcc + (Number(item.quantity) || 0), 0) || 0);
  }, 0);
  const totalSalesAmount = shiftSales.reduce((acc, s) => acc + (s.total || 0), 0);

  const cashSalesAmount = shiftSales
    .filter((s) => s.paymentType === "cash")
    .reduce((acc, s) => acc + (s.amountPaid !== undefined ? s.amountPaid : s.total || 0), 0);

  const mobileMoneySalesAmount = shiftSales
    .filter((s) => s.paymentType === "mobile_money")
    .reduce((acc, s) => acc + (s.amountPaid !== undefined ? s.amountPaid : s.total || 0), 0);

  const creditSalesAmount = shiftSales
    .filter((s) => s.paymentType === "credit")
    .reduce((acc, s) => acc + (s.total || 0), 0);

  const numOpeningFloat = Number(openingFloat) || 0;
  const expectedCashInDrawer = numOpeningFloat + cashSalesAmount;
  const numActualCash = actualCash === "" ? expectedCashInDrawer : Number(actualCash) || 0;
  const discrepancy = numActualCash - expectedCashInDrawer;

  // Print 80mm Thermal Handover Receipt / Slip
  const handlePrintReceipt = (targetShift?: CashierShift) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the shift handover slip.");
      return;
    }

    const isTarget = !!targetShift;
    const printCashier = isTarget ? targetShift.cashierName : fullName;
    const printUsername = isTarget ? targetShift.cashierUsername : username;
    const printStart = isTarget ? formatDate(targetShift.startedAt) : formatDate(shiftStartTime.toISOString());
    const printEnd = isTarget ? (targetShift.endedAt ? formatDate(targetShift.endedAt) : "Active") : formatDate(new Date().toISOString());
    const printOpening = isTarget ? targetShift.openingFloat : numOpeningFloat;
    const printTotalSales = isTarget ? (targetShift.totalSalesAmount || 0) : totalSalesAmount;
    const printSalesCount = isTarget ? (targetShift.totalSalesCount || 0) : totalSalesCount;
    const printCash = isTarget ? (targetShift.cashSalesAmount || 0) : cashSalesAmount;
    const printMomo = isTarget ? (targetShift.mobileMoneySalesAmount || 0) : mobileMoneySalesAmount;
    const printCredit = isTarget ? (targetShift.creditSalesAmount || 0) : creditSalesAmount;
    const printExpected = isTarget ? (targetShift.expectedCash || 0) : expectedCashInDrawer;
    const printActual = isTarget ? (targetShift.actualCash !== undefined ? targetShift.actualCash : printExpected) : numActualCash;
    const printDiff = isTarget ? (targetShift.discrepancy || 0) : discrepancy;
    const printNotes = isTarget ? targetShift.notes : handoverNotes;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shift Handover Slip - ${printUsername.toUpperCase()}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 300px;
              margin: 0 auto;
              padding: 15px;
              color: #000;
              font-size: 12px;
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
            .subtitle { font-size: 11px; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .double-divider { border-top: 2px solid #000; margin: 8px 0; }
            .flex-between { display: flex; justify-content: space-between; margin: 3px 0; }
            .box { border: 1px solid #000; padding: 6px; margin: 8px 0; }
            .signatures { margin-top: 25px; }
            .sig-line { border-top: 1px solid #000; margin-top: 30px; padding-top: 4px; font-size: 10px; }
            @media print {
              body { width: 100%; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${businessName}</div>
            <div class="subtitle">CASHIER SHIFT HANDOVER REPORT</div>
            <div class="subtitle">Official Drawer Reconciliation</div>
          </div>
          <div class="divider"></div>
          <div class="flex-between"><span>Cashier:</span><span class="bold">${printCashier} (@${printUsername})</span></div>
          <div class="flex-between"><span>Shift Start:</span><span>${printStart}</span></div>
          <div class="flex-between"><span>Shift End:</span><span>${printEnd}</span></div>
          ${!isTarget ? `<div class="flex-between"><span>Duration:</span><span>${durationString}</span></div>` : ""}
          <div class="divider"></div>
          
          <div class="bold" style="margin-bottom: 4px;">SALES SUMMARY:</div>
          <div class="flex-between"><span>Total Transactions:</span><span class="bold">${printSalesCount}</span></div>
          ${!isTarget ? `<div class="flex-between"><span>Items Sold:</span><span>${totalItemsSold}</span></div>` : ""}
          <div class="flex-between"><span>Total Revenue:</span><span class="bold">${formatCurrency(printTotalSales)}</span></div>
          
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 4px;">PAYMENT BREAKDOWN:</div>
          <div class="flex-between"><span>Cash Sales:</span><span>${formatCurrency(printCash)}</span></div>
          <div class="flex-between"><span>Mobile Money:</span><span>${formatCurrency(printMomo)}</span></div>
          <div class="flex-between"><span>Credit / On Account:</span><span>${formatCurrency(printCredit)}</span></div>

          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 4px;">DRAWER RECONCILIATION:</div>
          <div class="flex-between"><span>(+) Opening Float:</span><span>${formatCurrency(printOpening)}</span></div>
          <div class="flex-between"><span>(+) Cash Sales:</span><span>${formatCurrency(printCash)}</span></div>
          <div class="flex-between bold"><span>(=) Expected Cash:</span><span>${formatCurrency(printExpected)}</span></div>
          <div class="flex-between bold"><span>Actual Cash Counted:</span><span>${formatCurrency(printActual)}</span></div>
          
          <div class="box text-center">
            <div class="bold" style="font-size: 13px;">
              DISCREPANCY: ${printDiff >= 0 ? `+${formatCurrency(printDiff)} (OVER)` : `${formatCurrency(printDiff)} (SHORT)`}
            </div>
            <div style="font-size: 10px; margin-top: 2px;">
              ${printDiff === 0 ? "Drawer 100% Balanced" : printDiff > 0 ? "Excess cash detected" : "Cash deficit recorded"}
            </div>
          </div>

          ${printNotes ? `<div style="font-size: 10px; margin-top: 6px;"><strong>Notes:</strong> ${printNotes}</div>` : ""}

          <div class="signatures">
            <div class="sig-line text-center">Outgoing Cashier Signature (${printCashier})</div>
            <div class="sig-line text-center">Supervisor / Incoming Cashier Signature</div>
          </div>

          <div class="divider"></div>
          <div class="text-center" style="font-size: 9px; color: #555; margin-top: 8px;">
            GENESYS RETAIL SYSTEM - AUDIT TRAIL VERIFIED
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 750);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Export Shift Report as PDF
  const handleExportPDF = () => {
    const headers = ["Item", "Details"];
    const data = [
      ["Cashier Name", `${fullName} (@${username})`],
      ["Shift Period", `${formatDate(shiftStartTime.toISOString())} to ${formatDate(new Date().toISOString())} (${durationString})`],
      ["Total Sales Revenue", formatCurrencyPDF(totalSalesAmount)],
      ["Total Receipts / Sales", `${totalSalesCount} transactions`],
      ["Total Items Rung Up", `${totalItemsSold} units`],
      ["Cash Payments", formatCurrencyPDF(cashSalesAmount)],
      ["Mobile Money Payments", formatCurrencyPDF(mobileMoneySalesAmount)],
      ["Credit / Accounts", formatCurrencyPDF(creditSalesAmount)],
      ["Opening Cash Float", formatCurrencyPDF(numOpeningFloat)],
      ["Expected Cash in Drawer", formatCurrencyPDF(expectedCashInDrawer)],
      ["Actual Cash Counted", formatCurrencyPDF(numActualCash)],
      ["Discrepancy (Over / Short)", formatCurrencyPDF(discrepancy)],
      ["Handover Notes", handoverNotes || "None"],
    ];

    exportToPDF(
      `${businessName} - Cashier Shift Handover Report`,
      headers,
      data,
      `shift_handover_${username}_${new Date().toISOString().split("T")[0]}`
    );
  };

  // Close shift on server
  const handleCloseShift = async (andSignOut = false) => {
    if (!activeShift?.id) {
      alert("No active shift session found to close.");
      return;
    }

    if (actualCash === "" && !window.confirm(`You have not entered a counted cash amount. Do you want to assume the drawer is balanced at ${formatCurrency(expectedCashInDrawer)}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: activeShift.id,
          actualCash: numActualCash,
          notes: handoverNotes,
          totalSalesCount,
          totalSalesAmount,
          cashSalesAmount,
          mobileMoneySalesAmount,
          creditSalesAmount,
          expectedCash: expectedCashInDrawer,
          discrepancy,
        }),
      });

      if (res.ok) {
        const closedShift = await res.json();
        if (onShiftClosed) onShiftClosed(closedShift);

        // Prompt to print slip
        if (window.confirm("Shift successfully closed and handover recorded! Would you like to print the official handover slip?")) {
          handlePrintReceipt(closedShift);
        }

        if (andSignOut && onSignOutAfterClose) {
          onClose();
          onSignOutAfterClose();
        } else {
          setActiveShift(null);
          // Refresh history
          const hRes = await fetch("/api/shifts");
          const hData = await hRes.json();
          if (Array.isArray(hData)) setShiftHistory(hData);
          setActiveTab("history");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to close shift");
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to close shift due to a network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">Cashier Shift Handover</h2>
              <p className="text-xs text-slate-500 font-medium">Reconcile drawer, print handover slips & transfer to incoming cashier</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold mr-2">
              <button
                type="button"
                onClick={() => setActiveTab("current")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                  activeTab === "current" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Current Shift
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1",
                  activeTab === "history" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <History size={13} />
                Shift Log ({shiftHistory.length})
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Close Dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {activeTab === "current" ? (
            <>
              {/* Cashier & Timing Bar */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Cashier</span>
                    <h4 className="font-bold text-slate-900 leading-tight">{fullName}</h4>
                    <span className="text-xs text-slate-500 font-mono">@{username}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Shift Started</span>
                    <h4 className="font-bold text-slate-900 leading-tight">{formatDate(shiftStartTime.toISOString())}</h4>
                    <span className="text-xs text-emerald-600 font-bold">On Duty ({durationString})</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Activity</span>
                    <h4 className="font-bold text-slate-900 leading-tight">{totalSalesCount} Receipts</h4>
                    <span className="text-xs text-slate-500">{totalItemsSold} Products Sold</span>
                  </div>
                </div>
              </div>

              {/* Sales Revenue Breakdown Cards */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Shift Sales by Tender Method</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Total Sales */}
                  <div className="p-4 bg-blue-50/70 border border-blue-200/70 rounded-2xl">
                    <div className="flex items-center justify-between text-blue-700 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Total Sales</span>
                      <DollarSign size={16} />
                    </div>
                    <p className="text-xl font-black text-blue-950">{formatCurrency(totalSalesAmount)}</p>
                    <span className="text-[10px] text-blue-700 font-medium">{totalSalesCount} transactions</span>
                  </div>

                  {/* Cash Sales */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl">
                    <div className="flex items-center justify-between text-emerald-700 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Cash Sales</span>
                      <DollarSign size={16} />
                    </div>
                    <p className="text-xl font-black text-emerald-950">{formatCurrency(cashSalesAmount)}</p>
                    <span className="text-[10px] text-emerald-700 font-medium">Adds to cash drawer</span>
                  </div>

                  {/* MoMo Sales */}
                  <div className="p-4 bg-purple-50/70 border border-purple-200/70 rounded-2xl">
                    <div className="flex items-center justify-between text-purple-700 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Mobile Money</span>
                      <Smartphone size={16} />
                    </div>
                    <p className="text-xl font-black text-purple-950">{formatCurrency(mobileMoneySalesAmount)}</p>
                    <span className="text-[10px] text-purple-700 font-medium">Electronic wallet</span>
                  </div>

                  {/* Credit Sales */}
                  <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-2xl">
                    <div className="flex items-center justify-between text-amber-700 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider">Credit Sales</span>
                      <CreditCard size={16} />
                    </div>
                    <p className="text-xl font-black text-amber-950">{formatCurrency(creditSalesAmount)}</p>
                    <span className="text-[10px] text-amber-700 font-medium">Customer ledger debts</span>
                  </div>
                </div>
              </div>

              {/* Drawer Reconciliation Section */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200/60 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <DollarSign size={18} className="text-emerald-600" />
                      Physical Cash Drawer Reconciliation
                    </h4>
                    <p className="text-xs text-slate-500">Compare physical bills counted against system expectations</p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border",
                    discrepancy === 0 
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : discrepancy > 0
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "bg-red-100 text-red-800 border-red-300"
                  )}>
                    {discrepancy === 0 ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Drawer Balanced (0.00)</span>
                      </>
                    ) : discrepancy > 0 ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Cash Overage: +{formatCurrency(discrepancy)}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} />
                        <span>Cash Shortage: {formatCurrency(discrepancy)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Opening Cash Float */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Opening Cash Float (GHS)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500/20 text-sm outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Initial cash placed in register</span>
                  </div>

                  {/* Expected Cash */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Expected Cash in Drawer
                    </label>
                    <div className="w-full px-3.5 py-2.5 bg-slate-200/60 border border-slate-300 rounded-xl text-slate-900 font-black text-sm flex items-center justify-between">
                      <span>{formatCurrency(expectedCashInDrawer)}</span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">Float + Cash</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Calculated by system</span>
                  </div>

                  {/* Actual Cash Counted */}
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1 flex items-center justify-between">
                      <span>Counted Cash in Drawer</span>
                      <span className="text-[10px] text-blue-600 font-normal">Enter physical count</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      placeholder={expectedCashInDrawer.toFixed(2)}
                      className={cn(
                        "w-full px-3.5 py-2.5 bg-white border rounded-xl font-black text-sm focus:ring-2 outline-none transition-all",
                        discrepancy === 0
                          ? "border-slate-300 text-slate-900 focus:ring-blue-500/20"
                          : discrepancy > 0
                          ? "border-blue-400 text-blue-800 bg-blue-50/20 focus:ring-blue-500/20"
                          : "border-red-400 text-red-800 bg-red-50/20 focus:ring-red-500/20"
                      )}
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {actualCash === "" ? `Defaults to ${formatCurrency(expectedCashInDrawer)}` : `Counted: ${formatCurrency(numActualCash)}`}
                    </span>
                  </div>
                </div>

                {/* Handover Comments */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Handover Notes & Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="E.g., Handed over register keys to Kwame. Cash counted and placed in safe."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              </div>

              {/* Actions & Print Options */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintReceipt()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                    title="Print 80mm Thermal Handover Receipt"
                  >
                    <Printer size={15} />
                    <span>Print Thermal Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                    title="Download PDF Handover Report"
                  >
                    <Download size={15} />
                    <span>Download PDF</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCloseShift(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    <FileText size={15} />
                    <span>Close Shift (Keep Logged In)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCloseShift(true)}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/20 disabled:opacity-50"
                  >
                    <LogOut size={15} />
                    <span>Close Shift & Hand Over (Sign Out)</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Shift History View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Completed Shift Handovers</h3>
                  <p className="text-xs text-slate-500">Historical records of cashier shift sessions and financial balancing</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-3 pl-4">Date & Time</th>
                      <th className="p-3">Cashier</th>
                      <th className="p-3 text-right">Revenue</th>
                      <th className="p-3 text-right">Expected</th>
                      <th className="p-3 text-right">Actual</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 pr-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {shiftHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No previous shift records found. Closed shifts will appear here.
                        </td>
                      </tr>
                    ) : (
                      shiftHistory.map((sh) => {
                        const isBalanced = (sh.discrepancy || 0) === 0;
                        return (
                          <tr key={sh.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 pl-4 text-slate-600">
                              <div className="font-bold text-slate-800">{formatDate(sh.startedAt)}</div>
                              <span className="text-[10px] text-slate-400">
                                {sh.endedAt ? `Closed: ${formatDate(sh.endedAt)}` : "Active"}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{sh.cashierName}</div>
                              <span className="text-[10px] text-slate-400">@{sh.cashierUsername}</span>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              {formatCurrency(sh.totalSalesAmount || 0)}
                            </td>
                            <td className="p-3 text-right text-slate-600">
                              {formatCurrency(sh.expectedCash || 0)}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800">
                              {formatCurrency(sh.actualCash || 0)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                                isBalanced ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                              )}>
                                {isBalanced ? "Balanced" : `${(sh.discrepancy || 0) > 0 ? "+" : ""}${formatCurrency(sh.discrepancy || 0)}`}
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-center">
                              <button
                                type="button"
                                onClick={() => handlePrintReceipt(sh)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Reprint Shift Slip"
                              >
                                <Printer size={12} />
                                <span>Slip</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Real-time POS session tracking enabled</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
