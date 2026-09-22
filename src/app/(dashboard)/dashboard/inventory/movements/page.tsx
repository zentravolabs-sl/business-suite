import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, ScrollText, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export const metadata = {
  title: "Stock Movements Log | Zentravo BMS",
};

export const dynamic = "force-dynamic";

export default async function StockMovementsPage() {
  const tenant = await requireTenant();

  const movements = await prisma.stockMovement.findMany({
    where: { businessId: tenant.businessId },
    include: {
      product: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/inventory"
          className="rounded-xl border p-2 hover:bg-muted transition-colors text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Movements Log</h1>
          <p className="text-xs text-muted-foreground">
            Complete immutable audit trail of sales, adjustments, goods received, and transfers.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Movement Type</th>
                <th className="px-5 py-3.5">Quantity Changed</th>
                <th className="px-5 py-3.5">Before → After</th>
                <th className="px-5 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-xs">{m.product.name}</div>
                        <div className="text-[11px] text-muted-foreground">{m.product.sku}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-md border bg-muted px-2 py-0.5 text-[11px] font-medium">
                          {m.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs ${
                            isPositive ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">
                        {m.quantityBefore} → {m.quantityAfter}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {m.notes || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
