"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Wrench,
  User,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Clock,
  Check,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface CustomerOption {
  id: string;
  name: string;
  phone?: string | null;
}

interface TechnicianOption {
  id: string;
  name: string;
  email?: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku?: string | null;
}

export function ServiceTicketForm({
  customers,
  technicians,
  products,
  branchId,
}: {
  customers: CustomerOption[];
  technicians: TechnicianOption[];
  products: ProductOption[];
  branchId?: string | null;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [deviceName, setDeviceName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [issue, setIssue] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id || "");
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [estimatedCompletionAt, setEstimatedCompletionAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [isWarranty, setIsWarranty] = useState(false);
  const [warrantyId, setWarrantyId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      toast.error("Please enter a device name or model");
      return;
    }
    if (!issue.trim()) {
      toast.error("Please describe the reported issue");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/service/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          branchId: branchId || null,
          technicianId: technicianId || null,
          deviceName: deviceName.trim(),
          serialNumber: serialNumber.trim() || null,
          issue: issue.trim(),
          description: description.trim() || null,
          priority,
          estimatedCost,
          estimatedCompletionAt: estimatedCompletionAt || null,
          isWarranty,
          warrantyId: isWarranty ? warrantyId.trim() || null : null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create service ticket");

      toast.success(
        `Job Sheet #${data.ticket?.ticketNumber || ""} created successfully!`
      );
      router.push("/dashboard/service");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/service"
            className="rounded-xl border p-2 hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Repair Job Sheet</h1>
            <p className="text-xs text-muted-foreground">
              Intake customer device, log reported issues, and assign technician.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Creating..." : "Create Job Sheet"}
        </button>
      </div>

      {/* Customer & Device Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> Customer & Device Details
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Device Brand & Model *
            </label>
            <input
              type="text"
              placeholder="e.g. Apple iPhone 14 Pro 128GB"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Device Serial / IMEI Number
            </label>
            <input
              type="text"
              placeholder="e.g. 354819028471923"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Assign Technician
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Unassigned / Pool</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Fault Diagnostics Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Fault & Diagnostic Intake
        </h2>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Reported Issue / Problem *
          </label>
          <input
            type="text"
            placeholder="e.g. Screen cracked, touch digitizer unresponsive on lower half"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Cosmetic Condition & Accessories Received
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Scratches on aluminum frame. Received with original silicon case and 20W charger."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Priority Level
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent / Express</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Estimated Cost (LKR)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={estimatedCost || ""}
              onChange={(e) => setEstimatedCost(Number(e.target.value))}
              placeholder="0.00"
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Estimated Delivery Date
            </label>
            <input
              type="date"
              value={estimatedCompletionAt}
              onChange={(e) => setEstimatedCompletionAt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Warranty Coverage Link Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Warranty Coverage</h2>
              <p className="text-xs text-muted-foreground">
                Mark if this repair is covered under seller or manufacturer warranty.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isWarranty}
              onChange={(e) => setIsWarranty(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {isWarranty && (
          <div className="pt-3 border-t">
            <label className="text-xs font-semibold text-muted-foreground">
              Warranty Certificate Code (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. WC-000001"
              value={warrantyId}
              onChange={(e) => setWarrantyId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Internal Remarks */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">
          Internal Workshop Notes (Technician only)
        </label>
        <textarea
          rows={2}
          placeholder="Special instructions, password/passcode if provided by customer..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading ? "Creating Job Sheet..." : "Confirm & Issue Job Sheet"}
        </button>
      </div>
    </form>
  );
}
