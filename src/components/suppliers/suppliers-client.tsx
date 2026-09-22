"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  Edit,
  Trash2,
  DollarSign,
  TrendingDown,
  ShoppingBag,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

interface SupplierItem {
  id: string;
  supplierCode: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  creditLimit: number;
  creditBalance: number;
  paymentTermDays: number;
  bankName: string | null;
  bankAccount: string | null;
  totalPurchases: number;
}

export function SuppliersClient({
  initialSuppliers,
}: {
  initialSuppliers: SupplierItem[];
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState("");

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.supplierCode.toLowerCase().includes(q) ||
      s.phone.includes(q)
    );
  });

  const totalPayables = suppliers.reduce((sum, s) => sum + s.creditBalance, 0);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate supplier "${name}"?`)) return;

    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete supplier");

      toast.success(`Supplier "${name}" deactivated`);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete supplier");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers & Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Manage distributor relationships, payment terms, and vendor payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/purchases/orders/new"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-colors"
          >
            Create PO
          </Link>

          <Link
            href="/dashboard/suppliers/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Suppliers
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold">{suppliers.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Active supply partners</div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Outstanding Payables
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-rose-500">
            {formatCurrency(totalPayables)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Owed to suppliers</div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Procurement GRNs
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold">
            {suppliers.reduce((sum, s) => sum + s.totalPurchases, 0)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Goods received records</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by supplier name, contact person, code, or phone..."
            className="w-full rounded-xl border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Supplier & Code</th>
                <th className="px-5 py-3.5">Contact Person</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Credit Terms</th>
                <th className="px-5 py-3.5">Outstanding Balance</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {s.supplierCode}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <div className="font-medium">{s.contactPerson}</div>
                      <div className="text-muted-foreground">{s.phone}</div>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">{s.city}</td>

                    <td className="px-5 py-4 text-xs">
                      <span className="rounded-md border bg-muted px-2 py-0.5 font-medium">
                        Net {s.paymentTermDays} Days
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div
                        className={cn(
                          "font-bold text-xs",
                          s.creditBalance > 0 ? "text-rose-500" : "text-emerald-500"
                        )}
                      >
                        {formatCurrency(s.creditBalance)}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/suppliers/${s.id}/edit`}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          title="Deactivate Supplier"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
