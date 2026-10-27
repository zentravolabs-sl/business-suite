"use client";

import React from "react";
import Link from "next/link";
import { Printer, Download, ArrowLeft, ShieldCheck, FileCheck } from "lucide-react";
import { DOCUMENT_TITLES, type TaxDocumentType } from "@/lib/tax/constants";

export interface PrintClientProps {
  doc: {
    id: string;
    documentType: TaxDocumentType;
    documentNumber: string;
    direction: string;
    status: string;
    issueDateStr: string;
    supplyDateStr: string;
    sellerName: string;
    sellerTin?: string | null;
    sellerVatNumber?: string | null;
    sellerAddress?: string | null;
    sellerPhone?: string | null;
    sellerVatStatus: string;
    buyerName?: string | null;
    buyerTin?: string | null;
    buyerVatNumber?: string | null;
    buyerAddress?: string | null;
    buyerPhone?: string | null;
    currency: string;
    grossTotal: string;
    discountTotal: string;
    netValue: string;
    standardRatedValue: string;
    zeroRatedValue: string;
    exemptValue: string;
    outOfScopeValue: string;
    taxTotal: string;
    grandTotal: string;
    paidAmount: string;
    balanceDue: string;
    parentDocumentNumber?: string | null;
    adjustmentReason?: string | null;
    amountInWords?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
    notices?: string[] | null;
    complianceVersion?: string | null;
    branch?: { name: string; code?: string | null } | null;
    lines: {
      id: string;
      lineNo: number;
      description: string;
      unit?: string | null;
      quantity: number;
      unitPrice: string;
      grossAmount: string;
      discountAmount: string;
      taxableValue: string;
      taxAmount: string;
      lineTotal: string;
      ratePercent: number;
      treatment: string;
    }[];
  };
}

