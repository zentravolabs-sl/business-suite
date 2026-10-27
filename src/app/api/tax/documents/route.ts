import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTax } from "@/lib/tax/access";
import { parseBusinessDateRange } from "@/lib/tax/dates";
import { calculateTaxForSale } from "@/lib/tax/tax-context";
import { issueTaxDocumentsForSale } from "@/lib/tax/document-service";
import { toErrorResponse } from "@/lib/tax/errors";
import { TAX_PERMISSIONS, type TaxDocumentType, type TaxDocumentStatus } from "@/lib/tax/constants";
import type { DiscountSpec } from "@/lib/tax/engine";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/tax/documents
 *
 * Query parameters:
 *  - direction: "INPUT" | "OUTPUT" (default: all)
 *  - documentType: TAX_INVOICE | SALES_INVOICE | CREDIT_NOTE | ... (default: all)
 *  - status: DRAFT | FINALIZED | VOID (default: all)
 *  - branchId: branch UUID (default: all)
 *  - from: ISO date (supplyDate >=)
 *  - to:   ISO date (supplyDate <= inclusive Colombo end-of-day)
 *  - q: free-text search against documentNumber, buyerName, sellerName
 *  - page: 1-indexed page number (default: 1)
 *  - pageSize: results per page (default: 50, max: 200)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeTax({
      anyOf: [
        TAX_PERMISSIONS.VIEW,
        TAX_PERMISSIONS.VIEW_REPORTS,
        "reports.view",
        "sales.view",
      ],
    });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const { searchParams } = new URL(req.url);
    const direction = searchParams.get("direction") || undefined;
    const documentType = searchParams.get("documentType") || undefined;
    const status = searchParams.get("status") || undefined;
    const branchId = searchParams.get("branchId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q")?.trim() || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || "50")));

    const where: Prisma.TaxDocumentWhereInput = {
      businessId: tenant.businessId,
    };

    if (direction === "INPUT" || direction === "OUTPUT") {
      where.direction = direction;
    }
    if (documentType) {
      where.documentType = documentType as TaxDocumentType;
    }
    if (status) {
      where.status = status as TaxDocumentStatus;
    }
    if (branchId && branchId !== "ALL") {
      where.branchId = branchId;
    }

    if (from || to) {
      const { start, end } = parseBusinessDateRange(from, to);
      where.supplyDate = {};
      if (start) where.supplyDate.gte = start;
      if (end) where.supplyDate.lte = end;
    }

    if (q) {
      where.OR = [
        { documentNumber: { contains: q, mode: "insensitive" } },
        { buyerName: { contains: q, mode: "insensitive" } },
        { sellerName: { contains: q, mode: "insensitive" } },
        { buyerTin: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, documents] = await Promise.all([
      prisma.taxDocument.count({ where }),
      prisma.taxDocument.findMany({
        where,
        orderBy: { issueDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          branch: { select: { name: true, code: true } },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      documents: documents.map((d) => ({
        id: d.id,
        direction: d.direction,
        documentType: d.documentType,
        documentNumber: d.documentNumber,
        status: d.status,
        issueDate: d.issueDate.toISOString().slice(0, 10),
        supplyDate: d.supplyDate.toISOString().slice(0, 10),
        currency: d.currency,
        sellerName: d.sellerName,
        sellerTin: d.sellerTin,
        sellerVatNumber: d.sellerVatNumber,
        buyerName: d.buyerName,
        buyerTin: d.buyerTin,
        buyerVatNumber: d.buyerVatNumber,
        grossTotal: Number(d.grossTotal),
        discountTotal: Number(d.discountTotal),
        netValue: Number(d.netValue),
        standardRatedValue: Number(d.standardRatedValue),
        zeroRatedValue: Number(d.zeroRatedValue),
        exemptValue: Number(d.exemptValue),
        outOfScopeValue: Number(d.outOfScopeValue),
        taxTotal: Number(d.taxTotal),
        grandTotal: Number(d.grandTotal),
        paidAmount: Number(d.paidAmount),
        balanceDue: Number(d.balanceDue),
        paymentMethod: d.paymentMethod,
        classificationCode: d.classificationCode,
        inputVatEligibility: d.inputVatEligibility,
        irdStatus: d.irdStatus,
        complianceVersion: d.complianceVersion,
        branchName: d.branch?.name || null,
        branchCode: d.branch?.code || null,
        saleId: d.saleId,
        purchaseId: d.purchaseId,
        parentDocumentId: d.parentDocumentId,
        finalizedAt: d.finalizedAt ? d.finalizedAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("GET /api/tax/documents error:", error);
    return toErrorResponse(error);
  }
}

interface DocumentItemInput {
  productId?: string;
  description?: string;
  name?: string;
  quantity: number;
  unitPrice: number;
  discount?: number | DiscountSpec | null;
  pricesIncludeTax?: boolean;
  sku?: string;
  unit?: string;
}

/**
 * POST /api/tax/documents
 *
 * Creates non-fiscal estimates (QUOTATION, PROFORMA_INVOICE) with full tax engine
 * calculation, or standalone tax-calculated documents.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeTax({ anyOf: [TAX_PERMISSIONS.ISSUE_DOCUMENTS] });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();
    const {
      documentType = "QUOTATION",
      branchId,
      customerId,
      buyer,
      items,
      notes,
      validUntil,
      invoiceDiscount,
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const { calculation, taxContext } = await calculateTaxForSale({
      businessId: tenant.businessId,
      branchId: branchId || tenant.branchId || undefined,
      customerId,
      invoiceDiscount,
      items: items.map((it: DocumentItemInput) => ({
        productId: it.productId,
        description: it.description || it.name || "Item",
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount:
          typeof it.discount === "number"
            ? { type: "FIXED" as const, value: it.discount }
            : it.discount,
        pricesIncludeTax: it.pricesIncludeTax,
        meta: { sku: it.sku, unit: it.unit },
      })),
    });

    const result = await prisma.$transaction(async (tx) => {
      const docs = await issueTaxDocumentsForSale(tx, taxContext, calculation, {
        businessId: tenant.businessId,
        branchId: branchId || tenant.branchId || null,
        requestedType: documentType as Extract<TaxDocumentType, "QUOTATION" | "PROFORMA_INVOICE">,
        issueDate: new Date(),
        supplyDate: new Date(),
        dueDate: validUntil ? new Date(validUntil) : null,
        paymentMethod: null,
        paidAmount: 0,
        notes: notes || null,
        createdById: tenant.userId,
        buyer: buyer || null,
      });
      return docs[0];
    });

    return NextResponse.json({ success: true, document: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
