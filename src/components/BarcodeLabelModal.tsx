import React, { useState } from "react";
import { X, Printer, Download, Copy, Check, Barcode, Eye, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../types";
import { BarcodeSvg, drawBarcodeToJsPdf, generateBarcodeSvgString } from "./BarcodeView";
import { formatCurrency, formatCurrencyPDF } from "../lib/utils";
import jsPDF from "jspdf";

interface BarcodeLabelModalProps {
  product: Product | null;
  onClose: () => void;
}

export type LabelPrintFormat = "40x60" | "58x40" | "a4";

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  product,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [printCount, setPrintCount] = useState(1);
  const [labelFormat, setLabelFormat] = useState<LabelPrintFormat>("40x60");

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

    if (labelFormat === "40x60") {
      // Direct thermal 40mm x 60mm sticker roll
      const barcodeSvgStr = generateBarcodeSvgString(barcodeValue, 28, 1.3, true);

      const labelsHtml = Array.from({ length: printCount })
        .map(
          () => `
          <div class="label-page">
            <div class="store-tag">GENESYS POS</div>
            <div class="product-title">${product.name}</div>
            <div class="product-price">${formatCurrency(product.price)}</div>
            <div class="barcode-box">
              ${barcodeSvgStr}
            </div>
            <div class="product-meta">
              <span>SKU: ${product.sku || "N/A"}</span>
              <span>•</span>
              <span>${product.category || "General"}</span>
            </div>
          </div>
        `
        )
        .join("");

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Barcode Label (40x60mm) - ${product.name}</title>
            <style>
              @page {
                size: 40mm 60mm;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 40mm;
                background: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                color: #000000;
              }
              .label-page {
                width: 40mm;
                height: 60mm;
                max-width: 40mm;
                max-height: 60mm;
                page-break-after: always;
                page-break-inside: avoid;
                padding: 3mm 2mm 2.5mm 2mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                text-align: center;
                overflow: hidden;
                background: #ffffff;
              }
              .store-tag {
                font-size: 6.5pt;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: #475569;
                line-height: 1;
              }
              .product-title {
                font-size: 8.5pt;
                font-weight: 900;
                line-height: 1.15;
                color: #0f172a;
                margin: 1mm 0 0.5mm 0;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                word-break: break-word;
              }
              .product-price {
                font-size: 11pt;
                font-weight: 900;
                color: #000000;
                line-height: 1;
                margin: 0.5mm 0 1mm 0;
              }
              .barcode-box {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #ffffff;
                margin: 0.5mm 0;
              }
              .barcode-box svg {
                max-width: 36mm;
                height: auto;
              }
              .product-meta {
                font-size: 6pt;
                font-weight: 700;
                color: #64748b;
                display: flex;
                gap: 1.5mm;
                justify-content: center;
                line-height: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
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
      return;
    }

    // Fallback: 58mm x 40mm or standard sticker grid
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
    if (labelFormat === "40x60") {
      // Exact 40mm x 60mm Thermal Roll Label (1 label per page, portrait)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [40, 60],
      });

      for (let i = 0; i < printCount; i++) {
        if (i > 0) {
          doc.addPage([40, 60], "portrait");
        }

        // Outer margin border guide
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(1.5, 1.5, 37, 57, 1.5, 1.5, "D");

        // Brand Tag
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text("GENESYS POS", 20, 5, { align: "center" });

        // Product Name (truncated to 22 chars for perfect fit)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const truncatedName = product.name.length > 20 ? product.name.slice(0, 20) + "..." : product.name;
        doc.text(truncatedName, 20, 9.5, { align: "center" });

        // Product Price
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(37, 99, 235);
        doc.text(formatCurrencyPDF(product.price), 20, 15, { align: "center" });

        // Barcode Drawing (centered, 34mm wide, 24mm tall)
        drawBarcodeToJsPdf(
          doc,
          barcodeValue,
          3,
          18,
          34,
          26,
          {
            showText: true,
            textSize: 7,
            drawBackground: true,
            backgroundColor: [255, 255, 255],
            borderColor: [241, 245, 249],
          }
        );

        // Footer details
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(`SKU: ${product.sku || "N/A"}`, 20, 50, { align: "center" });
        doc.text(product.category || "General", 20, 54, { align: "center" });
      }

      return doc;
    }

    // Default A4 sheet (12 labels per page)
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

          // Price
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(37, 99, 235);
          doc.text(formatCurrencyPDF(product.price), x + labelWidth / 2, y + 13.5, { align: "center" });

          // Real scannable Code 128 Barcode Display Box
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
      const formatSuffix = labelFormat === "40x60" ? "40x60mm_thermal" : "a4_sheet";
      doc.save(`barcode_label_${product.sku || "product"}_${formatSuffix}_${printCount}x.pdf`);
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
          className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 relative max-h-[92vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Barcode size={22} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Product Barcode Label Studio</h3>
                <p className="text-xs text-slate-400">Print settings, thermal stickers & live preview</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Print Setting / Label Size Selector */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Settings2 size={14} className="text-blue-600" />
                Print Setting / Label Size:
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {labelFormat === "40x60" ? "40mm × 60mm Active" : labelFormat === "58x40" ? "58mm × 40mm Active" : "A4 Sheet Active"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setLabelFormat("40x60")}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  labelFormat === "40x60"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                40mm × 60mm
                <span className="block text-[9px] font-normal opacity-90">Thermal Roll</span>
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat("58x40")}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  labelFormat === "58x40"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                58mm × 40mm
                <span className="block text-[9px] font-normal opacity-90">Standard Tag</span>
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat("a4")}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  labelFormat === "a4"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                A4 Sheet
                <span className="block text-[9px] font-normal opacity-90">12 / Page</span>
              </button>
            </div>
          </div>

          {/* Scannable Barcode Live Preview Card */}
          <div className="flex flex-col items-center justify-center">
            {labelFormat === "40x60" ? (
              /* 40mm x 60mm Portrait Label Card Preview */
              <div className="bg-white border-2 border-slate-300 rounded-xl p-3.5 shadow-md w-48 flex flex-col items-center justify-between text-center relative aspect-[40/60]">
                <div className="absolute top-1.5 right-2">
                  <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1 rounded uppercase">40×60mm</span>
                </div>
                
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Genesys POS
                </span>

                <h4 className="font-black text-slate-900 text-xs leading-snug line-clamp-2 px-1" title={product.name}>
                  {product.name}
                </h4>

                <div className="text-base font-black text-blue-600">
                  {formatCurrency(product.price)}
                </div>

                <div className="bg-white px-1 py-1 rounded border border-slate-100 w-full flex flex-col items-center">
                  <BarcodeSvg value={barcodeValue} height={36} barWidth={1.3} showText={true} />
                </div>

                <div className="text-[9px] text-slate-500 font-mono flex items-center justify-center gap-1 w-full truncate">
                  <span>{product.sku || "SKU: N/A"}</span>
                  <span>•</span>
                  <span>{product.category || "General"}</span>
                </div>
              </div>
            ) : (
              /* Standard Horizontal Tag Preview */
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2.5 shadow-inner w-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Genesys Retail & Warehouse Tag (58×40mm)
                </span>

                <h4 className="font-extrabold text-slate-900 text-base max-w-xs truncate" title={product.name}>
                  {product.name}
                </h4>

                <div className="text-xl font-black text-blue-600">
                  {formatCurrency(product.price)}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm w-full flex flex-col items-center">
                  <BarcodeSvg value={barcodeValue} height={46} barWidth={1.8} showText={true} />
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
            )}
          </div>

          {/* Controls */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Number of Label Stickers:</span>
                <span className="text-[11px] text-slate-400">
                  {labelFormat === "40x60" ? "Print stickers directly to 40mm x 60mm thermal roll" : "Print as many as you need to stick onto stock"}
                </span>
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
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                title={labelFormat === "40x60" ? "Preview exact 40mm x 60mm PDF label in browser" : "Preview PDF sheet before printing or saving"}
              >
                <Eye size={15} className="text-blue-600" />
                {labelFormat === "40x60" ? "Preview 40×60" : "Preview PDF"}
              </button>

              <button
                onClick={handleDownloadPDF}
                className="py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title={labelFormat === "40x60" ? "Download 40mm x 60mm PDF label document" : "Download printable PDF sheet"}
              >
                <Download size={15} />
                Download PDF
              </button>

              <button
                onClick={handlePrint}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-slate-900/20 transition-all cursor-pointer"
              >
                <Printer size={15} />
                Print {labelFormat === "40x60" ? "40×60mm" : `(${printCount})`}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
