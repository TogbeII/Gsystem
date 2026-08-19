import React, { useState } from "react";
import { X, Printer, Download, Copy, Check, Barcode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../types";
import { BarcodeSvg } from "./BarcodeView";
import { formatCurrency } from "../lib/utils";
import jsPDF from "jspdf";

interface BarcodeLabelModalProps {
  product: Product | null;
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  product,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [printCount, setPrintCount] = useState(1);

  if (!product) return null;

  const barcodeValue = product.barcode || product.sku || product.name.slice(0, 10).toUpperCase();

  const handleCopy = () => {
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const labelsHtml = Array.from({ length: printCount })
      .map(
        () => `
        <div style="
          width: 58mm; 
          height: 38mm; 
          border: 1px dashed #cbd5e1; 
          padding: 3mm; 
          box-sizing: border-box; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: space-between; 
          font-family: sans-serif;
          page-break-inside: avoid;
          background: #fff;
          margin: 2mm;
        ">
          <div style="font-size: 8pt; font-weight: bold; text-align: center; text-transform: uppercase; color: #334155; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
            GENESYS INVENTORY
          </div>
          <div style="font-size: 9pt; font-weight: 800; text-align: center; color: #0f172a; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${product.name}
          </div>
          <div style="font-size: 11pt; font-weight: 900; color: #2563eb; margin: 1mm 0;">
            GH₵ ${Number(product.price).toFixed(2)}
          </div>
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="font-family: monospace; font-size: 9pt; font-weight: bold; letter-spacing: 2px; color: #0f172a;">
              * ${barcodeValue} *
            </div>
            <div style="font-size: 7pt; color: #64748b; font-family: monospace; margin-top: 1mm;">
              ${product.category} | SKU: ${product.sku || "N/A"}
            </div>
          </div>
        </div>
      `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Labels - ${product.name}</title>
          <style>
            @page { size: auto; margin: 5mm; }
            body { 
              margin: 0; 
              display: flex; 
              flex-wrap: wrap; 
              gap: 2mm; 
              justify-content: flex-start;
              font-family: sans-serif;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("GENESYS PRODUCT BARCODE LABEL", 105, 18, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 24, { align: "center" });

    // Draw 3x4 grid of labels on A4
    const cols = 3;
    const rows = 4;
    const labelWidth = 60;
    const labelHeight = 45;
    const startX = 15;
    const startY = 32;
    const gapX = 5;
    const gapY = 8;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (labelWidth + gapX);
        const y = startY + r * (labelHeight + gapY);

        // Border
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(x, y, labelWidth, labelHeight, 2, 2);

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("GENESYS INVENTORY", x + labelWidth / 2, y + 6, { align: "center" });

        // Item Name
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        const truncatedName = product.name.length > 22 ? product.name.slice(0, 22) + "..." : product.name;
        doc.text(truncatedName, x + labelWidth / 2, y + 12, { align: "center" });

        // Price
        doc.setFontSize(11);
        doc.setTextColor(37, 99, 235);
        doc.text(`GH₵ ${Number(product.price).toFixed(2)}`, x + labelWidth / 2, y + 19, { align: "center" });

        // Barcode Value Box
        doc.setFillColor(245, 247, 250);
        doc.rect(x + 5, y + 23, labelWidth - 10, 14, "F");
        doc.setFont("courier", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`||| ${barcodeValue} |||`, x + labelWidth / 2, y + 30, { align: "center" });
        doc.setFontSize(7);
        doc.setFont("courier", "normal");
        doc.text(barcodeValue, x + labelWidth / 2, y + 35, { align: "center" });

        // Footer category
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(140, 140, 140);
        doc.text(product.category, x + labelWidth / 2, y + 41, { align: "center" });
      }
    }

    doc.save(`barcode_labels_${product.sku || "product"}.pdf`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Barcode size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Product Barcode Label</h3>
                <p className="text-xs text-slate-400">Scannable barcode & printable shelf tags</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scannable Barcode Tag Card */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Genesys Retail & Warehouse Tag
            </span>

            <h4 className="font-extrabold text-slate-900 text-base max-w-xs truncate" title={product.name}>
              {product.name}
            </h4>

            <div className="text-xl font-black text-blue-600">
              {formatCurrency(product.price)}
            </div>

            {/* Visual SVG Barcode */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full flex flex-col items-center">
              <BarcodeSvg value={barcodeValue} height={50} barWidth={1.8} showText={true} />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                SKU: {product.sku || "N/A"}
              </span>
              <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                {product.category}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-700">Copies to print:</span>
              <div className="flex items-center gap-2">
                {[1, 4, 12].map((num) => (
                  <button
                    key={num}
                    onClick={() => setPrintCount(num)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      printCount === num
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {num} {num === 1 ? "Label" : "Labels"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={handleCopy}
                className="py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                {copied ? "Copied!" : "Copy Code"}
              </button>

              <button
                onClick={handleDownloadPDF}
                className="py-3 px-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download size={16} />
                PDF Sheet
              </button>

              <button
                onClick={handlePrint}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Printer size={16} />
                Print ({printCount})
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
