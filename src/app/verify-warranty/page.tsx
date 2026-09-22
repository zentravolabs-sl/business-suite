"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  Mail,
  MapPin,
  QrCode,
  Package,
  Wrench,
  X,
  Check,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface VerifiedWarranty {
  id: string;
  code: string;
  serialNumber?: string | null;
  productName: string;
  productSku?: string | null;
  productImage?: string | null;
  customerName: string;
  purchaseDate: string;
  startDate: string;
  endDate: string;
  warrantyMonths: number;
  type: string;
  status: string;
  terms?: string | null;
  totalDays: number;
  daysRemaining: number;
  isExpired: boolean;
  businessName: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessAddress?: string | null;
}

function VerifyWarrantyContent() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [inputCode, setInputCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [warranty, setWarranty] = useState<VerifiedWarranty | null>(null);
  const [searched, setSearched] = useState(false);

  // Claim Modal
  const [claimOpen, setClaimOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const fetchWarranty = async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/warranties/verify?code=${encodeURIComponent(codeToSearch.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setWarranty(null);
        toast.error(data.error || "Warranty certificate not found");
      } else {
        setWarranty(data.warranty);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify warranty");
      setWarranty(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      fetchWarranty(initialCode);
    }
  }, [initialCode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWarranty(inputCode);
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warranty || !problem.trim()) return;

    setSubmittingClaim(true);
    try {
      const res = await fetch("/api/warranties/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warrantyId: warranty.id,
          problem: problem.trim(),
          description: description.trim() || null,
          contactPhone: contactPhone.trim() || warranty.businessPhone || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim submission failed");

      toast.success(
        `Claim #${data.claim?.claimNumber || ""} submitted! The merchant will contact you shortly.`
      );
      setClaimOpen(false);
      setProblem("");
      setDescription("");
      // Refresh warranty status
      fetchWarranty(warranty.code);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const pctRemaining = warranty
    ? Math.min(100, Math.max(0, Math.round((warranty.daysRemaining / warranty.totalDays) * 100)))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Branding & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-bold text-primary mb-2">
            <ShieldCheck className="h-4 w-4" /> Official Digital Warranty Certificate
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Warranty Verification Portal
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Scan your QR code or enter your warranty card number or device IMEI to verify authenticity and coverage.
          </p>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Enter Warranty Code (WC-XXXXXX) or Serial / IMEI..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            className="w-full rounded-2xl border bg-card px-4 py-3.5 pl-11 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <button
            type="submit"
            disabled={loading || !inputCode.trim()}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Now"}
          </button>
        </form>

        {/* Warranty Certificate Card */}
        {warranty && (
          <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Certificate Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Issuer & Merchant
                </span>
                <h2 className="text-lg font-bold text-foreground">
                  {warranty.businessName}
                </h2>
                {warranty.businessAddress && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {warranty.businessAddress}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Warranty Certificate #
                </span>
                <span className="font-mono text-base font-bold text-primary block">
                  {warranty.code}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold mt-1 ${
                    warranty.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : warranty.status === "CLAIMED"
                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" /> {warranty.status}
                </span>
              </div>
            </div>

            {/* Product & Device Details */}
            <div className="rounded-2xl bg-muted/40 border p-4 space-y-3">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-background border p-3">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Product Covered
                  </span>
                  <h3 className="text-base font-bold text-foreground">
                    {warranty.productName}
                  </h3>
                  {warranty.serialNumber && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-foreground font-mono">
                      <span className="text-muted-foreground">Serial / IMEI:</span>
                      <strong className="bg-background px-2 py-0.5 rounded border">
                        {warranty.serialNumber}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coverage Timeline & Expiration Meter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground uppercase text-[11px] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Coverage Timeline
                </span>
                <span className="font-mono font-bold text-foreground">
                  {warranty.isExpired
                    ? "Warranty Expired"
                    : `${warranty.daysRemaining} days remaining`}
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    warranty.isExpired
                      ? "bg-rose-500"
                      : pctRemaining < 20
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${pctRemaining}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs pt-1 text-muted-foreground">
                <div>
                  <span className="block text-[10px] uppercase font-semibold">
                    Purchase Date
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {formatDate(warranty.purchaseDate)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-semibold">
                    Expires On
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {formatDate(warranty.endDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Coverage Terms */}
            {warranty.terms && (
              <div className="rounded-xl border bg-background/50 p-4 text-xs space-y-1">
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                  Coverage Policy & Conditions
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {warranty.terms}
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {warranty.businessPhone && (
                  <a
                    href={`tel:${warranty.businessPhone}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <Phone className="h-3 w-3" /> {warranty.businessPhone}
                  </a>
                )}
              </div>

              {!warranty.isExpired && (
                <button
                  type="button"
                  onClick={() => setClaimOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
                >
                  <Wrench className="h-4 w-4" /> Request Service / Claim
                </button>
              )}
            </div>
          </div>
        )}

        {/* Not Found state */}
        {!warranty && searched && !loading && (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <h3 className="font-bold text-base">Warranty Not Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              We couldn't find an active warranty certificate matching code "{inputCode}".
              Please double check the code printed on your receipt.
            </p>
          </div>
        )}

        {/* Claim Modal */}
        {claimOpen && warranty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
              <button
                onClick={() => setClaimOpen(false)}
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
                    Submit issue details for {warranty.productName} ({warranty.code})
                  </p>
                </div>
              </div>

              <form onSubmit={handleFileClaim} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Reported Issue / Malfunction *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Display flickering or device not charging"
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Detailed Symptoms / Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe when the issue occurs, any error messages, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Phone Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0771234567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t">
                  <button
                    type="button"
                    onClick={() => setClaimOpen(false)}
                    className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClaim}
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
      </div>
    </div>
  );
}

export default function VerifyWarrantyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <VerifyWarrantyContent />
    </Suspense>
  );
}
