import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getNextEntryNumber, isNormalDebit } from "@/lib/accounting";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const journalLineSchema = z.object({
  debitAccountId: z.string().optional().nullable(),
  creditAccountId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Line amount must be greater than 0"),
  description: z.string().optional().nullable(),
});

const journalEntryCreateSchema = z.object({
  description: z.string().min(3, "Description is required"),
  reference: z.string().optional().nullable(),
  postedAt: z.string().optional().nullable(),
  lines: z.array(journalLineSchema).min(1, "At least one journal line is required"),
});

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const referenceType = searchParams.get("referenceType");
    const q = searchParams.get("q") || "";

    const where: any = {
      businessId: tenant.businessId,
    };

    if (referenceType && referenceType !== "ALL") {
      where.referenceType = referenceType;
    }

    if (q) {
      where.OR = [
        { entryNumber: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
      ];
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            debitAccount: { select: { id: true, code: true, name: true, type: true } },
            creditAccount: { select: { id: true, code: true, name: true, type: true } },
          },
        },
      },
      orderBy: { postedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("Journal GET error:", error);
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
    const parsed = journalEntryCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: (parsed.error as any).issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { description, reference, postedAt, lines } = parsed.data;

    // Validate that lines are valid:
    // Each line must have at least debitAccountId or creditAccountId
    for (const l of lines) {
      if (!l.debitAccountId && !l.creditAccountId) {
        return NextResponse.json(
          { error: "Each line must specify at least a Debit or Credit account." },
          { status: 400 }
        );
      }
    }

    // Double-entry validation: Sum(Debits) must equal Sum(Credits)
    let totalDebits = 0;
    let totalCredits = 0;

    for (const l of lines) {
      if (l.debitAccountId && l.creditAccountId) {
        // Paired line: debits and credits are equal for this line
        totalDebits += l.amount;
        totalCredits += l.amount;
      } else if (l.debitAccountId) {
        totalDebits += l.amount;
      } else if (l.creditAccountId) {
        totalCredits += l.amount;
      }
    }

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        {
          error: `Journal entry is out of balance! Total Debits: LKR ${totalDebits.toLocaleString()} vs Total Credits: LKR ${totalCredits.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const entryNumber = await getNextEntryNumber(tx, tenant.businessId, "MAN");

      const entry = await tx.journalEntry.create({
        data: {
          businessId: tenant.businessId,
          entryNumber,
          description: description.trim(),
          reference: reference?.trim() || null,
          referenceType: "Manual",
          isPosted: true,
          postedAt: postedAt ? new Date(postedAt) : new Date(),
          lines: {
            create: lines.map((l) => ({
              debitAccountId: l.debitAccountId || null,
              creditAccountId: l.creditAccountId || null,
              amount: new Prisma.Decimal(l.amount),
              description: l.description?.trim() || null,
            })),
          },
        },
        include: {
          lines: {
            include: {
              debitAccount: true,
              creditAccount: true,
            },
          },
        },
      });

      // Update account balances
      for (const l of lines) {
        if (l.debitAccountId) {
          const acc = await tx.account.findUnique({
            where: { id: l.debitAccountId },
          });
          if (acc) {
            const isDebitNormal = isNormalDebit(acc.type);
            const delta = isDebitNormal ? l.amount : -l.amount;
            await tx.account.update({
              where: { id: l.debitAccountId },
              data: { balance: { increment: new Prisma.Decimal(delta) } },
            });
          }
        }

        if (l.creditAccountId) {
          const acc = await tx.account.findUnique({
            where: { id: l.creditAccountId },
          });
          if (acc) {
            const isDebitNormal = isNormalDebit(acc.type);
            const delta = isDebitNormal ? -l.amount : l.amount;
            await tx.account.update({
              where: { id: l.creditAccountId },
              data: { balance: { increment: new Prisma.Decimal(delta) } },
            });
          }
        }
      }

      return entry;
    });

    return NextResponse.json({ success: true, entry: result }, { status: 201 });
  } catch (error: any) {
    console.error("Journal POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
