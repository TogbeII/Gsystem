import { useState, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  ShoppingCart, 
  Users, 
  Building, 
  Phone, 
  X, 
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Product, Invoice, InvoiceItem } from "../types";
import { cn, formatCurrency, formatDate, formatCurrencyPDF } from "../lib/utils";

interface InvoiceMenuViewProps {
  products: Product[];
  refresh: () => void | Promise<void>;
  config: {
    businessName: string;
    businessAddress: string;
    businessPhone: string;
  };
  key?: string;
}

export default function InvoiceMenuView({ products, refresh, config }: InvoiceMenuViewProps) {
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Invoice builder state
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState("");
  const [isVatEnabled, setIsVatEnabled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInvoiceTerm, setSearchInvoiceTerm] = useState("");

  // Modal / Print / Preview state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch invoices on mount
  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        setInvoices(data.sort((a: Invoice, b: Invoice) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }
    } catch (err: any) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      setCart(cart.map(item => 
        item.id === productId ? { ...item, quantity: qty } : item
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discountAmount = Number(discount) || 0;
  const netTotal = Math.max(0, subtotal - discountAmount);
  const vatAmount = isVatEnabled ? netTotal * 0.20 : 0;
  const grandTotal = netTotal + vatAmount;

  const handleGenerateInvoice = async () => {
    if (!clientName.trim()) {
      setErrorMsg("Please enter the client or company name.");
      return;
    }
    if (!clientContact.trim()) {
      setErrorMsg("Please enter the client's contact information.");
      return;
    }
    if (cart.length === 0) {
      setErrorMsg("Please add at least one product to the invoice.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoiceNum,
          clientName: clientName.trim(),
          clientContact: clientContact.trim(),
          items: cart,
          total: grandTotal,
          discount: discountAmount,
          vatEnabled: isVatEnabled,
          vatRate: isVatEnabled ? 20 : 0,
          vatAmount: vatAmount
        })
      });

      if (res.ok) {
        const newInvoice = await res.json();
        setSuccessMsg(`Invoice ${invoiceNum} generated successfully!`);
        // Reset builder form
        setClientName("");
        setClientContact("");
        setCart([]);
        setDiscount("");
        setIsVatEnabled(false);
        setSearchTerm("");
        
        // Refresh invoices list
        await fetchInvoices();
        
        // Open preview modal for the newly created invoice
        setSelectedInvoice(newInvoice);
        setShowPreviewModal(true);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to generate invoice");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (id: string, number: string) => {
    if (!confirm(`Are you sure you want to void/delete invoice ${number}? This action is irreversible.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchInvoices();
        setSuccessMsg(`Invoice ${number} was successfully deleted.`);
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        alert("Failed to delete invoice");
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Modern jsPDF Export
  const handleDownloadPDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(config.businessName || "Safety Pro Ghana", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    if (config.businessAddress) {
      doc.text(config.businessAddress, 14, 26);
    }
    if (config.businessPhone) {
      doc.text(`Phone: ${config.businessPhone}`, 14, 31);
    }
    
    // Invoice Title & Info (Right Aligned)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text("COMMERCIAL INVOICE", 200, 20, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 200, 26, { align: "right" });
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, 200, 31, { align: "right" });
    
    // Line separator
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(1);
    doc.line(14, 36, 200, 36);
    
    // Client section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text("INVOICE FOR:", 14, 46);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.clientName, 14, 52);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(invoice.clientContact, 14, 58);
    
    // Table
    const tableBody = invoice.items.map((item, idx) => [
      idx + 1,
      item.name,
      formatCurrencyPDF(item.price),
      item.quantity,
      formatCurrencyPDF(item.price * item.quantity)
    ]);
    
    autoTable(doc, {
      startY: 68,
      head: [["#", "Product / Service", "Unit Price", "Qty", "Total Price"]],
      body: tableBody,
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 10 },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right" }
      }
    });
    
    // Totals Block
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const isVat = invoice.vatEnabled;
    const vatVal = invoice.vatAmount || 0;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("Subtotal:", 140, finalY);
    doc.text("Discount:", 140, finalY + 6);
    
    let nextY = finalY + 12;
    if (isVat) {
      doc.text("VAT (20%):", 140, nextY);
      nextY += 6;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Grand Total:", 140, nextY);
    
    const rawSubtotal = invoice.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrencyPDF(rawSubtotal), 200, finalY, { align: "right" });
    doc.text(formatCurrencyPDF(invoice.discount || 0), 200, finalY + 6, { align: "right" });
    
    if (isVat) {
      doc.text(formatCurrencyPDF(vatVal), 200, finalY + 12, { align: "right" });
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrencyPDF(invoice.total), 200, nextY, { align: "right" });
    
    // Footer message
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Thank you for your business! This is an official commercial invoice.", 105, nextY + 18, { align: "center" });
    
    doc.save(`invoice_${invoice.invoiceNumber}.pdf`);
  };

  const handlePrintWindow = (invoice: Invoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print invoices directly.");
      return;
    }

    const itemsRows = invoice.items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px; text-align: left;">${idx + 1}</td>
        <td style="padding: 12px; text-align: left; font-weight: 500;">${item.name}</td>
        <td style="padding: 12px; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `).join("");

    const itemSubtotal = invoice.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const vatRowHtml = invoice.vatEnabled ? `
      <div class="totals-row">
        <span style="color: #64748b;">VAT (20%):</span>
        <span style="font-weight: 500;">${formatCurrency(invoice.vatAmount || 0)}</span>
      </div>
    ` : "";

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background-color: #f8fafc; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
            .totals-box { margin-left: auto; width: 300px; margin-top: 20px; font-size: 14px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .totals-row.grand { font-size: 18px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 12px; margin-top: 8px; color: #0f172a; }
            .footer { text-align: center; font-style: italic; font-size: 12px; color: #94a3b8; margin-top: 60px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <table class="header-table">
            <tr>
              <td style="vertical-align: top;">
                <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${config.businessName || "Safety Pro Ghana"}</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${config.businessAddress || ""}</div>
                <div style="font-size: 13px; color: #64748b;">Phone: ${config.businessPhone || ""}</div>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <div style="font-size: 24px; font-weight: bold; color: #1e293b; letter-spacing: -0.025em;">COMMERCIAL INVOICE</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Invoice #: <strong>${invoice.invoiceNumber}</strong></div>
                <div style="font-size: 13px; color: #64748b;">Date: ${new Date(invoice.date).toLocaleDateString()}</div>
              </td>
            </tr>
          </table>

          <div style="height: 1px; background-color: #f1f5f9; margin-bottom: 30px;"></div>

          <table class="details-table">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Invoice For:</div>
                <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${invoice.clientName}</div>
                <div style="font-size: 13px; color: #475569; margin-top: 4px; white-space: pre-line;">${invoice.clientContact}</div>
              </td>
              <td style="width: 50%; text-align: right; vertical-align: top;">
                <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Status:</div>
                <span style="display: inline-block; background-color: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">ISSUED</span>
              </td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Item / Description</th>
                <th style="text-align: right; width: 120px;">Unit Price</th>
                <th style="text-align: center; width: 80px;">Qty</th>
                <th style="text-align: right; width: 130px;">Total Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals-box">
            <div class="totals-row">
              <span style="color: #64748b;">Subtotal:</span>
              <span style="font-weight: 500;">${formatCurrency(itemSubtotal)}</span>
            </div>
            <div class="totals-row">
              <span style="color: #64748b;">Discount:</span>
              <span style="font-weight: 500; color: #dc2626;">-${formatCurrency(invoice.discount)}</span>
            </div>
            ${vatRowHtml}
            <div class="totals-row grand">
              <span>Grand Total:</span>
              <span>${formatCurrency(invoice.total)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing ${config.businessName || "us"}!</p>
            <p>If you have any questions regarding this invoice, please reach out to us using the contact info above.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoiceNumber.toLowerCase().includes(searchInvoiceTerm.toLowerCase()) ||
    inv.clientName.toLowerCase().includes(searchInvoiceTerm.toLowerCase()) ||
    inv.clientContact.toLowerCase().includes(searchInvoiceTerm.toLowerCase())
  );

  return (
    <div id="invoice-menu-container" className="space-y-8">
      {/* Title Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Invoice Menu</h1>
          <p className="text-slate-500 text-sm">Generate commercial inquiries and print receipts for walk-in buyers & corporate partners</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit self-start sm:self-center">
          <button 
            onClick={() => { setActiveTab("create"); setSuccessMsg(""); setErrorMsg(""); }}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
              activeTab === "create" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Plus size={16} />
            Create Invoice
          </button>
          <button 
            onClick={() => { setActiveTab("history"); setSuccessMsg(""); setErrorMsg(""); }}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
              activeTab === "history" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <FileText size={16} />
            Invoice History
            {invoices.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-[11px] bg-slate-100 text-slate-800 rounded-full font-black">
                {invoices.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notifications */}
      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold"
        >
          <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-sm font-semibold"
        >
          <AlertCircle className="text-rose-500 shrink-0" size={20} />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* Tab Contents */}
      {activeTab === "create" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Customer and Product Selection (8 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Customer Inputs */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <Users className="text-blue-500" size={20} />
                <h3 className="text-lg font-bold text-slate-800">1. Customer Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client / Company Name</label>
                  <div className="relative">
                    <Building className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input 
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Evans Safety Ltd"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-800 font-medium focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Details (Phone / Address)</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input 
                      value={clientContact}
                      onChange={(e) => setClientContact(e.target.value)}
                      placeholder="e.g. +233 241112233 / Accra"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-800 font-medium focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Product Catalog Picker */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="text-blue-500" size={20} />
                  <h3 className="text-lg font-bold text-slate-800">2. Select Shop Products</h3>
                </div>
                {/* Product Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or SKU..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs focus:border-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Product Grid */}
              <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm font-medium">
                    No matching products found.
                  </div>
                ) : (
                  filteredProducts.map(prod => {
                    const stock = prod.shopStock !== undefined ? prod.shopStock : 0;
                    return (
                      <div 
                        key={prod.id} 
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-50"
                      >
                        <div className="min-w-0 pr-4">
                          <p className="font-bold text-slate-800 text-sm truncate">{prod.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
                            <span className="font-mono bg-slate-200/50 px-1.5 py-0.5 rounded text-[10px] uppercase text-slate-500">{prod.sku}</span>
                            <span>•</span>
                            <span>Category: <span className="text-slate-600">{prod.category}</span></span>
                            <span>•</span>
                            <span>Stock: <span className={cn("font-bold", stock <= 3 ? "text-red-500" : "text-emerald-600")}>{stock}</span></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="font-extrabold text-slate-800 text-sm">{formatCurrency(prod.price)}</span>
                          <button 
                            onClick={() => addToCart(prod)}
                            className="bg-slate-900 text-white hover:bg-blue-600 p-2 rounded-lg transition-all"
                            title="Add to Invoice"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* RIGHT: Invoice Items Summary & Review (5 cols) */}
          <div className="lg:col-span-5 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 sticky top-8">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h3 className="text-lg font-bold text-slate-800">Invoice Items Summary</h3>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black text-slate-600 uppercase">
                {cart.length} {cart.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                  <ShoppingCart size={32} />
                </div>
                <div>
                  <p className="font-bold text-slate-500">Invoice list is empty</p>
                  <p className="text-xs text-slate-400 mt-1">Select products from the catalog list to start building this invoice.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[250px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50/60 rounded-xl border border-slate-100">
                      <div className="min-w-0 pr-3 flex-1">
                        <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">{formatCurrency(item.price)} each</p>
                      </div>
                      
                      {/* Quantity Editor */}
                      <div className="flex items-center gap-2 mr-3">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 bg-white border border-slate-200 hover:border-slate-300 rounded flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm"
                        >
                          -
                        </button>
                        <span className="font-mono text-xs font-bold w-6 text-center text-slate-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 bg-white border border-slate-200 hover:border-slate-300 rounded flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm"
                        >
                          +
                        </button>
                      </div>

                      {/* Total and Trash */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-slate-800">{formatCurrency(item.price * item.quantity)}</span>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-300 hover:text-red-500 transition-all p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculations Block */}
                <div className="border-t border-slate-100 pt-4 space-y-3 text-sm font-medium">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="text-slate-800 font-bold">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-slate-500">Add Discount (GH₵)</span>
                    <input 
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0.00"
                      className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-right font-mono text-xs focus:border-blue-500 text-slate-800 font-bold"
                    />
                  </div>

                  {/* VAT Toggle & Amount display */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Ghana VAT (20%)</span>
                      <span className="text-[10px] text-slate-400">Toggle standard VAT rate</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        id="vat-toggle-checkbox"
                        checked={isVatEnabled} 
                        onChange={(e) => setIsVatEnabled(e.target.checked)} 
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {isVatEnabled && (
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>VAT Amount (20.0%)</span>
                      <span className="text-slate-800 font-bold">{formatCurrency(vatAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-extrabold border-t border-dashed border-slate-100 pt-3 text-slate-900">
                    <span>Grand Total</span>
                    <span className="text-lg font-black text-slate-900">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {/* CTA Action button */}
                <button 
                  onClick={handleGenerateInvoice}
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-950 text-white p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 mt-4 cursor-pointer"
                >
                  <FileText size={18} />
                  {loading ? "Generating..." : "Generate Invoice Request"}
                </button>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Invoice History View */
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Generated Invoice Registry</h3>
              <p className="text-xs text-slate-400">View, download, or delete past generated invoices and requests</p>
            </div>
            
            {/* History Search */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                value={searchInvoiceTerm}
                onChange={(e) => setSearchInvoiceTerm(e.target.value)}
                placeholder="Search Invoice #, Client Name..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-xs focus:border-blue-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Registry Table */}
          {loading ? (
            <div className="text-center py-16 text-slate-500">
              Loading invoices list...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              No commercial invoices found in registry database.
            </div>
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Invoice Number</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Client Name / Corporate</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Contact Information</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Items Count</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Grand Total</th>
                    <th className="p-4 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="p-4 font-mono font-black text-slate-800 text-xs">
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-4 text-slate-500 text-xs">
                        {formatDate(inv.date)}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {inv.clientName}
                      </td>
                      <td className="p-4 text-slate-500 text-xs truncate max-w-[200px]" title={inv.clientContact}>
                        {inv.clientContact}
                      </td>
                      <td className="p-4 text-slate-500 text-right font-mono font-bold">
                        {inv.items.reduce((acc, i) => acc + i.quantity, 0)}
                      </td>
                      <td className="p-4 font-black text-slate-800 text-right">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => { setSelectedInvoice(inv); setShowPreviewModal(true); }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
                            title="Preview Invoice"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handlePrintWindow(inv)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-all"
                            title="Direct Print"
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-600 transition-all"
                            title="Delete / Void Invoice"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoice Detail & Print Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <header className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-slate-800">
                  <FileText className="text-blue-500" size={20} />
                  <span className="font-extrabold text-base">Commercial Invoice Preview</span>
                </div>
                <button 
                  onClick={() => { setShowPreviewModal(false); setSelectedInvoice(null); }}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </header>

              {/* Modal scrollable printable body area */}
              <div className="flex-1 overflow-y-auto p-10 space-y-8 select-text">
                
                {/* Invoice Letterhead */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{config.businessName || "Safety Pro Ghana"}</h2>
                    <p className="text-slate-500 text-xs mt-1 font-semibold">{config.businessAddress || "Address not configured"}</p>
                    <p className="text-slate-500 text-xs font-semibold">Phone: {config.businessPhone || "Phone not configured"}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <h1 className="text-2xl font-black text-slate-800 tracking-wider">INVOICE</h1>
                    <p className="text-slate-500 text-xs mt-1 font-mono">Invoice #: <strong className="text-slate-800">{selectedInvoice.invoiceNumber}</strong></p>
                    <p className="text-slate-500 text-xs font-semibold">Date: {new Date(selectedInvoice.date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="h-px bg-slate-100"></div>

                {/* Bill To & Metadata */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">Invoice For:</p>
                    <h3 className="text-lg font-black text-slate-900">{selectedInvoice.clientName}</h3>
                    <p className="text-slate-600 text-xs font-medium mt-1 whitespace-pre-line leading-relaxed">{selectedInvoice.clientContact}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">Status:</p>
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                      ISSUED
                    </span>
                  </div>
                </div>

                {/* Items Table inside Modal */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 font-bold text-slate-500 uppercase border-b border-slate-100">
                      <tr>
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">Description / Item</th>
                        <th className="p-3 text-right w-24">Unit Price</th>
                        <th className="p-3 text-center w-16">Qty</th>
                        <th className="p-3 text-right w-28">Total Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedInvoice.items.map((item, idx) => (
                        <tr key={item.id} className="text-slate-700">
                          <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="p-3 text-right font-mono">{formatCurrency(item.price)}</td>
                          <td className="p-3 text-center font-mono">{item.quantity}</td>
                          <td className="p-3 text-right font-black text-slate-900 font-mono">{formatCurrency(item.price * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals blocks */}
                <div className="flex justify-end font-medium">
                  <div className="w-64 space-y-2.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal:</span>
                      <span className="text-slate-800 font-bold font-mono">{formatCurrency(selectedInvoice.items.reduce((acc, i) => acc + (i.price * i.quantity), 0))}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Discount Amount:</span>
                      <span className="text-red-500 font-bold font-mono">-${formatCurrency(selectedInvoice.discount || 0)}</span>
                    </div>
                    {selectedInvoice.vatEnabled && (
                      <div className="flex justify-between text-slate-500">
                        <span>VAT (20%):</span>
                        <span className="text-slate-800 font-bold font-mono">{formatCurrency(selectedInvoice.vatAmount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-extrabold border-t border-dashed border-slate-200 pt-2.5 text-slate-900">
                      <span>Grand Total:</span>
                      <span className="text-base font-black font-mono text-slate-900">{formatCurrency(selectedInvoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer instructions */}
                <div className="text-center text-[10px] font-medium text-slate-400 pt-4 italic leading-relaxed">
                  <p>Thank you for choosing {config.businessName || "Safety Pro Ghana"}!</p>
                  <p className="mt-1">This is an official commercial invoice representing items quoted for delivery or dispatch.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <footer className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:justify-end gap-3">
                <button 
                  onClick={() => handleDownloadPDF(selectedInvoice)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={16} />
                  Download PDF
                </button>
                <button 
                  onClick={() => handlePrintWindow(selectedInvoice)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Printer size={16} />
                  Print / Save Invoice
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
