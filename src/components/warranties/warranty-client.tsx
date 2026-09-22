"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ShieldCheck,
  Search,
  Plus,
  QrCode,
  Printer,
  X,
  Check,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wrench,
  Package,
  ExternalLink,
  Copy,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export interface SerializedWarranty {
  id: string;
  code: string;
  serialNumber?: string | null;
  productName: string;
  productId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerId?: string | null;
  purchaseDate: string;
  startDate: string;
  endDate: string;
  warrantyMonths: number;
  type: string;
  status: string;
  terms?: string | null;
  claimsCount: number;
}

export function WarrantyClient({
  initialWarranties,
  products,
  customers,
}: {
  initialWarranties: SerializedWarranty[];
  products: { id: string; name: string; sku?: string | null; warrantyMonths?: number | null }[];
  customers: { id: string; name: string; phone?: string | null }[];
}) {
  const router = useRouter();
  const [warranties, setWarranties] = useState<SerializedWarranty[]>(initialWarranties);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Certificate Modal State
  const [activeWarranty, setActiveWarranty] = useState<SerializedWarranty | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Claim Modal State
  const [claimWarranty, setClaimWarranty] = useState<SerializedWarranty | null>(null);
  const [problem, setProblem] = useState("");
  const [claimDesc, setClaimDesc] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // New Warranty Modal State
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newProductId, setNewProductId] = useState(products[0]?.id || "");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newMonths, setNewMonths] = useState(12);
  const [newType, setNewType] = useState<"SELLER" | "MANUFACTURER" | "SERVICE" | "EXTENDED">("SELLER");
  const [newTerms, setNewTerms] = useState("");
  const [submittingNew, setSubmittingNew] = useState(false);

  // Generate QR code when active warranty changes
  useEffect(() => {
    if (activeWarranty) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const verifyUrl = `${origin}/verify-warranty?code=${encodeURIComponent(activeWarranty.code)}`;
      QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Generation error:", err));
    }
  }, [activeWarranty]);

  // Compute stats
  const now = new Date();
  const stats = useMemo(() => {
    const total = warranties.length;
    const active = warranties.filter(
      (w) => w.status === "ACTIVE" && new Date(w.endDate) > now
    ).length;
    const expiringSoon = warranties.filter((w) => {
      if (w.status !== "ACTIVE") return false;
      const end = new Date(w.endDate);
      const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= 30;
    }).length;
    const claimed = warranties.filter((w) => w.status === "CLAIMED" || w.claimsCount > 0).length;
    return { total, active, expiringSoon, claimed };
  }, [warranties]);

  // Filter warranties
  const filtered = useMemo(() => {
    return warranties.filter((w) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        w.code.toLowerCase().includes(q) ||
        (w.serialNumber && w.serialNumber.toLowerCase().includes(q)) ||
        w.productName.toLowerCase().includes(q) ||
        (w.customerName && w.customerName.toLowerCase().includes(q)) ||
        (w.customerPhone && w.customerPhone.toLowerCase().includes(q));

      let matchStatus = true;
      if (selectedStatus === "ACTIVE") {
        matchStatus = w.status === "ACTIVE" && new Date(w.endDate) > now;
      } else if (selectedStatus === "EXPIRING_SOON") {
        const end = new Date(w.endDate);
        const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        matchStatus = w.status === "ACTIVE" && diffDays > 0 && diffDays <= 30;
      } else if (selectedStatus === "EXPIRED") {
        matchStatus = new Date(w.endDate) <= now;
      } else if (selectedStatus === "CLAIMED") {
        matchStatus = w.status === "CLAIMED" || w.claimsCount > 0;
      }

      return matchSearch && matchStatus;
    });
  }, [warranties, searchTerm, selectedStatus]);

  const handleCreateWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductId) {
      toast.error("Please select a product");
      return;
    }

    setSubmittingNew(true);
    try {
      const res = await fetch("/api/warranties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: newProductId,
          customerId: newCustomerId || null,
          serialNumber: newSerial.trim() || null,
          warrantyMonths: newMonths,
          type: newType,
          terms: newTerms.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue warranty");

      toast.success(`Warranty ${data.warranty.warrantyCode} registered successfully!`);
      setWarranties((prev) => [
        {
          id: data.warranty.id,
          code: data.warranty.warrantyCode,
          serialNumber: data.warranty.serialNumber,
          productName: data.warranty.product?.name || "Product",
          productId: data.warranty.productId,
          customerName: data.warranty.customer?.name || null,
          customerPhone: data.warranty.customer?.phone || null,
          customerId: data.warranty.customerId,
          purchaseDate: data.warranty.purchaseDate,
          startDate: data.warranty.startDate,
          endDate: data.warranty.endDate,
          warrantyMonths: data.warranty.warrantyMonths,
          type: data.warranty.type,
          status: data.warranty.status,
          terms: data.warranty.terms,
          claimsCount: 0,
        },
        ...prev,
      ]);
      setNewModalOpen(false);
      setNewSerial("");
      setNewTerms("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingNew(false);
    }
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimWarranty || !problem.trim()) return;

    setSubmittingClaim(true);
    try {
      const res = await fetch("/api/warranties/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warrantyId: claimWarranty.id,
          problem: problem.trim(),
          description: claimDesc.trim() || null,
          contactPhone: claimWarranty.customerPhone || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit claim");

      toast.success(`Claim ${data.claim.claimNumber} filed successfully!`);
      setWarranties((prev) =>
        prev.map((w) =>
          w.id === claimWarranty.id
            ? { ...w, status: "CLAIMED", claimsCount: w.claimsCount + 1 }
            : w
        )
      );
      setClaimWarranty(null);
      setProblem("");
      setClaimDesc("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const copyVerifyLink = (code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/verify-warranty?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    toast.success("Verification link copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warranty Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Digital warranty certificates, QR mobile verification, and claim lifecycles.
          </p>
        </div>

        <button
          onClick={() => setNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Issue Warranty Card
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total Warranties
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono">{stats.total}</span>
            <span className="rounded-full bg-blue-500/10 p-1.5 text-blue-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Active Coverage
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-600">
              {stats.active}
            </span>
            <span className="rounded-full bg-emerald-500/10 p-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Expiring Soon (&le;30d)
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-600">
              {stats.expiringSoon}
            </span>
            <span className="rounded-full bg-amber-500/10 p-1.5 text-amber-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Claims Filed
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-purple-600">
              {stats.claimed}
            </span>
            <span className="rounded-full bg-purple-500/10 p-1.5 text-purple-600">
              <Wrench className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "CLAIMED"].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedStatus === status
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground"
              }`}
            >
              {status.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by warranty code, serial / IMEI, product, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Warranties Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Warranty Code</th>
                <th className="px-4 py-3">Product & Serial #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Purchase Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3 text-center">Coverage</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No warranty records found</p>
                    <p className="text-xs">
                      Try adjusting your filters or issue a new warranty certificate.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((w) => {
                  const end = new Date(w.endDate);
                  const daysLeft = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysLeft <= 0;

                  return (
                    <tr
                      key={w.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                        <button
                          onClick={() => setActiveWarranty(w)}
                          className="hover:underline text-primary flex items-center gap-1.5"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          {w.code}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{w.productName}</div>
                        {w.serialNumber && (
                          <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            SN: {w.serialNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {w.customerName ? (
                          <div>
                            <span className="font-medium text-foreground">{w.customerName}</span>
                            {w.customerPhone && (
                              <span className="text-[11px] text-muted-foreground block">
                                {w.customerPhone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Walk-in Customer</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {formatDate(w.purchaseDate)}
                      </td>
                      <td className="px-4 py-3.5 font-mono">
                        <span className={isExpired ? "text-rose-600 font-semibold" : "text-foreground font-medium"}>
                          {formatDate(w.endDate)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {isExpired ? "Expired" : `${daysLeft} days left`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">
                          {w.warrantyMonths} Mo ({w.type})
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isExpired ? (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-500/20">
                            Expired
                          </span>
                        ) : w.status === "CLAIMED" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                            Claimed ({w.claimsCount})
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveWarranty(w)}
                            className="rounded-lg border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="View Digital Certificate"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </button>
                          {!isExpired && (
                            <button
                              onClick={() => setClaimWarranty(w)}
                              className="inline-flex items-center gap-1 rounded-lg border bg-primary/10 border-primary/20 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                              title="File Service Claim"
                            >
                              <Wrench className="h-3 w-3" /> Claim
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Certificate Modal */}
      {activeWarranty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border bg-card p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              onClick={() => setActiveWarranty(null)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Certificate Branding Header */}
            <div className="text-center space-y-1 pb-4 border-b">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary mb-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Digital Warranty Certificate
              </div>
              <h2 className="text-xl font-bold font-mono text-foreground">
                {activeWarranty.code}
              </h2>
              <p className="text-xs text-muted-foreground">
                Official Authenticity & Service Guarantee Record
              </p>
            </div>

            {/* QR Code & Device Snapshot */}
            <div className="flex flex-col sm:flex-row items-center gap-6 bg-muted/40 p-5 rounded-2xl border">
              {qrDataUrl && (
                <div className="p-2 bg-white rounded-xl shadow-sm border shrink-0">
                  <img
                    src={qrDataUrl}
                    alt={`QR for ${activeWarranty.code}`}
                    className="w-32 h-32"
                  />
                  <span className="text-[9px] text-center block text-slate-500 font-mono mt-1">
                    Scan to Verify
                  </span>
                </div>
              )}

              <div className="space-y-2 text-xs flex-1">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                    Product
                  </span>
                  <span className="font-bold text-foreground text-sm">
                    {activeWarranty.productName}
                  </span>
                </div>

                {activeWarranty.serialNumber && (
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                      Serial / IMEI
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {activeWarranty.serialNumber}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                    Coverage Duration
                  </span>
                  <span className="font-medium">
                    {activeWarranty.warrantyMonths} Months ({activeWarranty.type})
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold block">
                    Valid Until
                  </span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatDate(activeWarranty.endDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Coverage Terms */}
            {activeWarranty.terms && (
              <div className="rounded-xl border bg-background/50 p-3 text-xs space-y-1">
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                  Coverage Policy & Return Terms
                </span>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  {activeWarranty.terms}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => copyVerifyLink(activeWarranty.code)}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <Copy className="h-3.5 w-3.5" /> Copy Verification Link
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
              >
                <Printer className="h-3.5 w-3.5" /> Print Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Submission Modal */}
      {claimWarranty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setClaimWarranty(null)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">File Warranty Service Claim</h2>
                <p className="text-xs text-muted-foreground">
                  Issue intake for {claimWarranty.productName} ({claimWarranty.code})
                </p>
              </div>
            </div>

            <form onSubmit={handleFileClaim} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Reported Malfunction / Issue *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Battery drains rapidly, display touch unresponsive"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Detailed Symptoms & Inspection Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Customer description, diagnostic observations..."
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setClaimWarranty(null)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim || !problem.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {submittingClaim ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Warranty Registration Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setNewModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Issue Digital Warranty Card</h2>
                <p className="text-xs text-muted-foreground">
                  Register coverage for a product with serial / IMEI tracking.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateWarranty} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Product Covered *
                </label>
                <select
                  value={newProductId}
                  onChange={(e) => {
                    setNewProductId(e.target.value);
                    const p = products.find((pr) => pr.id === e.target.value);
                    if (p?.warrantyMonths) setNewMonths(p.warrantyMonths);
                  }}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Serial Number / Device IMEI
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-88991244 or 354891029481921"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Customer (Optional)
                  </label>
                  <select
                    value={newCustomerId}
                    onChange={(e) => setNewCustomerId(e.target.value)}
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
                    Warranty Duration (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newMonths}
                    onChange={(e) => setNewMonths(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Warranty Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="SELLER">Seller Warranty</option>
                  <option value="MANUFACTURER">Manufacturer Warranty</option>
                  <option value="SERVICE">Service Only Warranty</option>
                  <option value="EXTENDED">Extended Protection Plan</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Warranty Terms & Policy Conditions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Covers manufacturing hardware defects. Excludes liquid and accidental physical damage."
                  value={newTerms}
                  onChange={(e) => setNewTerms(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {submittingNew ? "Issuing..." : "Issue Warranty Certificate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
