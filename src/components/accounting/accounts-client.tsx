"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  BookOpen,
  Building2,
  Check,
  X,
  CreditCard,
  Lock,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export interface SerializedAccount {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "COGS";
  description?: string | null;
  balance: number;
  isSystem: boolean;
  isBankAccount: boolean;
  bankName?: string | null;
  accountNumber?: string | null;
  parentId?: string | null;
  parent?: { id: string; code: string; name: string } | null;
}

const TYPE_CONFIG = {
  ASSET: { label: "Assets", badge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  LIABILITY: { label: "Liabilities", badge: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  EQUITY: { label: "Equity", badge: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  REVENUE: { label: "Revenue", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  COGS: { label: "Cost of Sales", badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  EXPENSE: { label: "Expenses", badge: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

export function AccountsClient({
  initialAccounts,
}: {
  initialAccounts: SerializedAccount[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SerializedAccount[]>(initialAccounts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);

  // Form State for new account
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<
    "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "COGS"
  >("ASSET");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [isBankAccount, setIsBankAccount] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filtered accounts
  const filtered = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.description &&
          acc.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = selectedType === "ALL" || acc.type === selectedType;
      return matchSearch && matchType;
    });
  }, [accounts, searchTerm, selectedType]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Code and Name are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          type,
          parentId: parentId || null,
          description: description.trim() || null,
          isBankAccount,
          bankName: isBankAccount ? bankName.trim() || null : null,
          accountNumber: isBankAccount ? accountNumber.trim() || null : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");

      toast.success(`Account ${data.account.code} - ${data.account.name} created!`);
      setAccounts((prev) => [...prev, { ...data.account, balance: 0 }]);
      setModalOpen(false);

      // Reset form
      setCode("");
      setName("");
      setDescription("");
      setParentId("");
      setIsBankAccount(false);
      setBankName("");
      setAccountNumber("");
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
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            General Ledger hierarchy, balance sheet categories, and real-time ledger balances.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Add Account
        </button>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedType("ALL")}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedType === "ALL"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 hover:bg-muted text-muted-foreground"
            }`}
          >
            All Accounts ({accounts.length})
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const count = accounts.filter((a) => a.type === key).length;
            const isSelected = selectedType === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedType(key)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 hover:bg-muted text-muted-foreground"
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search accounts by code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Accounts Ledger Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Account Name</th>
                <th className="px-4 py-3">Class / Type</th>
                <th className="px-4 py-3">Parent Account</th>
                <th className="px-4 py-3 text-right">Current Balance (LKR)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No accounts found</p>
                    <p className="text-xs">Try adjusting your search criteria.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((acc) => {
                  const cfg = TYPE_CONFIG[acc.type] || {
                    label: acc.type,
                    badge: "bg-muted text-muted-foreground",
                  };
                  return (
                    <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {acc.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{acc.name}</span>
                          {acc.isBankAccount && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                              <CreditCard className="h-2.5 w-2.5" /> Bank
                            </span>
                          )}
                        </div>
                        {acc.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {acc.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                        {acc.parent ? `${acc.parent.code} - ${acc.parent.name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {formatCurrency(acc.balance)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {acc.isSystem ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            title="System account protected against deletion"
                          >
                            <Lock className="h-2.5 w-2.5" /> System
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            Custom
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-5">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">New Ledger Account</h2>
                <p className="text-xs text-muted-foreground">
                  Define an account code, classification type, and optional bank mapping.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Account Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1150 or 6500"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    Account Classification *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ASSET">Asset (1000s)</option>
                    <option value="LIABILITY">Liability (2000s)</option>
                    <option value="EQUITY">Equity (3000s)</option>
                    <option value="REVENUE">Revenue (4000s)</option>
                    <option value="COGS">Cost of Sales (5000s)</option>
                    <option value="EXPENSE">Expense (6000s)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Account Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Bank - Main Account"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Parent Account (Optional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">None (Top Level)</option>
                  {accounts
                    .filter((a) => a.type === type)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>

              {type === "ASSET" && (
                <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBankAccount}
                      onChange={(e) => setIsBankAccount(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-semibold text-foreground">
                      This is a Bank / Card Settlement Account
                    </span>
                  </label>

                  {isBankAccount && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                      <div>
                        <label className="text-[11px] text-muted-foreground">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Commercial Bank"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground">
                          Account Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1000294821"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="mt-1 w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Description / Remarks
                </label>
                <input
                  type="text"
                  placeholder="Optional explanatory notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
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
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {submitting ? "Saving..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
