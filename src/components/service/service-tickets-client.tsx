"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Search,
  Plus,
  Printer,
  X,
  Check,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Package,
  Phone,
  ArrowRight,
  Trash2,
  DollarSign,
  ShieldCheck,
  Tag,
  Boxes,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export interface SerializedPart {
  id: string;
  productId?: string | null;
  partName: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  total: number;
  fromInventory: boolean;
}

export interface SerializedTicketUpdate {
  id: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface SerializedTicket {
  id: string;
  ticketNumber: string;
  deviceName: string;
  serialNumber?: string | null;
  issue: string;
  description?: string | null;
  status: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  customerName?: string | null;
  customerPhone?: string | null;
  technicianName?: string | null;
  technicianId?: string | null;
  estimatedCost: number;
  finalCost: number;
  laborCost: number;
  partsCost: number;
  isWarranty: boolean;
  isPaid: boolean;
  receivedAt: string;
  estimatedCompletionAt?: string | null;
  completedAt?: string | null;
  deliveredAt?: string | null;
  parts: SerializedPart[];
  updates: SerializedTicketUpdate[];
}

export interface InventoryProduct {
  id: string;
  name: string;
  sku?: string | null;
  costPrice: number;
  retailPrice: number;
  stockQty: number;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  RECEIVED: { label: "Received", badge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  UNDER_INSPECTION: { label: "Inspecting", badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  WAITING_FOR_PARTS: { label: "Waiting Parts", badge: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  REPAIRING: { label: "In Repair", badge: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  READY: { label: "Ready for Pickup", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  DELIVERED: { label: "Delivered", badge: "bg-muted text-muted-foreground border-border" },
  CANCELLED: { label: "Cancelled", badge: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
};

const PRIORITY_CONFIG: Record<string, string> = {
  LOW: "text-muted-foreground",
  NORMAL: "text-foreground font-medium",
  HIGH: "text-amber-600 font-bold",
  URGENT: "text-rose-600 font-extrabold animate-pulse",
};

export function ServiceTicketsClient({
  initialTickets,
  technicians,
  inventoryProducts,
}: {
  initialTickets: SerializedTicket[];
  technicians: { id: string; name: string }[];
  inventoryProducts: InventoryProduct[];
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState<SerializedTicket[]>(initialTickets);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [selectedTech, setSelectedTech] = useState("ALL");

  // Active Ticket Modal Drawer
  const [activeTicket, setActiveTicket] = useState<SerializedTicket | null>(null);

  // Add Part Modal
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [fromInventory, setFromInventory] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(inventoryProducts[0]?.id || "");
  const [customPartName, setCustomPartName] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partPrice, setPartPrice] = useState(0);
  const [submittingPart, setSubmittingPart] = useState(false);

  // Labor update state
  const [laborInput, setLaborInput] = useState<number>(0);

  // Sync labor when active ticket changes
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);
  if (activeTicket && activeTicket.id !== lastTicketId) {
    setLastTicketId(activeTicket.id);
    setLaborInput(activeTicket.laborCost);
  }

  // Statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    const received = tickets.filter((t) => t.status === "RECEIVED").length;
    const inRepair = tickets.filter(
      (t) => t.status === "UNDER_INSPECTION" || t.status === "REPAIRING" || t.status === "WAITING_FOR_PARTS"
    ).length;
    const ready = tickets.filter((t) => t.status === "READY").length;
    const delivered = tickets.filter((t) => t.status === "DELIVERED").length;
    return { total, received, inRepair, ready, delivered };
  }, [tickets]);

  // Filtered tickets
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        t.ticketNumber.toLowerCase().includes(q) ||
        t.deviceName.toLowerCase().includes(q) ||
        (t.serialNumber && t.serialNumber.toLowerCase().includes(q)) ||
        t.issue.toLowerCase().includes(q) ||
        (t.customerName && t.customerName.toLowerCase().includes(q)) ||
        (t.customerPhone && t.customerPhone.toLowerCase().includes(q));

      const matchStatus = selectedStatus === "ALL" || t.status === selectedStatus;
      const matchPriority = selectedPriority === "ALL" || t.priority === selectedPriority;
      const matchTech = selectedTech === "ALL" || t.technicianId === selectedTech;

      return matchSearch && matchStatus && matchPriority && matchTech;
    });
  }, [tickets, searchTerm, selectedStatus, selectedPriority, selectedTech]);

