"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  FileText,
  Calendar,
  CreditCard,
  Building2,
  Receipt,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

export default function CustomerOrdersPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/portal/data");
        if (res.ok) {
          const json = await res.json();
          setSales(json.sales || []);
          setOnlineOrders(json.onlineOrders || []);
        }
      } catch (err) {
        console.error("Failed to load purchases:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-blue-600" />
          Purchase & Invoice History
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View all in-store POS receipts and online deliveries linked to your customer profile
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading purchase records...
        </div>
      ) : sales.length === 0 && onlineOrders.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-base font-semibold">No purchase history found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Receipts from your in-store purchases and online store orders will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => {
            const isExpanded = expandedId === sale.id;

            return (
              <Card key={sale.id} className="shadow-xs overflow-hidden transition-all">
                <div
                  onClick={() => toggleExpand(sale.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{sale.invoiceNumber}</span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                          PAID
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(sale.date).toLocaleDateString("en-LK", { dateStyle: "medium" })} · {sale.branchName || "Main Branch"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-base font-extrabold text-foreground">{formatCurrency(sale.total)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {sale.items.length} item{sale.items.length !== 1 ? "s" : ""} · via {sale.paymentMethod}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Line Items Expansion */}
                {isExpanded && (
                  <CardContent className="px-5 pb-5 pt-0 border-t bg-muted/20">
                    <div className="pt-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Itemized Receipt Breakdown
                      </p>
                      <table className="w-full text-left text-xs">
                        <thead className="border-b text-muted-foreground">
                          <tr>
                            <th className="py-2">Item Description</th>
                            <th className="py-2 text-center">Qty</th>
                            <th className="py-2 text-right">Unit Price</th>
                            <th className="py-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {sale.items.map((item: any, i: number) => (
                            <tr key={i}>
                              <td className="py-2.5 font-medium">{item.name}</td>
                              <td className="py-2.5 text-center text-muted-foreground">{item.quantity}</td>
                              <td className="py-2.5 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                              <td className="py-2.5 text-right font-semibold">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t font-semibold">
                          <tr>
                            <td colSpan={3} className="py-2.5 text-right">Total Paid:</td>
                            <td className="py-2.5 text-right text-primary text-sm font-bold">
                              {formatCurrency(sale.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
