import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { recordPurchaseJournalEntry } from "@/lib/accounting";
import { issueInputDocument, type InputDocumentLine } from "@/lib/tax/document-service";
import { allocateProportionally } from "@/lib/tax/adjustments";
import { toErrorResponse } from "@/lib/tax/errors";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const purchaseItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative"),
  serialNumbers: z.array(z.string()).optional().default([]),
});

const purchaseCreateSchema = z.object({
  branchId: z.string().min(1, "Branch is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  purchaseOrderId: z.string().optional().nullable(),
  supplierInvoice: z.string().optional().nullable(),
  supplierInvoiceDate: z.string().optional().nullable(),
  pricesIncludeTax: z.boolean().optional().default(false),
  inputVatEligibility: z.enum(["ELIGIBLE", "INELIGIBLE", "UNDER_REVIEW"]).optional().default("UNDER_REVIEW"),
  receivedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  paidAmount: z.coerce.number().min(0).default(0),
  paymentMethod: z
    .enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "QR_CODE",
      "CREDIT",
      "CHEQUE",
      "ONLINE",
      "LOYALTY_POINTS",
      "SPLIT",
    ])
    .default("BANK_TRANSFER"),
  paymentReference: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const supplierId = searchParams.get("supplierId");
    const branchId = searchParams.get("branchId");

    const where: any = {
      businessId: tenant.businessId,
    };

    if (supplierId && supplierId !== "ALL") {
      where.supplierId = supplierId;
    }

    if (branchId && branchId !== "ALL") {
      where.branchId = branchId;
    }

    if (q) {
      where.OR = [
        { grnNumber: { contains: q, mode: "insensitive" } },
        { supplierInvoice: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        branch: true,
        items: {
          include: { product: true },
        },
        payments: true,
        payables: true,
      },
      orderBy: { receivedDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ purchases });
  } catch (error: any) {
    console.error("Purchases GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = purchaseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify branch and supplier belong to business
    const [branch, supplier] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: data.branchId, businessId: tenant.businessId },
      }),
      prisma.supplier.findFirst({
        where: { id: data.supplierId, businessId: tenant.businessId },
      }),
    ]);

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch selected" }, { status: 400 });
    }
    if (!supplier) {
      return NextResponse.json({ error: "Invalid supplier selected" }, { status: 400 });
    }

    // Calculations
    const subtotal = data.items.reduce(
      (sum, it) => sum + it.quantity * it.unitCost,
      0
    );
    const total = Math.max(0, subtotal - data.discountAmount + data.taxAmount);
    const paidAmount = Math.min(total, data.paidAmount);
    const balance = Math.max(0, total - paidAmount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate concurrency-safe GRN number
      const { allocateDocumentNumber } = await import("@/lib/tax/sequence-service");
      const grnAlloc = await allocateDocumentNumber(tx, {
        businessId: tenant.businessId,
        documentType: "GRN",
        prefix: "GRN",
        issueDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
        resetPeriod: "YEARLY",
        minDigits: 5,
      });
      const grnNumber = grnAlloc.documentNumber;

      // 2. Create Purchase record with items
      const purchase = await tx.purchase.create({
        data: {
          businessId: tenant.businessId,
          branchId: data.branchId,
          supplierId: data.supplierId,
          purchaseOrderId: data.purchaseOrderId || null,
          grnNumber,
          supplierInvoice: data.supplierInvoice || null,
          supplierInvoiceDate: data.supplierInvoiceDate ? new Date(data.supplierInvoiceDate) : null,
          pricesIncludeTax: data.pricesIncludeTax || false,
          inputVatEligibility: data.inputVatEligibility as any,
          status: "RECEIVED",
          subtotal: new Prisma.Decimal(subtotal),
          discountAmount: new Prisma.Decimal(data.discountAmount),
          taxAmount: new Prisma.Decimal(data.taxAmount),
          total: new Prisma.Decimal(total),
          paidAmount: new Prisma.Decimal(paidAmount),
          balance: new Prisma.Decimal(balance),
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
          notes: data.notes || null,
          userId: tenant.userId,
          items: {
            create: data.items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId || null,
              batchNumber: it.batchNumber || null,
              expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
              quantity: it.quantity,
              unitCost: new Prisma.Decimal(it.unitCost),
              total: new Prisma.Decimal(it.quantity * it.unitCost),
              serialNumbers: it.serialNumbers || [],
            })),
          },
        },
        include: { items: true },
      });

      // 3. Process Stock and Movement for each item
      for (const it of data.items) {
        // Find existing stock in branch
        let stock = await tx.stock.findFirst({
          where: {
            branchId: data.branchId,
            productId: it.productId,
            ...(it.variantId ? { variantId: it.variantId } : {}),
          },
        });

        const currentQty = stock?.quantity || 0;
        const newQty = currentQty + it.quantity;

        if (stock) {
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: newQty },
          });
        } else {
          await tx.stock.create({
            data: {
              businessId: tenant.businessId,
              branchId: data.branchId,
              productId: it.productId,
              variantId: it.variantId || null,
              quantity: newQty,
            },
          });
        }

        // Create immutable StockMovement audit
        await tx.stockMovement.create({
          data: {
            businessId: tenant.businessId,
            branchId: data.branchId,
            productId: it.productId,
            variantId: it.variantId || null,
            type: "PURCHASE",
            quantity: it.quantity,
            quantityBefore: currentQty,
            quantityAfter: newQty,
            unitCost: new Prisma.Decimal(it.unitCost),
            referenceType: "Purchase",
            referenceId: purchase.id,
            notes: `GRN received: ${grnNumber}`,
            userId: tenant.userId,
          },
        });

        // Update product replacement cost price
        await tx.product.update({
          where: { id: it.productId },
          data: { costPrice: new Prisma.Decimal(it.unitCost) },
        });

        // 4. Ingest Serial Numbers if provided
        if (it.serialNumbers && it.serialNumbers.length > 0) {
          for (const sn of it.serialNumbers) {
            const cleanSn = sn.trim();
            if (cleanSn) {
              await tx.serialNumber.upsert({
                where: {
                  businessId_serialNumber: {
                    businessId: tenant.businessId,
                    serialNumber: cleanSn,
                  },
                },
                create: {
                  businessId: tenant.businessId,
                  productId: it.productId,
                  serialNumber: cleanSn,
                  status: "IN_STOCK",
                  purchaseId: purchase.id,
                  notes: `Received via ${grnNumber}`,
                },
                update: {
                  status: "IN_STOCK",
                  purchaseId: purchase.id,
                },
              });
            }
          }
        }
      }

      // 5. If linked to a Purchase Order, update received quantities & PO status
      if (data.purchaseOrderId) {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: data.purchaseOrderId, businessId: tenant.businessId },
          include: { items: true },
        });

        if (po) {
          for (const it of data.items) {
            const poItem = po.items.find((p) => p.productId === it.productId);
            if (poItem) {
              await tx.purchaseOrderItem.update({
                where: { id: poItem.id },
                data: { receivedQty: { increment: it.quantity } },
              });
            }
          }

          const freshPo = await tx.purchaseOrder.findUnique({
            where: { id: data.purchaseOrderId },
            include: { items: true },
          });

          if (freshPo) {
            const allFulfilled = freshPo.items.every(
              (p) => p.receivedQty >= p.quantity
            );
            await tx.purchaseOrder.update({
              where: { id: data.purchaseOrderId },
              data: {
                status: allFulfilled ? "RECEIVED" : "PARTIALLY_RECEIVED",
              },
            });
          }
        }
      }

      // 6. Record immediate payment if paidAmount > 0
      if (paidAmount > 0) {
        await tx.purchasePayment.create({
          data: {
            businessId: tenant.businessId,
            purchaseId: purchase.id,
            amount: new Prisma.Decimal(paidAmount),
            method: data.paymentMethod,
            reference: data.paymentReference || null,
            userId: tenant.userId,
          },
        });
      }

      // 7. Manage Supplier Payable & Credit Balance
      const payableStatus =
        balance === 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";

      await tx.supplierPayable.create({
        data: {
          businessId: tenant.businessId,
          supplierId: data.supplierId,
          purchaseId: purchase.id,
          amount: new Prisma.Decimal(total),
          paidAmount: new Prisma.Decimal(paidAmount),
          balance: new Prisma.Decimal(balance),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: payableStatus,
          notes:
            balance > 0
              ? `Outstanding balance for ${grnNumber}`
              : `Paid in full on GRN receipt (${grnNumber})`,
        },
      });

      if (balance > 0) {
        await tx.supplier.update({
          where: { id: data.supplierId },
          data: { creditBalance: { increment: new Prisma.Decimal(balance) } },
        });
      }

      // Record INPUT TaxDocument if tax exists or input VAT is claimable
      if (data.taxAmount > 0 || data.inputVatEligibility === "ELIGIBLE") {
        const itemWeights = data.items.map((it) => it.quantity * it.unitCost);
        const allocatedTaxes = allocateProportionally(itemWeights, data.taxAmount);

        const inputLines: InputDocumentLine[] = data.items.map((it, idx) => {
          const itemTax = allocatedTaxes[idx] || "0";
          const rawTotal = it.quantity * it.unitCost;
          const taxableValue = data.pricesIncludeTax
            ? Math.max(0, rawTotal - Number(itemTax)).toFixed(2)
            : rawTotal.toFixed(2);

          const purchaseItem = purchase.items[idx];
          return {
            description: `Product #${it.productId}`,
            quantity: it.quantity,
            unitPrice: it.unitCost,
            taxableValue,
            taxAmount: itemTax,
            treatment: Number(itemTax) > 0 ? "STANDARD_RATED" : "OUT_OF_SCOPE",
            productId: it.productId,
            purchaseItemId: purchaseItem?.id || null,
          };
        });

        await issueInputDocument(tx, {
          businessId: tenant.businessId,
          branchId: data.branchId,
          documentType: supplier.vatNumber ? "TAX_INVOICE" : "COMMERCIAL_INVOICE",
          documentNumber: grnNumber,
          externalDocumentNo: data.supplierInvoice || null,
          issueDate: data.supplierInvoiceDate ? new Date(data.supplierInvoiceDate) : new Date(),
          supplyDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
          supplier: {
            id: supplier.id,
            name: supplier.name,
            tin: supplier.taxNumber || supplier.vatNumber || null,
            vatNumber: supplier.vatNumber || null,
            address: supplier.address || null,
            phone: supplier.phone || null,
          },
          buyerName: tenant.businessName,
          pricesIncludeTax: data.pricesIncludeTax || false,
          inputVatEligibility: data.inputVatEligibility as any,
          purchaseId: purchase.id,
          lines: inputLines,
          discountTotal: data.discountAmount,
          paidAmount,
          paymentMethod: data.paymentMethod,
          createdById: tenant.userId,
          notes: `Purchase GRN: ${grnNumber}`,
        });
      }

      // Automated Accounting: Record Double-Entry Purchase Journal
      await recordPurchaseJournalEntry({
        tx,
        businessId: tenant.businessId,
        purchaseId: purchase.id,
        grnNumber,
        totalAmount: total,
        taxAmount: data.taxAmount,
        paidAmount,
        paymentMethod: data.paymentMethod,
        inputVatEligible: data.inputVatEligibility === "ELIGIBLE",
      });

      return purchase;
    });

    return NextResponse.json({ success: true, purchase: result }, { status: 201 });
  } catch (error: any) {
    console.error("Purchases POST error:", error);
    return toErrorResponse(error);
  }
}
