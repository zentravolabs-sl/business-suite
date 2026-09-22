"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface SerializedJournalLine {
  id: string;
  debitAccountId?: string | null;
  debitAccount?: { id: string; code: string; name: string; type: string } | null;
  creditAccountId?: string | null;
  creditAccount?: { id: string; code: string; name: string; type: string } | null;
  amount: number;
  description?: string | null;
}

export interface SerializedJournalEntry {
  id: string;
  entryNumber: string;
  description: string;
  reference?: string | null;
  referenceType?: string | null;
  isPosted: boolean;
  postedAt: string;
  lines: SerializedJournalLine[];
}

interface FormLine {
  type: "DEBIT" | "CREDIT";
  accountId: string;
  amount: number;
  description: string;
}

export function JournalClient({
  initialEntries,
  accounts,
}: {
  initialEntries: SerializedJournalEntry[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<SerializedJournalEntry[]>(initialEntries);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);

  // New Journal Entry Form State
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [postedAt, setPostedAt] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<FormLine[]>([
    { type: "DEBIT", accountId: accounts[0]?.id || "", amount: 0, description: "" },
    { type: "CREDIT", accountId: accounts[1]?.id || "", amount: 0, description: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal
  const [activeEntry, setActiveEntry] = useState<SerializedJournalEntry | null>(null);

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch =
        e.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.reference && e.reference.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType =
        selectedType === "ALL" || e.referenceType === selectedType;

      return matchSearch && matchType;
    });
  }, [entries, searchTerm, selectedType]);

  // Form Debits & Credits Balancer
  const totalDebits = lines
    .filter((l) => l.type === "DEBIT")
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const totalCredits = lines
    .filter((l) => l.type === "CREDIT")
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const diff = Math.abs(totalDebits - totalCredits);
  const isBalanced = diff < 0.01 && totalDebits > 0;

  const addLine = (type: "DEBIT" | "CREDIT") => {
    setLines((prev) => [
      ...prev,
      { type, accountId: accounts[0]?.id || "", amount: 0, description: "" },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) {
      toast.error("A journal entry requires at least two lines");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }
    if (!isBalanced) {
      toast.error(`Out of balance by ${formatCurrency(diff)}. Debits must equal Credits.`);
      return;
    }

    setSubmitting(true);
    try {
      const formattedLines = lines.map((l) => ({
        debitAccountId: l.type === "DEBIT" ? l.accountId : null,
        creditAccountId: l.type === "CREDIT" ? l.accountId : null,
        amount: Number(l.amount),
        description: l.description.trim() || null,
      }));

      const res = await fetch("/api/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          reference: reference.trim() || null,
          postedAt,
          lines: formattedLines,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post journal entry");

      toast.success(`Journal Entry ${data.entry.entryNumber} posted successfully!`);
      setEntries((prev) => [data.entry, ...prev]);
      setModalOpen(false);

      // Reset
      setDescription("");
      setReference("");
      setLines([
        { type: "DEBIT", accountId: accounts[0]?.id || "", amount: 0, description: "" },
        { type: "CREDIT", accountId: accounts[1]?.id || "", amount: 0, description: "" },
      ]);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">General Journal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Double-entry ledger of all financial transactions with balancing validation.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> New Journal Entry
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "Sale", "Purchase", "Payment", "Manual"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedType === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground"
              }`}
            >
              {type === "ALL" ? "All Entries" : `${type}s`}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search journal by entry #, description, or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Journal Entries Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Entry #</th>
                <th className="px-4 py-3">Posted Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Debit / Credit Total</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No journal entries found</p>
                    <p className="text-xs">Try adjusting your search criteria or create a manual entry.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const entryTotal = entry.lines.reduce(
                    (sum, l) => sum + Number(l.amount),
                    0
                  );
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setActiveEntry(entry)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-primary group-hover:underline">
                        {entry.entryNumber}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {formatDate(entry.postedAt)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-foreground max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                          {entry.referenceType || "Manual"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-muted-foreground">
                        {entry.reference || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                        {formatCurrency(entryTotal)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Posted
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Detail Modal */}
      {activeEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setActiveEntry(null)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-mono">
                  {activeEntry.entryNumber}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Posted on {formatDate(activeEntry.postedAt)} • {activeEntry.referenceType || "Manual"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
              <div className="font-semibold text-foreground">{activeEntry.description}</div>
              {activeEntry.reference && (
                <div className="text-muted-foreground font-mono">
                  Ref: {activeEntry.reference}
                </div>
              )}
            </div>

            {/* Debits & Credits Breakdown Table */}
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-[10px] font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Debit (LKR)</th>
                    <th className="px-3 py-2 text-right">Credit (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeEntry.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2.5">
                        {l.debitAccount && (
                          <div>
                            <span className="font-bold">{l.debitAccount.code}</span> -{" "}
                            {l.debitAccount.name}
                          </div>
                        )}
                        {l.creditAccount && (
                          <div className="pl-4 text-muted-foreground">
                            To: <span className="font-bold">{l.creditAccount.code}</span> -{" "}
                            {l.creditAccount.name}
                          </div>
                        )}
                        {l.description && (
                          <div className="text-[10px] text-muted-foreground italic">
                            {l.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">
                        {l.debitAccountId ? formatCurrency(l.amount) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">
                        {l.creditAccountId ? formatCurrency(l.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setActiveEntry(null)}
                className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Manual Journal Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">New General Journal Entry</h2>
                <p className="text-xs text-muted-foreground">
                  Record manual adjustments or opening entries. Debits must equal Credits.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Description / Explanation *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Month-end depreciation or owner capital contribution"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Posted Date *
                  </label>
                  <input
                    type="date"
                    value={postedAt}
                    onChange={(e) => setPostedAt(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VOUCHER-0881 or BANK-REF"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Multi-Line Journal Ledger Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Journal Lines ({lines.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addLine("DEBIT")}
                      className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      + Add Debit Line
                    </button>
                    <button
                      type="button"
                      onClick={() => addLine("CREDIT")}
                      className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      + Add Credit Line
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border divide-y bg-background/50 overflow-hidden">
                  {lines.map((line, idx) => (
                    <div key={idx} className="p-3 grid gap-3 sm:grid-cols-12 items-center">
                      {/* Debit / Credit Switcher */}
                      <div className="sm:col-span-2">
                        <select
                          value={line.type}
                          onChange={(e) => {
                            const val = e.target.value as "DEBIT" | "CREDIT";
                            setLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, type: val } : l))
                            );
                          }}
                          className={`w-full rounded-lg border px-2 py-1.5 text-xs font-bold ${
                            line.type === "DEBIT"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          <option value="DEBIT">Debit (Dr)</option>
                          <option value="CREDIT">Credit (Cr)</option>
                        </select>
                      </div>

                      {/* Account Selector */}
                      <div className="sm:col-span-5">
                        <select
                          value={line.accountId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, accountId: val } : l
                              )
                            );
                          }}
                          className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Line Amount */}
                      <div className="sm:col-span-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount (LKR)"
                          value={line.amount || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, amount: val } : l
                              )
                            );
                          }}
                          className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-mono font-bold"
                          required
                        />
                      </div>

                      {/* Remove Line */}
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length <= 2}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balancer Widget */}
              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                      Total Debits
                    </span>
                    <span className="font-mono text-sm font-bold text-blue-600">
                      {formatCurrency(totalDebits)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                      Total Credits
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-600">
                      {formatCurrency(totalCredits)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                      Difference
                    </span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        isBalanced ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatCurrency(diff)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-xs">
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> Double-entry equation in balance
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                      <AlertCircle className="h-4 w-4" /> Journal is out of balance by{" "}
                      {formatCurrency(diff)}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isBalanced}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {submitting ? "Posting..." : "Post Journal Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
