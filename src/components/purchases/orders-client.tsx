"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Search,
  Plus,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  ArrowRight,
  X,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

interface POItem {
  id: string;
  productName: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  total: number;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  supplierName: string;
  supplierId: string;
  branchName: string;
  branchId: string;
  status: string;
  total: number;
  expectedDate: string | null;
  createdAt: string;
  itemCount: number;
  items: POItem[];
}

export function OrdersClient({
  initialOrders,
}: {
  initialOrders: OrderRecord[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.supplierName.toLowerCase().includes(q);

    const matchesStatus = selectedStatus === "ALL" || o.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const handleCancelPO = async (po: OrderRecord) => {
    if (!confirm(`Are you sure you want to cancel Purchase Order ${po.orderNumber}?`)) return;

    try {
      const res = await fetch(`/api/purchases/orders/${po.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (!res.ok) throw new Error("Failed to cancel PO");

      toast.success(`${po.orderNumber} cancelled`);
      setOrders((prev) =>
        prev.map((o) => (o.id === po.id ? { ...o, status: "CANCELLED" } : o))
      );
      setActiveOrder(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">
            Issue procurement orders to vendors and track incoming shipments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/purchases/new"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Truck className="h-4 w-4 text-muted-foreground" />
            Direct GRN Intake
          </Link>

          <Link
            href="/dashboard/purchases/orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Create PO
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PO number or supplier name..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="ALL">All Statuses</option>
          <option value="ORDERED">Ordered</option>
          <option value="RECEIVED">Received</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">PO Number</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Destination Branch</th>
                <th className="px-5 py-3.5">Date Issued</th>
                <th className="px-5 py-3.5">Total Value</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-xs">{o.orderNumber}</td>
                    <td className="px-5 py-3.5 font-semibold text-xs">{o.supplierName}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{o.branchName}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-xs text-primary">
                      {formatCurrency(o.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          o.status === "ORDERED"
                            ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                            : o.status === "RECEIVED"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {o.status === "RECEIVED" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : o.status === "ORDERED" ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActiveOrder(o)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {o.status === "ORDERED" && (
                          <Link
                            href={`/dashboard/purchases/new?poId=${o.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Truck className="h-3 w-3" />
                            Receive GRN
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO Details Drawer Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="fixed inset-0" onClick={() => setActiveOrder(null)} />

          <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h2 className="text-base font-bold">Purchase Order #{activeOrder.orderNumber}</h2>
                <p className="text-xs text-muted-foreground">Issued to {activeOrder.supplierName}</p>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border rounded-xl p-3 bg-muted/20">
              <div>
                <span className="text-muted-foreground">Supplier: </span>
                <span className="font-semibold">{activeOrder.supplierName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Branch: </span>
                <span className="font-semibold">{activeOrder.branchName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date: </span>
                <span>{formatDate(activeOrder.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <span className="font-bold">{activeOrder.status}</span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-border text-xs">
              {activeOrder.items.map((it) => (
                <div key={it.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{it.productName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.quantity} units x {formatCurrency(it.unitCost)}
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(it.total)}</div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t flex justify-between text-base font-extrabold">
              <span>Total Estimated Cost:</span>
              <span className="text-primary">{formatCurrency(activeOrder.total)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              {activeOrder.status === "ORDERED" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleCancelPO(activeOrder)}
                    className="rounded-xl border border-destructive/30 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Cancel Order
                  </button>
                  <Link
                    href={`/dashboard/purchases/new?poId=${activeOrder.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                  >
                    <Truck className="h-4 w-4" />
                    Receive & Stock via GRN
                  </Link>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Order has been finalized.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
