import { PDFDocument, StandardFonts, rgb, PDFPage } from "pdf-lib";
import { DOCUMENT_TITLES, type TaxDocumentType } from "./constants";

export interface InvoicePdfData {
  documentType: TaxDocumentType;
  documentNumber: string;
  issueDate: string; // YYYY-MM-DD or DD/MM/YYYY
  supplyDate: string;
  dueDate?: string | null;
  currency: string;

  seller: {
    name: string;
    tin?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    phone?: string | null;
    vatStatus: string;
  };

  buyer: {
    name?: string | null;
    tin?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    phone?: string | null;
  };

  lines: {
    lineNo: number;
    description: string;
    unit?: string | null;
    quantity: number | string;
    unitPrice: number | string;
    taxableValue: number | string;
    ratePercent: number | string;
    taxAmount: number | string;
    lineTotal: number | string;
    treatment: string;
  }[];

  totals: {
    grossTotal: string;
    discountTotal: string;
    netValue: string;
    standardRatedValue: string;
    zeroRatedValue: string;
    exemptValue: string;
    outOfScopeValue: string;
    taxTotal: string;
    grandTotal: string;
    paidAmount?: string;
    balanceDue?: string;
  };

  parentDocumentNumber?: string | null;
  adjustmentReason?: string | null;
  amountInWords?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  notices?: string[] | null;
  complianceVersion?: string | null;
}

/** Sanitizes strings for standard PDF WinAnsiEncoding */
function sanitizeText(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x00-\x7F]/g, " ")
    .trim();
}

function formatDateDisplay(isoOrDisplay: string): string {
  if (!isoOrDisplay) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDisplay)) {
    const [y, m, d] = isoOrDisplay.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return isoOrDisplay;
}

