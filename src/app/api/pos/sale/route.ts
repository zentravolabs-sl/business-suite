import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { recordSaleJournalEntry } from "@/lib/accounting";

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      items,
      payments,
      customerId,
      subtotal,
      discountAmount = 0,
      taxAmount = 0,
      total,
      paidAmount,
      changeAmount = 0,
      notes,
      branchId: reqBranchId,
      offlineId,
    } = body;

    const branchId = reqBranchId || tenant.branchId;
    if (!branchId) {
      return NextResponse.json({ error: "Branch is required for sale" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart cannot be empty" }, { status: 400 });
    }

    // Idempotency: If offline sale was already synced, return existing sale
    if (offlineId) {
      const existingSale = await prisma.sale.findFirst({
        where: { businessId: tenant.businessId, offlineId },
        include: { items: true, payments: true },
      });
      if (existingSale) {
        return NextResponse.json({
          success: true,
          sale: existingSale,
          alreadyProcessed: true,
        });
      }
    }

    // 1. Verify active shift
    const activeShift = await prisma.cashierShift.findFirst({
      where: {
        businessId: tenant.businessId,
        branchId,
        userId: tenant.userId,
        status: "OPEN",
      },
    });

    if (!activeShift) {
      return NextResponse.json(
        { error: "You must open a cashier shift before completing sales." },
        { status: 400 }
      );
    }

    // 2. Fetch business for prefix numbers & tax info
    const business = await prisma.business.findUnique({
      where: { id: tenant.businessId },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Calculate credit amount if any
    const creditPayments = (payments || []).filter((p: any) => p.method === "CREDIT");
    const creditAmount = creditPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // Run transaction
    const saleResult = await prisma.$transaction(async (tx) => {
      const invNum = business.nextInvoiceNumber || 1001;
      const rcpNum = business.nextReceiptNumber || 1001;
      const invoiceNumber = `${business.invoicePrefix || "INV"}-${String(invNum).padStart(6, "0")}`;
      const receiptNumber = `${business.receiptPrefix || "RCP"}-${String(rcpNum).padStart(6, "0")}`;

      // Update business sequential counters
      await tx.business.update({
        where: { id: business.id },
        data: {
          nextInvoiceNumber: invNum + 1,
          nextReceiptNumber: rcpNum + 1,
        },
      });

      // Create Sale Header
      const sale = await tx.sale.create({
        data: {
          businessId: tenant.businessId,
          branchId,
          shiftId: activeShift.id,
          customerId: customerId || null,
          userId: tenant.userId,
          invoiceNumber,
          receiptNumber,
          status: "COMPLETED",
          type: "POS",
          subtotal,
          discountAmount,
          taxAmount,
          total,
          paidAmount,
          changeAmount,
          creditAmount,
          notes: notes || null,
          isSynced: true,
          offlineId: offlineId || null,
        },
      });

      // Create Sale Items & Update Stocks
      const createdItems = [];
      for (const item of items) {
        const itemTotal = Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount || 0);

        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            name: item.name,
            sku: item.sku || null,
            barcode: item.barcode || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice || 0,
            discountAmount: item.discountAmount || 0,
            taxAmount: item.taxAmount || 0,
            total: itemTotal,
            warrantyMonths: item.warrantyMonths || 0,
            serialNumber: item.serialNumber || null,
          },
        });
        createdItems.push(saleItem);

        // Find or create stock
        let stock = await tx.stock.findFirst({
          where: { branchId, productId: item.productId },
        });

        const currentQty = stock?.quantity || 0;
        const newQty = Math.max(0, currentQty - item.quantity);

        if (stock) {
          await tx.stock.update({
            where: { id: stock.id },
            data: { quantity: newQty },
          });
        } else {
          stock = await tx.stock.create({
            data: {
              businessId: tenant.businessId,
              branchId,
              productId: item.productId,
              quantity: newQty,
            },
          });
        }

        // Record Stock Movement
        await tx.stockMovement.create({
          data: {
            businessId: tenant.businessId,
            branchId,
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            quantityBefore: currentQty,
            quantityAfter: newQty,
            unitCost: item.costPrice || 0,
            referenceType: "Sale",
            referenceId: sale.id,
            notes: `POS Sale #${invoiceNumber}`,
            userId: tenant.userId,
          },
        });

        // If serial number assigned, mark as SOLD
        if (item.serialNumber) {
          await tx.serialNumber.upsert({
            where: {
              businessId_serialNumber: {
                businessId: tenant.businessId,
                serialNumber: item.serialNumber,
              },
            },
            update: {
              status: "SOLD",
              saleId: sale.id,
              customerId: customerId || null,
            },
            create: {
              businessId: tenant.businessId,
              productId: item.productId,
              serialNumber: item.serialNumber,
              status: "SOLD",
              saleId: sale.id,
              customerId: customerId || null,
            },
          });
        }

        // If product has warranty, create Warranty record
        if (item.warrantyMonths && item.warrantyMonths > 0) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + Number(item.warrantyMonths));

          const warrantyCode = `WC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

          await tx.warranty.create({
            data: {
              businessId: tenant.businessId,
              warrantyCode,
              customerId: customerId || null,
              productId: item.productId,
              saleId: sale.id,
              serialNumber: item.serialNumber || null,
              purchaseDate: startDate,
              warrantyMonths: item.warrantyMonths,
              startDate,
              endDate,
              type: "SELLER",
              status: "ACTIVE",
            },
          });
        }
      }

      // Create Payment records
      for (const p of payments) {
        await tx.payment.create({
          data: {
            businessId: tenant.businessId,
            saleId: sale.id,
            method: p.method,
            amount: p.amount,
            reference: p.reference || null,
            status: "PAID",
          },
        });
      }

      // Update customer credit balance and log CreditTransaction if applicable
      if (customerId && creditAmount > 0) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });
        if (customer) {
          const newCreditBal = Number(customer.creditBalance) + creditAmount;
          await tx.customer.update({
            where: { id: customer.id },
            data: { creditBalance: newCreditBal },
          });

          await tx.creditTransaction.create({
            data: {
              businessId: tenant.businessId,
              customerId: customer.id,
              saleId: sale.id,
              type: "CREDIT_SALE",
              amount: creditAmount,
              balance: newCreditBal,
              notes: `Credit sale #${invoiceNumber}`,
            },
          });
        }
      }

      // Award Loyalty Points if registered customer
      let loyaltyEarned = 0;
      if (customerId) {
        // Rs. 100 spent = 1 loyalty point
        loyaltyEarned = Math.floor(Number(total) / 100);
        if (loyaltyEarned > 0) {
          let loyalty = await tx.loyaltyAccount.findUnique({
            where: { customerId },
          });
          if (!loyalty) {
            loyalty = await tx.loyaltyAccount.create({
              data: {
                businessId: tenant.businessId,
                customerId,
                points: loyaltyEarned,
                lifetimePoints: loyaltyEarned,
              },
            });
          } else {
            loyalty = await tx.loyaltyAccount.update({
              where: { id: loyalty.id },
              data: {
                points: { increment: loyaltyEarned },
                lifetimePoints: { increment: loyaltyEarned },
              },
            });
          }

          await tx.loyaltyTransaction.create({
            data: {
              accountId: loyalty.id,
              type: "EARN",
              points: loyaltyEarned,
              balance: loyalty.points,
              saleId: sale.id,
              notes: `Points from POS Sale #${invoiceNumber}`,
            },
          });
        }
      }

      // Update shift total sales
      await tx.cashierShift.update({
        where: { id: activeShift.id },
        data: {
          totalSales: {
            increment: total,
          },
        },
      });

      // Automated Accounting: Record Double-Entry Journal Entry
      const totalCost = items.reduce(
        (sum, it) => sum + Number(it.quantity) * Number(it.costPrice || 0),
        0
      );
      try {
        await recordSaleJournalEntry({
          tx,
          businessId: tenant.businessId,
          saleId: sale.id,
          invoiceNumber,
          totalAmount: total,
          costAmount: totalCost,
          paymentMethod: payments[0]?.method || "CASH",
          taxAmount: Number(taxAmount || 0),
        });
      } catch (accErr) {
        console.warn("Auto-journal entry error on sale (non-fatal):", accErr);
      }

      return {
        ...sale,
        items: createdItems,
        loyaltyEarned,
        creditAmount,
        businessName: business.name,
        legalName: business.legalName,
        vatNumber: business.vatNumber,
        address: business.address,
        phone: business.phone,
        receiptHeader: business.receiptHeader,
        receiptFooter: business.receiptFooter,
      };
    });

    return NextResponse.json({ success: true, sale: saleResult });
  } catch (error: any) {
    console.error("POS Sale checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
