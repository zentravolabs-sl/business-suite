import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { PrintTaxDocumentClient, type PrintClientProps } from "./print-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tax Invoice | Zentravo",
  description: "Official Tax Document Print & Export",
};

import { formatBusinessDateDisplay } from "@/lib/tax/dates";

export default async function PrintTaxDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  const { id } = await params;

  const doc = await prisma.taxDocument.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      lines: { orderBy: { lineNo: "asc" } },
      branch: { select: { name: true, code: true } },
      parentDocument: { select: { documentNumber: true, documentType: true } },
    },
  });

  if (!doc) {
    notFound();
  }

  const serializedDoc = {
    ...doc,
    grossTotal: Number(doc.grossTotal).toFixed(2),
    discountTotal: Number(doc.discountTotal).toFixed(2),
    netValue: Number(doc.netValue).toFixed(2),
    standardRatedValue: Number(doc.standardRatedValue).toFixed(2),
    zeroRatedValue: Number(doc.zeroRatedValue).toFixed(2),
    exemptValue: Number(doc.exemptValue).toFixed(2),
    outOfScopeValue: Number(doc.outOfScopeValue).toFixed(2),
    taxTotal: Number(doc.taxTotal).toFixed(2),
    grandTotal: Number(doc.grandTotal).toFixed(2),
    paidAmount: Number(doc.paidAmount).toFixed(2),
    balanceDue: Number(doc.balanceDue).toFixed(2),
    issueDateStr: formatBusinessDateDisplay(doc.issueDate),
    supplyDateStr: formatBusinessDateDisplay(doc.supplyDate),
    parentDocumentNumber: doc.parentDocument?.documentNumber || null,
    lines: doc.lines.map((l) => ({
      ...l,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice).toFixed(2),
      grossAmount: Number(l.grossAmount).toFixed(2),
      discountAmount: Number(l.discountAmount).toFixed(2),
      taxableValue: Number(l.taxableValue).toFixed(2),
      taxAmount: Number(l.taxAmount).toFixed(2),
      lineTotal: Number(l.lineTotal).toFixed(2),
      ratePercent: Number(l.ratePercent),
    })),
  };

  return <PrintTaxDocumentClient doc={serializedDoc as unknown as PrintClientProps["doc"]} />;
}