export async function generateTaxInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const isVatRegistered = data.seller.vatStatus === "REGISTERED";
  const isTaxInvoice = data.documentType === "TAX_INVOICE" && isVatRegistered;
  const isAdjustment = data.documentType === "CREDIT_NOTE" || data.documentType === "DEBIT_NOTE";

  const rawTitle = DOCUMENT_TITLES[data.documentType] || data.documentType.replace("_", " ");
  const title = !isVatRegistered && data.documentType === "TAX_INVOICE" ? "COMMERCIAL INVOICE" : rawTitle;

  const margin = 36;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header drawing function
  const drawPageHeader = (page: PDFPage, pageNum: number, totalPages: number) => {
    // Title
    page.drawText(sanitizeText(title), {
      x: margin,
      y: pageHeight - margin - 18,
      size: 18,
      font: fontBold,
      color: rgb(0.08, 0.12, 0.25),
    });

    if (totalPages > 1) {
      const pageText = `Page ${pageNum} of ${totalPages}`;
      page.drawText(pageText, {
        x: pageWidth - margin - fontRegular.widthOfTextAtSize(pageText, 8),
        y: 18,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const subtitle = isTaxInvoice
      ? "TAX INVOICE — Issued under Sri Lanka Inland Revenue Value Added Tax Act No. 14 of 2002"
      : isAdjustment
      ? `${title} — Adjustment Document`
      : "Commercial Sales Document";

    page.drawText(sanitizeText(subtitle), {
      x: margin,
      y: pageHeight - margin - 32,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.55),
    });

    // Right header: Doc number & dates
    const docNumText = `No: ${sanitizeText(data.documentNumber)}`;
    const docNumWidth = fontBold.widthOfTextAtSize(docNumText, 11);
    page.drawText(docNumText, {
      x: pageWidth - margin - docNumWidth,
      y: pageHeight - margin - 14,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const issueText = `Issue Date: ${formatDateDisplay(data.issueDate)}`;
    page.drawText(issueText, {
      x: pageWidth - margin - fontRegular.widthOfTextAtSize(issueText, 8.5),
      y: pageHeight - margin - 26,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.25),
    });

    const supplyText = `Date of Supply: ${formatDateDisplay(data.supplyDate)}`;
    page.drawText(supplyText, {
      x: pageWidth - margin - fontBold.widthOfTextAtSize(supplyText, 8.5),
      y: pageHeight - margin - 38,
      size: 8.5,
      font: fontBold,
      color: rgb(0.1, 0.3, 0.6),
    });

    page.drawLine({
      start: { x: margin, y: pageHeight - margin - 46 },
      end: { x: pageWidth - margin, y: pageHeight - margin - 46 },
      thickness: 0.75,
      color: rgb(0.85, 0.88, 0.92),
    });
  };

  // 1. Draw First Page Header
  drawPageHeader(currentPage, 1, 1);
  y -= 54;

  // 2. Supplier & Purchaser Boxes (Only on First Page)
  const colWidth = (contentWidth - 16) / 2;
  const boxHeight = 72;

  // Supplier Box (Left)
  currentPage.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: colWidth,
    height: boxHeight,
    color: rgb(0.97, 0.98, 1),
    borderColor: rgb(0.86, 0.89, 0.95),
    borderWidth: 0.5,
  });

  currentPage.drawText(isVatRegistered ? "SUPPLIER (REGISTERED PERSON)" : "SUPPLIER DETAILS", {
    x: margin + 8,
    y: y - 12,
    size: 7.5,
    font: fontBold,
    color: rgb(0.2, 0.35, 0.6),
  });
  currentPage.drawText(sanitizeText(data.seller.name || "Business Name").slice(0, 36), {
    x: margin + 8,
    y: y - 24,
    size: 9.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  if (data.seller.tin) {
    currentPage.drawText(`TIN: ${sanitizeText(data.seller.tin)}  ${data.seller.vatNumber ? `| VAT: ${sanitizeText(data.seller.vatNumber)}` : ""}`, {
      x: margin + 8,
      y: y - 36,
      size: 8,
      font: fontBold,
      color: rgb(0.15, 0.25, 0.45),
    });
  }
  currentPage.drawText(sanitizeText(data.seller.address || "").slice(0, 48), {
    x: margin + 8,
    y: y - 48,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.35),
  });
  currentPage.drawText(data.seller.phone ? `Tel: ${sanitizeText(data.seller.phone)}` : "", {
    x: margin + 8,
    y: y - 60,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Purchaser Box (Right)
  const buyerX = margin + colWidth + 16;
  currentPage.drawRectangle({
    x: buyerX,
    y: y - boxHeight,
    width: colWidth,
    height: boxHeight,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.86, 0.89, 0.95),
    borderWidth: 0.5,
  });

  currentPage.drawText("PURCHASER DETAILS", {
    x: buyerX + 8,
    y: y - 12,
    size: 7.5,
    font: fontBold,
    color: rgb(0.2, 0.35, 0.6),
  });
  currentPage.drawText(sanitizeText(data.buyer.name || "Walk-in Purchaser").slice(0, 36), {
    x: buyerX + 8,
    y: y - 24,
    size: 9.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  const buyerTinText = data.buyer.tin ? `TIN: ${sanitizeText(data.buyer.tin)}` : "TIN: -";
  const buyerVatText = data.buyer.vatNumber ? ` | VAT: ${sanitizeText(data.buyer.vatNumber)}` : "";
  currentPage.drawText(`${buyerTinText}${buyerVatText}`, {
    x: buyerX + 8,
    y: y - 36,
    size: 8,
    font: fontRegular,
    color: rgb(0.25, 0.25, 0.25),
  });
  currentPage.drawText(sanitizeText(data.buyer.address || "").slice(0, 48), {
    x: buyerX + 8,
    y: y - 48,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.35),
  });
  currentPage.drawText(data.buyer.phone ? `Tel: ${sanitizeText(data.buyer.phone)}` : "", {
    x: buyerX + 8,
    y: y - 60,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= boxHeight + 10;

  // Parent document note for adjustments
  if (isAdjustment && (data.parentDocumentNumber || data.adjustmentReason)) {
    const parentMsg = `Against Invoice: ${sanitizeText(data.parentDocumentNumber || "N/A")} | Reason: ${sanitizeText(data.adjustmentReason || "N/A")}`;
    currentPage.drawText(parentMsg, {
      x: margin,
      y: y - 4,
      size: 8,
      font: fontBold,
      color: rgb(0.65, 0.2, 0.1),
    });
    y -= 14;
  }

  // 3. Line Items Table Setup
  // Columns for Tax Invoice: #, Description, UOM, Qty, Unit Price, Taxable Value, VAT Amount, Total
  // Columns for Non-VAT:    #, Description, UOM, Qty, Unit Price, Total
  const colX = isTaxInvoice
    ? {
        no: margin + 4,
        desc: margin + 24,
        uom: margin + 190,
        qty: margin + 230,
        price: margin + 270,
        taxable: margin + 340,
        vat: margin + 420,
        total: margin + 475,
      }
    : {
        no: margin + 4,
        desc: margin + 24,
        uom: margin + 240,
        qty: margin + 290,
        price: margin + 350,
        taxable: margin + 350,
        vat: margin + 440,
        total: margin + 460,
      };

  const drawTableHeader = (page: PDFPage, curY: number) => {
    page.drawRectangle({
      x: margin,
      y: curY - 16,
      width: contentWidth,
      height: 16,
      color: rgb(0.12, 0.16, 0.28),
    });

    const hY = curY - 11;
    const hColor = rgb(1, 1, 1);
    page.drawText("#", { x: colX.no, y: hY, size: 7.5, font: fontBold, color: hColor });
    page.drawText("Item Description", { x: colX.desc, y: hY, size: 7.5, font: fontBold, color: hColor });
    page.drawText("UOM", { x: colX.uom, y: hY, size: 7.5, font: fontBold, color: hColor });
    page.drawText("Qty", { x: colX.qty, y: hY, size: 7.5, font: fontBold, color: hColor });
    page.drawText("Unit Price", { x: colX.price, y: hY, size: 7.5, font: fontBold, color: hColor });
    if (isTaxInvoice) {
      page.drawText("Taxable (LKR)", { x: colX.taxable, y: hY, size: 7.5, font: fontBold, color: hColor });
      page.drawText("VAT (LKR)", { x: colX.vat, y: hY, size: 7.5, font: fontBold, color: hColor });
    }
    page.drawText("Total (LKR)", { x: colX.total, y: hY, size: 7.5, font: fontBold, color: hColor });
    return curY - 16;
  };

  y = drawTableHeader(currentPage, y);

  // 4. Draw Rows with Automatic Pagination
  const rowHeight = 16;
  const bottomMarginWithTotals = 160;
  const bottomMarginNoTotals = 50;

  for (let i = 0; i < data.lines.length; i++) {
    const isLastItem = i === data.lines.length - 1;
    const minSpaceNeeded = isLastItem ? bottomMarginWithTotals : bottomMarginNoTotals;

    if (y - rowHeight < minSpaceNeeded) {
      // Create new page
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawPageHeader(currentPage, pdfDoc.getPageCount(), pdfDoc.getPageCount());
      y -= 54;
      y = drawTableHeader(currentPage, y);
    }

    const l = data.lines[i];
    const isEven = i % 2 === 0;

    if (isEven) {
      currentPage.drawRectangle({
        x: margin,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: rgb(0.98, 0.99, 1),
      });
    }

    const lineY = y - 11;
    const txtColor = rgb(0.15, 0.15, 0.15);

    currentPage.drawText(String(l.lineNo), { x: colX.no, y: lineY, size: 7.5, font: fontRegular, color: txtColor });
    const descText = sanitizeText(l.description);
    const maxChars = isTaxInvoice ? 30 : 40;
    const desc = descText.length > maxChars ? descText.slice(0, maxChars - 2) + ".." : descText;
    currentPage.drawText(desc, { x: colX.desc, y: lineY, size: 7.5, font: fontRegular, color: txtColor });
    currentPage.drawText(sanitizeText(l.unit || "Pcs"), { x: colX.uom, y: lineY, size: 7.5, font: fontRegular, color: txtColor });
    currentPage.drawText(String(l.quantity), { x: colX.qty, y: lineY, size: 7.5, font: fontRegular, color: txtColor });
    currentPage.drawText(Number(l.unitPrice).toFixed(2), { x: colX.price, y: lineY, size: 7.5, font: fontRegular, color: txtColor });

    if (isTaxInvoice) {
      currentPage.drawText(Number(l.taxableValue).toFixed(2), { x: colX.taxable, y: lineY, size: 7.5, font: fontRegular, color: txtColor });
      currentPage.drawText(Number(l.taxAmount).toFixed(2), { x: colX.vat, y: lineY, size: 7.5, font: fontRegular, color: txtColor });
    }

    currentPage.drawText(Number(l.lineTotal).toFixed(2), { x: colX.total, y: lineY, size: 7.5, font: fontBold, color: txtColor });

    y -= rowHeight;
  }

  // 5. Totals & Reconciliation Box
  y -= 8;
  const totalsBoxWidth = 220;
  const totalsX = pageWidth - margin - totalsBoxWidth;

  currentPage.drawRectangle({
    x: totalsX,
    y: y - 76,
    width: totalsBoxWidth,
    height: 76,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 0.5,
  });

  const drawTotalLine = (label: string, value: string, curY: number, bold = false) => {
    currentPage.drawText(label, {
      x: totalsX + 10,
      y: curY,
      size: bold ? 9 : 8,
      font: bold ? fontBold : fontRegular,
      color: bold ? rgb(0.08, 0.12, 0.25) : rgb(0.3, 0.3, 0.3),
    });
    const valText = `${data.currency} ${value}`;
    const valWidth = (bold ? fontBold : fontRegular).widthOfTextAtSize(valText, bold ? 9 : 8);
    currentPage.drawText(valText, {
      x: totalsX + totalsBoxWidth - 10 - valWidth,
      y: curY,
      size: bold ? 9 : 8,
      font: bold ? fontBold : fontRegular,
      color: bold ? rgb(0.08, 0.12, 0.25) : rgb(0.2, 0.2, 0.2),
    });
  };

  drawTotalLine("Net Taxable Value:", data.totals.netValue, y - 16);
  if (isTaxInvoice) {
    drawTotalLine("Output VAT Total:", data.totals.taxTotal, y - 30);
  } else {
    drawTotalLine("Discounts Total:", data.totals.discountTotal, y - 30);
  }
  if (data.totals.discountTotal && Number(data.totals.discountTotal) > 0 && isTaxInvoice) {
    drawTotalLine("Discounts Applied:", data.totals.discountTotal, y - 44);
  }

  currentPage.drawLine({
    start: { x: totalsX + 8, y: y - 52 },
    end: { x: totalsX + totalsBoxWidth - 8, y: y - 52 },
    thickness: 0.75,
    color: rgb(0.8, 0.84, 0.9),
  });

  drawTotalLine("Total Payable:", data.totals.grandTotal, y - 66, true);

  // Notes and Amount in Words (Left Side of Totals)
  if (data.amountInWords) {
    currentPage.drawText("Amount in Words:", {
      x: margin,
      y: y - 14,
      size: 7.5,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.45),
    });
    currentPage.drawText(sanitizeText(data.amountInWords).slice(0, 60), {
      x: margin,
      y: y - 26,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  if (data.paymentMethod) {
    currentPage.drawText(`Payment Method: ${sanitizeText(data.paymentMethod)}`, {
      x: margin,
      y: y - 40,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.25),
    });
  }

  if (data.notes) {
    currentPage.drawText(`Notes: ${sanitizeText(data.notes).slice(0, 70)}`, {
      x: margin,
      y: y - 52,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Footer on all pages
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let idx = 0; idx < totalPages; idx++) {
    const p = pages[idx];
    const footerY = margin / 2;
    p.drawLine({
      start: { x: margin, y: footerY + 12 },
      end: { x: pageWidth - margin, y: footerY + 12 },
      thickness: 0.5,
      color: rgb(0.88, 0.9, 0.94),
    });

    const complianceNotice = isTaxInvoice
      ? "Sri Lanka IRD Compliant Tax Invoice • System Generated by Zentravo Suite"
      : "Commercial Document • System Generated by Zentravo Suite";

    p.drawText(complianceNotice, {
      x: margin,
      y: footerY + 3,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });

    const pageNumText = `Page ${idx + 1} of ${totalPages}`;
    const pageNumWidth = fontRegular.widthOfTextAtSize(pageNumText, 6.5);
    p.drawText(pageNumText, {
      x: pageWidth - margin - pageNumWidth,
      y: footerY + 3,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  return pdfDoc.save();
}
