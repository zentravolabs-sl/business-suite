"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, User, Phone, Mail, MapPin, CreditCard, Check } from "lucide-react";
import { toast } from "sonner";

interface SupplierFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export function SupplierForm({ initialData, isEdit = false }: SupplierFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    supplierCode: initialData?.supplierCode || "",
    contactPerson: initialData?.contactPerson || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    address: initialData?.address || "",
    city: initialData?.city || "Colombo",
    taxNumber: initialData?.taxNumber || "",
    vatNumber: initialData?.vatNumber || "",
    creditLimit: initialData?.creditLimit ? Number(initialData.creditLimit) : 500000,
    paymentTermDays: initialData?.paymentTermDays ?? 30,
    bankName: initialData?.bankName || "Commercial Bank",
    bankAccount: initialData?.bankAccount || "",
    notes: initialData?.notes || "",
  });

  const update = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/suppliers/${initialData.id}` : "/api/suppliers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save supplier");

      toast.success(isEdit ? "Supplier updated successfully" : "Supplier registered successfully");
      router.push("/dashboard/suppliers");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/suppliers"
            className="rounded-xl border p-2 hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? "Edit Supplier Profile" : "Register New Supplier"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure vendor payment terms, bank account numbers, and credit limit.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Saving..." : isEdit ? "Update Supplier" : "Save Supplier"}
        </button>
      </div>

      {/* Basic Info */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Company & Contact Details
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier / Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Abans PLC, Singer Sri Lanka, Hayleys Consumer"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Person / Representative
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => update("contactPerson", e.target.value)}
              placeholder="e.g. Ruwan Silva"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="e.g. 011 257 5800 or 077 345 6789"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="orders@supplier.lk"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="Colombo"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Physical Warehouse / Office Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="No. 498, Galle Road, Colombo 03"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Credit Terms & Banking Details */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <CreditCard className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Credit Terms & Bank Account
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Credit Payment Terms (Days)
            </label>
            <select
              value={formData.paymentTermDays}
              onChange={(e) => update("paymentTermDays", parseInt(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value={0}>Cash on Delivery (Immediate)</option>
              <option value={7}>Net 7 Days</option>
              <option value={15}>Net 15 Days</option>
              <option value={30}>Net 30 Days (Standard)</option>
              <option value={60}>Net 60 Days</option>
              <option value={90}>Net 90 Days</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Credit Limit (Rs.)
            </label>
            <input
              type="number"
              min="0"
              value={formData.creditLimit}
              onChange={(e) => update("creditLimit", parseFloat(e.target.value) || 0)}
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier Bank Name
            </label>
            <input
              type="text"
              value={formData.bankName}
              onChange={(e) => update("bankName", e.target.value)}
              placeholder="e.g. Commercial Bank, Sampath Bank, HNB"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bank Account Number
            </label>
            <input
              type="text"
              value={formData.bankAccount}
              onChange={(e) => update("bankAccount", e.target.value)}
              placeholder="e.g. 1000293848"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              VAT Registration Number
            </label>
            <input
              type="text"
              value={formData.vatNumber}
              onChange={(e) => update("vatNumber", e.target.value)}
              placeholder="e.g. 102938475-7000"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tax ID / TIN Number
            </label>
            <input
              type="text"
              value={formData.taxNumber}
              onChange={(e) => update("taxNumber", e.target.value)}
              placeholder="e.g. TIN-8829304"
              className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
