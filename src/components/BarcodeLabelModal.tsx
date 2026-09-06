import React, { useState } from "react";
import { X, Printer, Download, Copy, Check, Barcode, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../types";
import { BarcodeSvg, drawBarcodeToJsPdf, generateBarcodeSvgString } from "./BarcodeView";
import { formatCurrency, formatCurrencyPDF } from "../lib/utils";
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

    const barcodeSvgStr = generateBarcodeSvgString(barcodeValue, 36, 1.4, true);

    const labelsHtml = Array.from({ length: printCount })
      .map(
        () => `
        <div style="
          width: 58mm; 
          min-height: 38mm; 
          border: 1px dashed #cbd5e1; 
          padding: 2.5mm 3mm; 
          box-sizing: border-box; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: space-between; 
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          page-break-inside: avoid;
          background: #fff;
          margin: 2mm;
          border-radius: 4px;
        ">
          <div style="font-size: 9pt; font-weight: 800; text-align: center; color: #0f172a; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.5mm;">
            ${product.name}
          </div>
          <div style="font-size: 11pt; font-weight: 900; color: #2563eb; margin: 0.5mm 0;">
            ${formatCurrency(product.price)}
          </div>
          <div style="width: 100%; display: flex; justify-content: center; margin: 0.5mm 0; padding: 1.5mm 0; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; box-sizing: border-box;">
            ${barcodeSvgStr}
          </div>
          <div style="font-size: 6.5pt; color: #64748b; font-family: monospace; margin-top: 0.5mm;">
            ${product.category} | SKU: ${product.sku || "N/A"}
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
              font-family: system-ui, -apple-system, sans-serif;
              background: #f8fafc;
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

  const createProductPDFDoc = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const labelsPerPage = 12;
    const totalPages = Math.ceil(printCount / labelsPerPage) || 1;
    let labelIndex = 0;

    const cols = 3;
    const rows = 4;
    const labelWidth = 60;
    const labelHeight = 45;
    const startX = 15;
    const startY = 32;
    const gapX = 5;
    const gapY = 8;

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        doc.addPage();
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("GENESYS PRODUCT BARCODE LABELS", 105, 16, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Product: ${product.name} | Total Labels: ${printCount} (Page ${page + 1} of ${totalPages})`, 105, 22, { align: "center" });

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (labelIndex >= printCount) break;

          const x = startX + c * (labelWidth + gapX);
          const y = startY + r * (labelHeight + gapY);

          // Card Outer Border
          doc.setDrawColor(203, 213, 225);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x, y, labelWidth, labelHeight, 2.5, 2.5, "FD");

          // Item Name
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          const truncatedName = product.name.length > 22 ? product.name.slice(0, 22) + "..." : product.name;
          doc.text(truncatedName, x + labelWidth / 2, y + 7.5, { align: "center" });

          // Price (formatted reliably without cedi font encoding corruption)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(37, 99, 235);
          doc.text(formatCurrencyPDF(product.price), x + labelWidth / 2, y + 13.5, { align: "center" });

          // Real scannable Code 128 Barcode Display Box (matching system image exactly)
          drawBarcodeToJsPdf(
            doc,
            barcodeValue,
            x + 4,
            y + 16.5,
            labelWidth - 8,
            20,
            {
              showText: true,
              textSize: 7.5,
              drawBackground: true,
              backgroundColor: [255, 255, 255],
              borderColor: [226, 232, 240],
            }
          );

          // Footer category & SKU
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(140, 140, 140);
          doc.text(`${product.category} | SKU: ${product.sku || "N/A"}`, x + labelWidth / 2, y + 41.5, { align: "center" });

          labelIndex++;
        }
        if (labelIndex >= printCount) break;
      }
    }

    return doc;
  };

  const handleDownloadPDF = () => {
    try {
      const doc = createProductPDFDoc();
      doc.save(`barcode_labels_${product.sku || "product"}_${printCount}x.pdf`);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Failed to download PDF barcode sheet.");
    }
  };

  const handlePreviewPDF = () => {
    try {
      const doc = createProductPDFDoc();
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (err) {
      console.error("PDF preview error:", err);
      alert("Failed to preview PDF barcode sheet.");
    }
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Number of Label Stickers:</span>
                <span className="text-[11px] text-slate-400">Print as many as you need to stick onto stock items</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={printCount}
                    onChange={(e) => setPrintCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 px-2.5 py-1.5 text-center text-xs font-bold font-mono text-slate-800 focus:outline-none focus:bg-blue-50"
                  />
                  <span className="text-[11px] font-bold text-slate-400 pr-2.5">pcs</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 5, 12, 24, 48].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPrintCount(num)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        printCount === num
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={handleCopy}
                className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                {copied ? "Copied!" : "Copy Code"}
              </button>

              <button
                onClick={handlePreviewPDF}
                className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Preview full A4 PDF sheet before printing or saving"
              >
                <Eye size={15} className="text-blue-600" />
                Preview PDF
              </button>

              <button
                onClick={handleDownloadPDF}
                className="py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Download printable A4 PDF sheet"
              >
                <Download size={15} />
                Download PDF
              </button>

              <button
                onClick={handlePrint}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-slate-900/20 transition-all cursor-pointer"
              >
                <Printer size={15} />
                Print ({printCount})
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