export function PrintTaxDocumentClient({ doc }: PrintClientProps) {
  const isVatRegistered = doc.sellerVatStatus === "REGISTERED";
  const isTaxInvoice = doc.documentType === "TAX_INVOICE" && isVatRegistered;
  const isAdjustment = doc.documentType === "CREDIT_NOTE" || doc.documentType === "DEBIT_NOTE";

  const rawTitle = DOCUMENT_TITLES[doc.documentType] || doc.documentType.replace("_", " ");
  const docTitle = !isVatRegistered && doc.documentType === "TAX_INVOICE" ? "COMMERCIAL INVOICE" : rawTitle;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 print:bg-white print:p-0">
      {/* Top action bar - hidden when printing */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/sales"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sales
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">{docTitle}:</span>
            <span className="font-mono text-sm text-neutral-600">{doc.documentNumber}</span>
            {isTaxInvoice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                IRD Compliant
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/tax/documents/${doc.id}/pdf`}
            download
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Main A4 Document Sheet */}
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-8 shadow-md rounded-xl border border-neutral-200 print:my-0 print:max-w-none print:rounded-none print:border-none print:p-6 print:shadow-none">
        {/* Header Banner */}
        <div className="flex items-start justify-between border-b border-neutral-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 uppercase">
                {docTitle}
              </h1>
              {isTaxInvoice && (
                <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Official VAT Invoice
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {isTaxInvoice
                ? "Issued in accordance with Sri Lanka Inland Revenue Value Added Tax Act No. 14 of 2002"
                : isAdjustment
                ? `Official Adjustment Document (${docTitle})`
                : "Official Commercial Document"}
            </p>
          </div>

          <div className="text-right">
            <div className="font-mono text-base font-bold text-neutral-900 tracking-tight">
              {doc.documentNumber}
            </div>
            <div className="mt-1 text-xs text-neutral-600">
              <span className="text-neutral-400">Issue Date:</span>{" "}
              <span className="font-medium text-neutral-800">{doc.issueDateStr}</span>
            </div>
            <div className="mt-0.5 text-xs">
              <span className="text-neutral-400">Date of Supply:</span>{" "}
              <span className="font-semibold text-indigo-700">{doc.supplyDateStr}</span>
            </div>
            {doc.branch?.name && (
              <div className="mt-0.5 text-[11px] text-neutral-500">
                Branch: {doc.branch.name}
              </div>
            )}
          </div>
        </div>

        {/* Parent Adjustment Banner */}
        {isAdjustment && (doc.parentDocumentNumber || doc.adjustmentReason) && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-900 flex items-center justify-between">
            <div>
              <span className="font-semibold">Original Invoice:</span>{" "}
              <span className="font-mono">{doc.parentDocumentNumber || "N/A"}</span>
            </div>
            {doc.adjustmentReason && (
              <div>
                <span className="font-semibold">Reason:</span> {doc.adjustmentReason}
              </div>
            )}
          </div>
        )}

        {/* Seller & Buyer Grid */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          {/* Supplier (Seller) */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
            <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-500">
              {isVatRegistered ? "Supplier (Registered Person)" : "Supplier Details"}
            </span>
            <div className="mt-1.5 text-sm font-bold text-neutral-900">
              {doc.sellerName}
            </div>
            {doc.sellerTin && (
              <div className="mt-1 text-xs font-semibold text-neutral-800">
                TIN: <span className="font-mono">{doc.sellerTin}</span>
                {doc.sellerVatNumber && (
                  <span className="ml-2 font-mono text-neutral-700">
                    | VAT No: {doc.sellerVatNumber}
                  </span>
                )}
              </div>
            )}
            {doc.sellerAddress && (
              <div className="mt-1 text-xs text-neutral-600 leading-relaxed">
                {doc.sellerAddress}
              </div>
            )}
            {doc.sellerPhone && (
              <div className="mt-0.5 text-xs text-neutral-500">
                Tel: {doc.sellerPhone}
              </div>
            )}
          </div>

          {/* Purchaser (Buyer) */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
            <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-500">
              Purchaser / Recipient
            </span>
            <div className="mt-1.5 text-sm font-bold text-neutral-900">
              {doc.buyerName || "Walk-in Purchaser"}
            </div>
            <div className="mt-1 text-xs text-neutral-800">
              <span className="text-neutral-500">TIN:</span>{" "}
              <span className="font-mono font-medium">{doc.buyerTin || "-"}</span>
              {doc.buyerVatNumber && (
                <span className="ml-2 font-mono text-neutral-700">
                  | VAT: {doc.buyerVatNumber}
                </span>
              )}
            </div>
            {doc.buyerAddress && (
              <div className="mt-1 text-xs text-neutral-600 leading-relaxed">
                {doc.buyerAddress}
              </div>
            )}
            {doc.buyerPhone && (
              <div className="mt-0.5 text-xs text-neutral-500">
                Tel: {doc.buyerPhone}
              </div>
            )}
          </div>
        </div>

        {/* Notices banner if any */}
        {doc.notices && doc.notices.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-800">
            {doc.notices.join(" ")}
          </div>
        )}

        {/* Line Items Table */}
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900 text-white text-[11px] font-semibold">
              <tr>
                <th className="py-2.5 px-3 w-8">#</th>
                <th className="py-2.5 px-3">Item Description</th>
                <th className="py-2.5 px-3 w-16 text-center">UOM</th>
                <th className="py-2.5 px-3 text-right w-16">Qty</th>
                <th className="py-2.5 px-3 text-right w-24">Unit Price</th>
                {isTaxInvoice && (
                  <>
                    <th className="py-2.5 px-3 text-right w-28">Taxable (LKR)</th>
                    <th className="py-2.5 px-3 text-right w-16">VAT %</th>
                    <th className="py-2.5 px-3 text-right w-24">VAT (LKR)</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-right w-28">Total (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {doc.lines.map((l) => (
                <tr key={l.id} className="hover:bg-neutral-50/50">
                  <td className="py-2.5 px-3 text-neutral-400 font-mono text-[11px]">{l.lineNo}</td>
                  <td className="py-2.5 px-3 font-medium text-neutral-900">
                    {l.description}
                  </td>
                  <td className="py-2.5 px-3 text-center text-neutral-500 font-mono">
                    {l.unit || "Pcs"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{l.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{l.unitPrice}</td>
                  {isTaxInvoice && (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono">{l.taxableValue}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                        {l.ratePercent > 0 ? `${l.ratePercent}%` : "0%"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-neutral-700">
                        {l.taxAmount}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                    {l.lineTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Summary Breakdown */}
        <div className="mt-6 flex items-start justify-between">
          {/* Left side: Amount in words & payment details */}
          <div className="max-w-xs space-y-3">
            {doc.amountInWords && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
                <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-400 block">
                  Amount in Words
                </span>
                <span className="mt-1 block text-xs font-semibold text-neutral-800 leading-snug">
                  {doc.amountInWords}
                </span>
              </div>
            )}

            {doc.paymentMethod && (
              <div className="text-xs text-neutral-600">
                <span className="text-neutral-400">Payment Method:</span>{" "}
                <span className="font-medium text-neutral-800">{doc.paymentMethod}</span>
              </div>
            )}

            {doc.notes && (
              <div className="text-xs text-neutral-500 italic">
                Note: {doc.notes}
              </div>
            )}
          </div>

          {/* Right side: Numerical Summary */}
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>{isTaxInvoice ? "Value of Taxable Supplies (Net):" : "Subtotal:"}</span>
              <span className="font-mono font-medium text-neutral-800">Rs. {doc.netValue}</span>
            </div>
            {Number(doc.discountTotal) > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Total Discounts Applied:</span>
                <span className="font-mono text-emerald-600">-Rs. {doc.discountTotal}</span>
              </div>
            )}
            {isTaxInvoice && (
              <div className="flex justify-between text-neutral-600">
                <span>Total Output VAT:</span>
                <span className="font-mono font-semibold text-neutral-900">Rs. {doc.taxTotal}</span>
              </div>
            )}
            {isTaxInvoice && (Number(doc.exemptValue) > 0 || Number(doc.outOfScopeValue) > 0) && (
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>Exempt / Non-Taxable Supplies:</span>
                <span className="font-mono">
                  Rs. {(Number(doc.exemptValue) + Number(doc.outOfScopeValue)).toFixed(2)}
                </span>
              </div>
            )}

            {/* Grand Total Highlight Box */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-900 px-4 py-2.5 text-white">
              <span className="text-xs font-bold uppercase tracking-wider">Grand Total (LKR)</span>
              <span className="font-mono text-base font-bold">Rs. {doc.grandTotal}</span>
            </div>

            {Number(doc.paidAmount) > 0 && (
              <div className="pt-2 flex justify-between text-neutral-500 text-[11px]">
                <span>Paid Amount:</span>
                <span className="font-mono">Rs. {doc.paidAmount}</span>
              </div>
            )}
            {Number(doc.balanceDue) > 0 && (
              <div className="flex justify-between text-red-600 font-semibold text-[11px]">
                <span>Balance Due:</span>
                <span className="font-mono">Rs. {doc.balanceDue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Signatures & Declarations */}
        <div className="mt-12 grid grid-cols-2 gap-12 pt-6 border-t border-neutral-200">
          <div>
            <div className="h-10"></div>
            <div className="border-t border-neutral-300 pt-1 text-center text-xs text-neutral-500">
              Customer / Purchaser Signature
            </div>
          </div>
          <div>
            <div className="h-10"></div>
            <div className="border-t border-neutral-300 pt-1 text-center text-xs text-neutral-500">
              Authorised Signatory / Cashier
            </div>
          </div>
        </div>

        {/* Compliance Footer */}
        <div className="mt-10 border-t border-neutral-200 pt-4 flex items-center justify-between text-[10px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5 text-neutral-500" />
            <span>
              {isTaxInvoice
                ? "Sri Lanka IRD Compliance: Gazette Extraordinary No. 2481/22 & Circular SEC/2026/E/03"
                : "Official Commercial Transaction Document"}
            </span>
          </div>
          <div>Generated by Zentravo Business Suite</div>
        </div>
      </div>
    </div>
  );
}
