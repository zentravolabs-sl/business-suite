import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeTax, clientIp } from "@/lib/tax/access";
import { toErrorResponse, TaxError } from "@/lib/tax/errors";
import { TAX_PERMISSIONS } from "@/lib/tax/constants";

export const ALLOWED_ACCOUNT_KEYS = [
  "OUTPUT_VAT",
  "INPUT_VAT",
  "SALES_REVENUE",
  "SERVICE_REVENUE",
  "COGS",
  "INVENTORY",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "ROUNDING",
  "SALES_RETURNS",
  "CASH",
  "BANK",
  "OPERATING_EXPENSE",
] as const;

export type TaxAccountKey = (typeof ALLOWED_ACCOUNT_KEYS)[number];

export async function GET() {
  try {
    const auth = await authorizeTax({ anyOf: [TAX_PERMISSIONS.VIEW, TAX_PERMISSIONS.EDIT_SETTINGS] });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    // Fetch all active accounts for dropdowns
    const accounts = await prisma.account.findMany({
      where: { businessId: tenant.businessId, isActive: true },
      select: { id: true, code: true, name: true, type: true, isBankAccount: true },
      orderBy: { code: "asc" },
    });

    // Fetch existing mappings
    const mappings = await prisma.taxAccountMapping.findMany({
      where: { businessId: tenant.businessId },
    });

    const mappingMap: Record<string, string> = {};
    for (const m of mappings) {
      mappingMap[m.key] = m.accountId;
    }

    return NextResponse.json({
      accounts,
      mappings: mappingMap,
      allowedKeys: ALLOWED_ACCOUNT_KEYS,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await authorizeTax({ anyOf: [TAX_PERMISSIONS.EDIT_SETTINGS] });
    if ("response" in auth) return auth.response;
    const { tenant } = auth;

    const body = await req.json();
    const rawMappings: Record<string, string> = body.mappings || {};

    // Validate account IDs exist and belong to this business
    const accountIds = Object.values(rawMappings).filter(Boolean);
    const existingAccounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, businessId: tenant.businessId },
      select: { id: true },
    });
    const validAccountIdSet = new Set(existingAccounts.map((a) => a.id));

    const result = await prisma.$transaction(async (tx) => {
      const priorMappings = await tx.taxAccountMapping.findMany({
        where: { businessId: tenant.businessId },
      });
      const priorMap: Record<string, string> = {};
      for (const m of priorMappings) {
        priorMap[m.key] = m.accountId;
      }

      for (const [key, accountId] of Object.entries(rawMappings)) {
        if (!ALLOWED_ACCOUNT_KEYS.includes(key as TaxAccountKey)) {
          throw new TaxError("INVALID_ACCOUNT_KEY", `Unknown tax account mapping key: "${key}"`);
        }

        if (!accountId) {
          // Remove mapping if set to empty
          await tx.taxAccountMapping.deleteMany({
            where: { businessId: tenant.businessId, key },
          });
        } else {
          if (!validAccountIdSet.has(accountId)) {
            throw new TaxError("ACCOUNT_NOT_FOUND", `Account ID "${accountId}" not found for key "${key}"`);
          }

          await tx.taxAccountMapping.upsert({
            where: {
              businessId_key: {
                businessId: tenant.businessId,
                key,
              },
            },
            update: {
              accountId,
              updatedById: tenant.userId,
            },
            create: {
              businessId: tenant.businessId,
              key,
              accountId,
              updatedById: tenant.userId,
            },
          });
        }
      }

      const updatedMappings = await tx.taxAccountMapping.findMany({
        where: { businessId: tenant.businessId },
      });
      const newMap: Record<string, string> = {};
      for (const m of updatedMappings) {
        newMap[m.key] = m.accountId;
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          businessId: tenant.businessId,
          userId: tenant.userId,
          action: "UPDATE",
          entity: "TaxAccountMapping",
          entityId: tenant.businessId,
          oldValue: priorMap,
          newValue: newMap,
          ipAddress: clientIp(req),
        },
      });

      return newMap;
    });

    return NextResponse.json({ success: true, mappings: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