  // Progress status of active ticket
  const updateTicketStatus = async (newStatus: string) => {
    if (!activeTicket) return;
    try {
      const res = await fetch(`/api/service/tickets/${activeTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast.success(`Job Sheet status updated to ${newStatus}`);
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? { ...t, status: newStatus } : t))
      );
      setActiveTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Update labor cost
  const handleUpdateLabor = async () => {
    if (!activeTicket) return;
    try {
      const res = await fetch(`/api/service/tickets/${activeTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ laborCost: laborInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update labor");

      toast.success("Labor cost updated");
      const updated = data.ticket;
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? { ...t, laborCost: laborInput, finalCost: Number(updated.finalCost) } : t))
      );
      setActiveTicket((prev) =>
        prev ? { ...prev, laborCost: laborInput, finalCost: Number(updated.finalCost) } : null
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Toggle paid status
  const handleTogglePaid = async () => {
    if (!activeTicket) return;
    const newPaid = !activeTicket.isPaid;
    try {
      const res = await fetch(`/api/service/tickets/${activeTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: newPaid }),
      });
      if (!res.ok) throw new Error("Failed to update payment status");

      toast.success(newPaid ? "Marked as Paid" : "Marked as Unpaid");
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? { ...t, isPaid: newPaid } : t))
      );
      setActiveTicket((prev) => (prev ? { ...prev, isPaid: newPaid } : null));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Add Part Submit
  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;

    let partName = customPartName;
    let unitCost = 0;
    let prodId: string | null = null;

    if (fromInventory) {
      const p = inventoryProducts.find((item) => item.id === selectedProduct);
      if (!p) {
        toast.error("Please select a product");
        return;
      }
      partName = p.name;
      unitCost = p.costPrice;
      prodId = p.id;
    }

    if (!partName.trim()) {
      toast.error("Part name is required");
      return;
    }

    setSubmittingPart(true);
    try {
      const res = await fetch(`/api/service/tickets/${activeTicket.id}/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prodId,
          partName: partName.trim(),
          quantity: partQty,
          unitCost,
          sellingPrice: partPrice,
          fromInventory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add part");

      toast.success(`Part ${partName} added to repair ticket`);
      const newPart: SerializedPart = {
        id: data.part.id,
        productId: data.part.productId,
        partName: data.part.partName,
        quantity: data.part.quantity,
        unitCost: Number(data.part.unitCost),
        sellingPrice: Number(data.part.sellingPrice),
        total: Number(data.part.total),
        fromInventory: data.part.fromInventory,
      };

      const updatedParts = [...activeTicket.parts, newPart];
      const newPartsSum = updatedParts.reduce((s, p) => s + p.total, 0);
      const newFinal = activeTicket.laborCost + newPartsSum;

      setActiveTicket((prev) =>
        prev
          ? {
              ...prev,
              parts: updatedParts,
              partsCost: newPartsSum,
              finalCost: newFinal,
            }
          : null
      );

      setTickets((prev) =>
        prev.map((t) =>
          t.id === activeTicket.id
            ? { ...t, parts: updatedParts, partsCost: newPartsSum, finalCost: newFinal }
            : t
        )
      );

      setAddPartOpen(false);
      setCustomPartName("");
      setPartQty(1);
      setPartPrice(0);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingPart(false);
    }
  };

  // Remove Part
  const handleRemovePart = async (partId: string) => {
    if (!activeTicket) return;
    try {
      const res = await fetch(
        `/api/service/tickets/${activeTicket.id}/parts?partId=${partId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove part");

      toast.success("Spare part removed and restocked");
      const updatedParts = activeTicket.parts.filter((p) => p.id !== partId);
      const newPartsSum = updatedParts.reduce((s, p) => s + p.total, 0);
      const newFinal = activeTicket.laborCost + newPartsSum;

      setActiveTicket((prev) =>
        prev
          ? {
              ...prev,
              parts: updatedParts,
              partsCost: newPartsSum,
              finalCost: newFinal,
            }
          : null
      );

      setTickets((prev) =>
        prev.map((t) =>
          t.id === activeTicket.id
            ? { ...t, parts: updatedParts, partsCost: newPartsSum, finalCost: newFinal }
            : t
        )
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repair & Service Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Intake job sheets, diagnostics, technician assignments, spare parts consumption, and repair billing.
          </p>
        </div>

        <Link
          href="/dashboard/service/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> New Job Sheet
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total Tickets
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono">{stats.total}</span>
            <span className="rounded-full bg-blue-500/10 p-1.5 text-blue-600">
              <Wrench className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            New Received
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-600">
              {stats.received}
            </span>
            <span className="rounded-full bg-blue-500/10 p-1.5 text-blue-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            In Workshop
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-600">
              {stats.inRepair}
            </span>
            <span className="rounded-full bg-amber-500/10 p-1.5 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Ready for Pickup
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-600">
              {stats.ready}
            </span>
            <span className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Delivered / Closed
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-muted-foreground">
              {stats.delivered}
            </span>
            <span className="rounded-full bg-muted p-1.5 text-muted-foreground">
              <Check className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ticket #, model, IMEI, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent / Express</option>
            </select>
          </div>

          <div>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Technicians</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Device & Reported Fault</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3 text-right">Estimated / Final</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No service tickets found</p>
                    <p className="text-xs">Adjust filters or create a new job sheet.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((ticket) => {
                  const cfg = STATUS_CONFIG[ticket.status] || {
                    label: ticket.status,
                    badge: "bg-muted text-muted-foreground",
                  };
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setActiveTicket(ticket)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-primary group-hover:underline">
                        {ticket.ticketNumber}
                        {ticket.isWarranty && (
                          <span className="block text-[9px] text-emerald-600 font-bold uppercase">
                            Warranty
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground">
                          {ticket.deviceName}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {ticket.issue}
                        </p>
                        {ticket.serialNumber && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            SN: {ticket.serialNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {ticket.customerName ? (
                          <div>
                            <span className="font-semibold text-foreground">
                              {ticket.customerName}
                            </span>
                            {ticket.customerPhone && (
                              <span className="text-[11px] text-muted-foreground block font-mono">
                                {ticket.customerPhone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {ticket.technicianName ? (
                          <span className="font-medium text-foreground">
                            {ticket.technicianName}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={PRIORITY_CONFIG[ticket.priority] || "text-foreground"}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold">
                        {formatCurrency(ticket.finalCost || ticket.estimatedCost)}
                        {ticket.isPaid ? (
                          <span className="block text-[10px] text-emerald-600 font-semibold">
                            Paid
                          </span>
                        ) : (
                          <span className="block text-[10px] text-amber-600 font-semibold">
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTicket(ticket);
                          }}
                          className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Drawer / Modal */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border bg-card p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              onClick={() => setActiveTicket(null)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono">
                    {activeTicket.ticketNumber}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                      STATUS_CONFIG[activeTicket.status]?.badge || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {STATUS_CONFIG[activeTicket.status]?.label || activeTicket.status}
                  </span>
                  {activeTicket.isWarranty && (
                    <span className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                      Warranty Repair
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Received on {formatDate(activeTicket.receivedAt)} • Priority:{" "}
                  <strong>{activeTicket.priority}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Job Sheet
                </button>
              </div>
            </div>

            {/* Status Progression Stepper */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Progress Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "RECEIVED",
                  "UNDER_INSPECTION",
                  "WAITING_FOR_PARTS",
                  "REPAIRING",
                  "READY",
                  "DELIVERED",
                ].map((st) => {
                  const isCurrent = activeTicket.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => updateTicketStatus(st)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/30 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_CONFIG[st]?.label || st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Device & Customer Grid */}
            <div className="rounded-2xl bg-muted/40 border p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Device Model
                </span>
                <span className="font-bold text-foreground text-sm">
                  {activeTicket.deviceName}
                </span>
                {activeTicket.serialNumber && (
                  <span className="text-[11px] font-mono text-muted-foreground block">
                    IMEI/SN: {activeTicket.serialNumber}
                  </span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Customer
                </span>
                <span className="font-semibold text-foreground">
                  {activeTicket.customerName || "Walk-in"}
                </span>
                {activeTicket.customerPhone && (
                  <span className="text-[11px] font-mono text-muted-foreground block">
                    {activeTicket.customerPhone}
                  </span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Assigned Technician
                </span>
                <span className="font-semibold text-foreground">
                  {activeTicket.technicianName || "Unassigned"}
                </span>
              </div>
            </div>

            {/* Issue Description */}
            <div className="rounded-xl border p-4 text-xs space-y-1 bg-background/50">
              <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                Reported Fault / Diagnostic Notes
              </span>
              <p className="font-semibold text-foreground">{activeTicket.issue}</p>
              {activeTicket.description && (
                <p className="text-muted-foreground text-[11px] leading-relaxed mt-1">
                  {activeTicket.description}
                </p>
              )}
            </div>

            {/* Spare Parts Manager */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-primary" /> Spare Parts Replaced (
                  {activeTicket.parts.length})
                </span>
                <button
                  type="button"
                  onClick={() => setAddPartOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 px-2.5 py-1 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Spare Part
                </button>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b text-[10px] font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Part Name</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Price (LKR)</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeTicket.parts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-muted-foreground italic"
                        >
                          No spare parts attached to this job sheet.
                        </td>
                      </tr>
                    ) : (
                      activeTicket.parts.map((part) => (
                        <tr key={part.id}>
                          <td className="px-3 py-2">
                            <span className="font-semibold">{part.partName}</span>
                            {part.fromInventory && (
                              <span className="ml-2 rounded bg-blue-500/10 text-blue-600 px-1 py-0.2 text-[9px] font-semibold">
                                From Stock
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-bold">
                            {part.quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatCurrency(part.sellingPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            {formatCurrency(part.total)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePart(part.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financials & Invoicing Card */}
            <div className="rounded-2xl border bg-muted/40 p-4 space-y-3">
              <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                Repair Costing & Invoicing
              </span>

              <div className="grid gap-3 sm:grid-cols-3 items-center text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Labor Service Charge (LKR)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={laborInput}
                      onChange={(e) => setLaborInput(Number(e.target.value))}
                      className="w-full rounded-lg border bg-background px-2.5 py-1.5 font-mono text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateLabor}
                      className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="text-center sm:text-right">
                  <span className="text-[10px] text-muted-foreground block">
                    Parts Total
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {formatCurrency(activeTicket.partsCost)}
                  </span>
                </div>

                <div className="text-center sm:text-right">
                  <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                    Total Repair Invoice
                  </span>
                  <span className="font-mono text-lg font-bold text-primary">
                    {formatCurrency(activeTicket.finalCost)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleTogglePaid}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border font-bold transition-all ${
                    activeTicket.isPaid
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-background text-amber-600 border-amber-300"
                  }`}
                >
                  <Check className="h-3 w-3" />
                  {activeTicket.isPaid ? "Paid in Full" : "Mark as Paid"}
                </button>
                <span className="text-[11px] text-muted-foreground">
                  Estimated Completion:{" "}
                  {activeTicket.estimatedCompletionAt
                    ? formatDate(activeTicket.estimatedCompletionAt)
                    : "Not specified"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Part Modal */}
      {addPartOpen && activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setAddPartOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Add Replacement Part</h3>
                <p className="text-xs text-muted-foreground">
                  Attach part to {activeTicket.ticketNumber}
                </p>
              </div>
            </div>

            <form onSubmit={handleAddPart} className="space-y-3">
              <div className="flex items-center gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="partSource"
                    checked={fromInventory}
                    onChange={() => setFromInventory(true)}
                  />
                  From Inventory (Auto-Stock Out)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="partSource"
                    checked={!fromInventory}
                    onChange={() => setFromInventory(false)}
                  />
                  Custom Part / External
                </label>
              </div>

              {fromInventory ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Select Part Product *
                  </label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => {
                      setSelectedProduct(e.target.value);
                      const p = inventoryProducts.find((it) => it.id === e.target.value);
                      if (p) setPartPrice(p.retailPrice);
                    }}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {inventoryProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stockQty}) — {formatCurrency(p.retailPrice)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Part Name / Description *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OLED Display Assembly OEM"
                    value={customPartName}
                    onChange={(e) => setCustomPartName(e.target.value)}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={partQty}
                    onChange={(e) => setPartQty(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-bold font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Selling Price (LKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={partPrice}
                    onChange={(e) => setPartPrice(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-bold font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddPartOpen(false)}
                  className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPart}
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingPart ? "Adding..." : "Add Part"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
