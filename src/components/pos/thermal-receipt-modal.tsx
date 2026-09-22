"use client";

import { useRef } from "react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Printer, Check, X, QrCode, Send, AlertTriangle } from "lucide-react";

interface ThermalReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: any;
  onNewSale: () => void;
}

export function ThermalReceiptModal({
  open,
  onOpenChange,
  sale,
  onNewSale,
}: ThermalReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!open || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const bizName = sale.businessName || "ZENTRAVO RETAIL";
    const totalStr = formatCurrency(sale.total);
    const invNo = sale.invoiceNumber;
    const itemsSummary = (sale.items || [])
      .slice(0, 5)
      .map((it: any) => `• ${it.name} (x${it.quantity}) - Rs. ${it.total ? Number(it.total).toLocaleString() : (it.unitPrice * it.quantity).toLocaleString()}`)
      .join("\n");
    const msg =
      `*TAX INVOICE / RECEIPT - ${bizName}*\n\n` +
      `Invoice #: ${invNo}\n` +
      `Date: ${new Date().toLocaleDateString("en-LK")}\n\n` +
      `*Items:*\n${itemsSummary}\n\n` +
      `*Total Amount: ${totalStr}*\n` +
      (sale.loyaltyEarned ? `Loyalty Points Earned: +${sale.loyaltyEarned} pts\n` : "") +
      `\nThank you for your business!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in print:p-0 print:bg-white">
      <div className="fixed inset-0 print:hidden" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in print:border-none print:shadow-none print:p-0 print:max-w-none">
        {/* Print Header Actions (Hidden when printing) */}
        <div className="flex items-center justify-between pb-3 border-b print:hidden">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
            <Check className="h-4 w-4" />
            <span>Sale Completed</span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Offline indicator */}
        {sale.isOffline && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 rounded-xl p-2.5 my-2 text-xs font-semibold flex items-center gap-2 print:hidden">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Offline Transaction: Saved locally & queued for cloud sync.</span>
          </div>
        )}

        {/* 80mm Printable Thermal Receipt Container */}
        <div
          ref={receiptRef}
          className="receipt-container my-4 font-mono text-[11px] text-black bg-white p-4 rounded-lg border print:border-none print:p-0 print:m-0"
        >
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-400">
            <div className="text-base font-extrabold uppercase tracking-wide">
              {sale.businessName || "ZENTRAVO BMS"}
            </div>
            {sale.legalName && sale.legalName !== sale.businessName && (
              <div className="text-[10px] text-gray-600">{sale.legalName}</div>
            )}
            <div className="text-[10px] text-gray-700">
              {sale.address || "Sri Lanka"}
            </div>
            {sale.phone && <div className="text-[10px] text-gray-700">Tel: {sale.phone}</div>}

            {/* VAT Reg No */}
            {sale.vatNumber && (
              <div className="text-[10px] font-bold text-gray-900 mt-1">
                VAT Reg No: {sale.vatNumber}
              </div>
            )}

            <div className="text-[11px] font-extrabold uppercase border-y border-black py-0.5 mt-2">
              *** TAX INVOICE ***
            </div>
          </div>

          {/* Meta */}
          <div className="py-2.5 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Invoice #:</span>
              <span className="font-bold">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{formatDateTime(sale.createdAt || new Date())}</span>
            </div>
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span>{sale.receiptNumber}</span>
            </div>
          </div>

          {/* Line Items */}
          <div className="py-2 border-b border-dashed border-gray-400">
            <div className="grid grid-cols-12 font-bold pb-1 text-[10px] border-b border-gray-300">
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-4 text-right">Total (Rs.)</span>
            </div>

            <div className="divide-y divide-gray-100 pt-1">
              {sale.items?.map((item: any, idx: number) => (
                <div key={idx} className="py-1.5 space-y-0.5">
                  <div className="grid grid-cols-12">
                    <span className="col-span-6 font-semibold leading-tight">{item.name}</span>
                    <span className="col-span-2 text-center">x{item.quantity}</span>
                    <span className="col-span-4 text-right font-bold">
                      {formatCurrency(item.total).replace("Rs.", "").trim()}
                    </span>
                  </div>

                  {/* Serial Number & Warranty badge */}
                  {(item.serialNumber || item.warrantyMonths > 0) && (
                    <div className="text-[9px] text-gray-600 pl-2">
                      {item.serialNumber && <span>S/N: {item.serialNumber} • </span>}
                      {item.warrantyMonths > 0 && (
                        <span className="font-semibold text-gray-800">
                          Warranty: {item.warrantyMonths} Months
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>

            {Number(sale.discountAmount) > 0 && (
              <div className="flex justify-between font-semibold">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discountAmount)}</span>
              </div>
            )}

            {Number(sale.taxAmount) > 0 && (
              <div className="flex justify-between">
                <span>VAT (18%):</span>
                <span>+{formatCurrency(sale.taxAmount)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs font-black pt-1 border-t border-black">
              <span>NET TOTAL:</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {/* Tendered & Change */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>Total Tendered:</span>
              <span className="font-bold">{formatCurrency(sale.paidAmount)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Change Given:</span>
              <span>{formatCurrency(sale.changeAmount || 0)}</span>
            </div>
            {Number(sale.loyaltyEarned) > 0 && (
              <div className="flex justify-between font-bold text-indigo-700 pt-1 border-t border-gray-200 mt-1">
                <span>Loyalty Points Earned:</span>
                <span>+{sale.loyaltyEarned} pts</span>
              </div>
            )}
            {Number(sale.creditAmount) > 0 && (
              <div className="flex justify-between font-bold text-amber-700 pt-1 border-t border-gray-200 mt-1">
                <span>Credit Added to Account:</span>
                <span>{formatCurrency(sale.creditAmount)}</span>
              </div>
            )}
          </div>

          {/* Footer & Return Policy */}
          <div className="text-center pt-3 space-y-1 text-[9px] text-gray-600">
            <div className="font-bold text-gray-800">
              {sale.receiptHeader || "Thank you for shopping with us!"}
            </div>
            <div>
              {sale.receiptFooter || "Goods once sold can only be exchanged within 7 days with original receipt."}
            </div>
            <div className="pt-2 text-[8px] uppercase tracking-widest text-gray-500">
              Powered by Zentravo BMS
            </div>
          </div>
        </div>

        {/* Modal Buttons (Print, WhatsApp & New Sale) */}
        <div className="flex flex-col gap-2 pt-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 rounded-xl border bg-card py-2.5 text-xs font-bold hover:bg-muted transition-colors shadow-sm"
            >
              <Printer className="h-4 w-4 text-primary" />
              Print Receipt
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-bold transition-colors shadow-sm"
            >
              <Send className="h-4 w-4" />
              WhatsApp
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onNewSale();
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Next Customer (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
