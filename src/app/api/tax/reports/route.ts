import { NextRequest, NextResponse } from "next/server";
import { authorizeTax } from "@/lib/tax/access";
import {
  getTaxSummaryReport,
  getOutputVatReport,
  getInputVatReport,
  getTaxableSuppliesReport,
  getZeroRatedSuppliesReport,
  getExemptSuppliesReport,
  getCreditDebitNoteReport,
  getTaxPeriodSummaryReport,
  getTaxInvoiceRegister,
} from "@/lib/tax/tax-reports";
import { toErrorResponse } from "@/lib/tax/errors";
import { TAX_PERMISSIONS } from "@/lib/tax/constants";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeTax({
      anyOf: [
        TAX_PERMISSIONS.VIEW_REPORTS,
        TAX_PERMISSIONS.VIEW,
        "reports.view",
        "reports.financial",
      ],
    });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "summary";
    const branchId = searchParams.get("branchId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") || "json"; // "csv" | "xlsx" | "json"
    const periodType = (searchParams.get("periodType") || "MONTHLY") as "MONTHLY" | "QUARTERLY";

    const filters = {
      businessId: tenant.businessId,
      branchId,
      from,
      to,
    };

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // 1. Output VAT Report
    if (type === "output_vat") {
      const data = await getOutputVatReport(filters);
      if (format === "csv") {
        const headers = ["Invoice Number", "Type", "Issue Date", "Supply Date", "Customer", "TIN", "Branch", "Net Taxable (LKR)", "Output VAT (LKR)", "Grand Total (LKR)"];
        const rows = data.map((r) => [
          escapeCsv(r.documentNumber),
          escapeCsv(r.documentType),
          escapeCsv(r.issueDate),
          escapeCsv(r.supplyDate),
          escapeCsv(r.buyerName),
          escapeCsv(r.buyerTin),
          escapeCsv(r.branchName),
          escapeCsv(r.netValue.toFixed(2)),
          escapeCsv(r.taxTotal.toFixed(2)),
          escapeCsv(r.grandTotal.toFixed(2)),
        ].join(","));
        return new NextResponse([headers.join(","), ...rows].join("\r\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="output_vat_${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        });
      }
      return NextResponse.json({ report: data });
    }

    // 2. Input VAT Report
    if (type === "input_vat") {
      const data = await getInputVatReport(filters);
      if (format === "csv") {
        const headers = ["Doc Number", "Supplier Invoice", "Type", "Issue Date", "Supply Date", "Supplier", "TIN", "Branch", "Net Amount (LKR)", "Input VAT (LKR)", "Total (LKR)", "Eligibility", "Review Notes"];
        const rows = data.map((r) => [
          escapeCsv(r.documentNumber),
          escapeCsv(r.externalDocumentNo),
          escapeCsv(r.documentType),
          escapeCsv(r.issueDate),
          escapeCsv(r.supplyDate),
          escapeCsv(r.supplierName),
          escapeCsv(r.supplierTin),
          escapeCsv(r.branchName),
          escapeCsv(r.netValue.toFixed(2)),
          escapeCsv(r.taxTotal.toFixed(2)),
          escapeCsv(r.grandTotal.toFixed(2)),
          escapeCsv(r.inputVatEligibility),
          escapeCsv(r.inputVatReviewNote),
        ].join(","));
        return new NextResponse([headers.join(","), ...rows].join("\r\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="input_vat_${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        });
      }
      return NextResponse.json({ report: data });
    }

    // 3. Taxable Supplies Summary
    if (type === "taxable_supplies") {
      const data = await getTaxableSuppliesReport(filters);
      return NextResponse.json({ report: data });
    }

    // 4. Zero-Rated Supplies Report
    if (type === "zero_rated") {
      const data = await getZeroRatedSuppliesReport(filters);
      return NextResponse.json({ report: data });
    }

    // 5. Exempt Supplies Report
    if (type === "exempt") {
      const data = await getExemptSuppliesReport(filters);
      return NextResponse.json({ report: data });
    }

    // 6. Credit & Debit Note Report
    if (type === "credit_debit") {
      const data = await getCreditDebitNoteReport(filters);
      if (format === "csv") {
        const headers = ["Adjustment No", "Type", "Issue Date", "Original Invoice", "Party", "Taxable Value (LKR)", "VAT Amount (LKR)", "Total (LKR)", "Reason"];
        const rows = data.map((r) => [
          escapeCsv(r.documentNumber),
          escapeCsv(r.documentType),
          escapeCsv(r.issueDate),
          escapeCsv(r.parentDocumentNumber),
          escapeCsv(r.partyName),
          escapeCsv(r.taxableAmount.toFixed(2)),
          escapeCsv(r.taxAmount.toFixed(2)),
          escapeCsv(r.totalAmount.toFixed(2)),
          escapeCsv(r.reason),
        ].join(","));
        return new NextResponse([headers.join(","), ...rows].join("\r\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="credit_debit_notes_${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        });
      }
      return NextResponse.json({ report: data });
    }

    // 7. Tax Period Summary
    if (type === "period_summary") {
      const data = await getTaxPeriodSummaryReport(filters, periodType);
      return NextResponse.json({ report: data });
    }

    // 8. Tax Invoice Register
    if (type === "register") {
      const register = await getTaxInvoiceRegister(filters);

      if (format === "xlsx") {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Zentravo Business Suite";
        const sheet = workbook.addWorksheet("Tax Invoice Register");

        sheet.columns = [
          { header: "Document Number", key: "docNum", width: 22 },
          { header: "Direction", key: "direction", width: 12 },
          { header: "Document Type", key: "type", width: 18 },
          { header: "Issue Date", key: "issueDate", width: 14 },
          { header: "Supply Date", key: "supplyDate", width: 14 },
          { header: "Party Name", key: "party", width: 28 },
          { header: "TIN", key: "tin", width: 15 },
          { header: "VAT Number", key: "vat", width: 18 },
          { header: "Branch", key: "branch", width: 16 },
          { header: "Gross Total (LKR)", key: "gross", width: 16 },
          { header: "Net Taxable (LKR)", key: "net", width: 16 },
          { header: "Tax Total (LKR)", key: "tax", width: 16 },
          { header: "Grand Total (LKR)", key: "grand", width: 16 },
          { header: "Status", key: "status", width: 14 },
        ];

        for (const r of register) {
          sheet.addRow({
            docNum: r.documentNumber,
            direction: r.direction,
            type: r.documentType,
            issueDate: r.issueDate,
            supplyDate: r.supplyDate,
            party: r.customerSupplierName,
            tin: r.tin || "-",
            vat: r.vatNumber || "-",
            branch: r.branchName,
            gross: r.grossTotal,
            net: r.netValue,
            tax: r.taxTotal,
            grand: r.grandTotal,
            status: r.status,
          });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return new NextResponse(Buffer.from(buffer), {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="tax_invoice_register_${new Date().toISOString().slice(0, 10)}.xlsx"`,
          },
        });
      }

      if (format === "csv") {
        const headers = [
          "Document Number",
          "Direction",
          "Document Type",
          "Issue Date",
          "Supply Date",
          "Party Name",
          "TIN",
          "VAT Number",
          "Branch",
          "Gross Total (LKR)",
          "Net Taxable (LKR)",
          "Standard Rated (LKR)",
          "Zero Rated (LKR)",
          "Exempt (LKR)",
          "Out of Scope (LKR)",
          "Tax Total (LKR)",
          "Grand Total (LKR)",
          "Input VAT Eligibility",
          "Status",
        ];

        const rows = register.map((r) => [
          escapeCsv(r.documentNumber),
          escapeCsv(r.direction),
          escapeCsv(r.documentType),
          escapeCsv(r.issueDate),
          escapeCsv(r.supplyDate),
          escapeCsv(r.customerSupplierName),
          escapeCsv(r.tin),
          escapeCsv(r.vatNumber),
          escapeCsv(r.branchName),
          escapeCsv(r.grossTotal.toFixed(2)),
          escapeCsv(r.netValue.toFixed(2)),
          escapeCsv(r.standardRatedValue.toFixed(2)),
          escapeCsv(r.zeroRatedValue.toFixed(2)),
          escapeCsv(r.exemptValue.toFixed(2)),
          escapeCsv(r.outOfScopeValue.toFixed(2)),
          escapeCsv(r.taxTotal.toFixed(2)),
          escapeCsv(r.grandTotal.toFixed(2)),
          escapeCsv(r.inputVatEligibility || "N/A"),
          escapeCsv(r.status),
        ].join(","));

        return new NextResponse([headers.join(","), ...rows].join("\r\n"), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="tax_invoice_register_${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        });
      }

      return NextResponse.json({ register });
    }

    // Default: summary report
    const summary = await getTaxSummaryReport(filters);

    if (format === "csv") {
      const lines = [
        `"SRI LANKA TAX & INVOICING SUMMARY REPORT"`,
        `"Period",${summary.period.startDate || "Beginning"} to ${summary.period.endDate || "Current"}`,
        `""`,
        `"SECTION","METRIC","AMOUNT (LKR)"`,
        `"Output VAT","Total Invoices Issued",${summary.outputVat.invoiceCount}`,
        `"Output VAT","Gross Sales Total",${summary.outputVat.totalGross}`,
        `"Output VAT","Discounts Total",${summary.outputVat.totalDiscount}`,
        `"Output VAT","Total Taxable Supplies (Net)",${summary.outputVat.totalNetTaxable}`,
        `"Output VAT","Standard Rated Supplies",${summary.outputVat.standardRatedTaxable}`,
        `"Output VAT","Zero Rated Supplies",${summary.outputVat.zeroRatedTaxable}`,
        `"Output VAT","Exempt Supplies",${summary.outputVat.exemptTaxable}`,
        `"Output VAT","Out of Scope Supplies",${summary.outputVat.outOfScopeTaxable}`,
        `"Output VAT","Total Output VAT Charged",${summary.outputVat.outputVatTotal}`,
        `""`,
        `"Input VAT","Total Purchases & Expenses Count",${summary.inputVat.purchaseCount}`,
        `"Input VAT","Gross Purchases & Expenses",${summary.inputVat.totalPurchasesGross}`,
        `"Input VAT","Eligible Input VAT (Claimable)",${summary.inputVat.eligibleInputVat}`,
        `"Input VAT","Ineligible Input VAT",${summary.inputVat.ineligibleInputVat}`,
        `"Input VAT","Under Review Input VAT",${summary.inputVat.underReviewInputVat}`,
        `"Input VAT","Total Input VAT Paid",${summary.inputVat.totalInputVat}`,
        `""`,
        `"Adjustments","Credit Notes Issued Count",${summary.adjustments.creditNoteCount}`,
        `"Adjustments","Credit Notes Total Value",${summary.adjustments.creditNoteTotal}`,
        `"Adjustments","Output VAT Reversed via Credit Notes",${summary.adjustments.creditNoteVatReversed}`,
        `""`,
        `"Net Tax Position","Net Output VAT Liability",${summary.netTaxPayable.netOutputVat}`,
        `"Net Tax Position","Eligible Input VAT Deduction",${summary.netTaxPayable.eligibleInputVatDeduction}`,
        `"Net Tax Position","Net VAT Payable to Inland Revenue Department",${summary.netTaxPayable.payableToIrd}`,
      ];

      return new NextResponse(lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tax_summary_report_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    return toErrorResponse(error);
  }
}
