"use client";

import { useState, useCallback } from "react";
import {
  Plus, Search, Filter, Download, DollarSign, TrendingDown,
  MoreHorizontal, Edit2, Trash2, CheckCircle, Clock, XCircle,
  Receipt, Tag, Calendar, Building2, CreditCard, Banknote,
  FileText, AlertTriangle, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface Expense {
  id: string;
  description: string;
  amount: number;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  branchId: string | null;
  branchName: string | null;
  addedBy: string | null;
  method: string;
  reference: string | null;
  receipt: string | null;
  notes: string | null;
  status: string;
  expenseDate: string;
  createdAt: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isSystem: boolean;
}

interface Branch {
  id: string;
  name: string;
}

interface ExpensesClientProps {
  initialExpenses: Expense[];
  categories: ExpenseCategory[];
  branches: Branch[];
  totalAmount: number;
}

const STATUS_CONFIG = {
  PAID: { label: "Paid", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle },
  APPROVED: { label: "Approved", color: "text-blue-600 bg-blue-50 border-blue-200", icon: CheckCircle },
  PENDING: { label: "Pending", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
  REJECTED: { label: "Rejected", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle },
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2 },
  { value: "CHEQUE", label: "Cheque", icon: FileText },
  { value: "QR_CODE", label: "QR Code", icon: Receipt },
];

const DEFAULT_CATEGORIES = [
  { name: "Rent", color: "#f59e0b" },
  { name: "Electricity", color: "#3b82f6" },
  { name: "Water", color: "#06b6d4" },
  { name: "Internet", color: "#8b5cf6" },
  { name: "Salary", color: "#10b981" },
  { name: "Transport", color: "#f97316" },
  { name: "Marketing", color: "#ec4899" },
  { name: "Maintenance", color: "#6366f1" },
  { name: "Other", color: "#94a3b8" },
];

export function ExpensesClient({
  initialExpenses,
  categories: initialCategories,
  branches,
  totalAmount: initialTotalAmount,
}: ExpensesClientProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [totalAmount, setTotalAmount] = useState(initialTotalAmount);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    description: "",
    amount: "",
    categoryId: "",
    branchId: branches[0]?.id || "",
    method: "CASH",
    reference: "",
    notes: "",
    expenseDate: new Date().toISOString().split("T")[0],
    status: "PAID",
  });

  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");

  const filtered = expenses.filter((e) => {
    const matchSearch =
      !search ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.categoryName || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || e.categoryId === filterCategory;
    const matchStatus = !filterStatus || e.status === filterStatus;
    const matchBranch = !filterBranch || e.branchId === filterBranch;
    return matchSearch && matchCat && matchStatus && matchBranch;
  });

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amount, 0);

  const openAdd = () => {
    setEditingExpense(null);
    setForm({
      description: "",
      amount: "",
      categoryId: categories[0]?.id || "",
      branchId: branches[0]?.id || "",
      method: "CASH",
      reference: "",
      notes: "",
      expenseDate: new Date().toISOString().split("T")[0],
      status: "PAID",
    });
    setShowAddModal(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      categoryId: expense.categoryId || "",
      branchId: expense.branchId || branches[0]?.id || "",
      method: expense.method,
      reference: expense.reference || "",
      notes: expense.notes || "",
      expenseDate: expense.expenseDate.split("T")[0],
      status: expense.status,
    });
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    try {
      const payload = {
        description: form.description,
        amount: parseFloat(form.amount),
        categoryId: form.categoryId || null,
        branchId: form.branchId || null,
        method: form.method,
        reference: form.reference || null,
        notes: form.notes || null,
        expenseDate: form.expenseDate,
        status: form.status,
      };

      if (editingExpense) {
        const res = await fetch("/api/expenses", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingExpense.id, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setExpenses((prev) =>
          prev.map((e) => {
            if (e.id !== editingExpense.id) return e;
            const cat = categories.find((c) => c.id === payload.categoryId);
            const branch = branches.find((b) => b.id === payload.branchId);
            return {
              ...e,
              ...payload,
              categoryName: cat?.name || "Uncategorized",
              categoryColor: cat?.color || "#6366f1",
              branchName: branch?.name || null,
            };
          })
        );
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const cat = categories.find((c) => c.id === payload.categoryId);
        const branch = branches.find((b) => b.id === payload.branchId);
        const newExp: Expense = {
          id: data.expense.id,
          description: payload.description,
          amount: payload.amount,
          categoryId: payload.categoryId,
          categoryName: cat?.name || "Uncategorized",
          categoryColor: cat?.color || "#6366f1",
          branchId: payload.branchId,
          branchName: branch?.name || null,
          addedBy: null,
          method: payload.method,
          reference: payload.reference,
          receipt: null,
          notes: payload.notes,
          status: payload.status,
          expenseDate: new Date(payload.expenseDate).toISOString(),
          createdAt: new Date().toISOString(),
        };
        setExpenses((prev) => [newExp, ...prev]);
        setTotalAmount((prev) => prev + payload.amount);
      }
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      const expense = expenses.find((e) => e.id === id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      if (expense) setTotalAmount((prev) => prev - expense.amount);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", name: newCatName, color: newCatColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCategories((prev) => [...prev, { ...data.category, isSystem: false }]);
      setNewCatName("");
      setShowCategoryModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Group by category for summary
  const byCat = categories.map((cat) => ({
    name: cat.name,
    color: cat.color || "#6366f1",
    total: filtered.filter((e) => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
    count: filtered.filter((e) => e.categoryId === cat.id).length,
  })).filter((c) => c.count > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expense Management</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage all business expenses across branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategoryModal(true)}>
            <Tag className="h-4 w-4 mr-1.5" />
            Categories
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-red-600">{formatCurrency(filteredTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{filtered.length} expense records</p>
        </div>
        {byCat.slice(0, 3).map((cat) => (
          <div key={cat.name} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.name}</span>
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
            </div>
            <div className="text-2xl font-extrabold">{formatCurrency(cat.total)}</div>
            <p className="text-xs text-muted-foreground mt-1">{cat.count} expense{cat.count !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {branches.length > 1 && (
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No expenses found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try a different search term" : "Start by adding your first expense"}
            </p>
            {!search && (
              <Button onClick={openAdd} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Expense
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((expense) => {
                  const statusCfg = STATUS_CONFIG[expense.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={expense.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium">{expense.description}</div>
                        {expense.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-48">{expense.notes}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: expense.categoryColor }}
                          />
                          <span className="text-xs font-medium">{expense.categoryName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-red-600">{formatCurrency(expense.amount)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-muted-foreground">{expense.method.replace("_", " ")}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-muted-foreground">{expense.branchName || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", statusCfg.color)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(expense)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(expense.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={2} className="px-5 py-3 text-sm font-semibold">
                    Total ({filtered.length} records)
                  </td>
                  <td className="px-5 py-3 font-bold text-red-600">{formatCurrency(filteredTotal)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description *</label>
              <Input
                placeholder="e.g. Monthly rent payment"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount (Rs.) *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                <select
                  value={form.method}
                  onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {branches.length > 1 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Branch</label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reference / Receipt No.</label>
              <Input
                placeholder="e.g. RCP-001"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <textarea
                placeholder="Additional notes..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading || !form.description || !form.amount}>
              {loading ? "Saving..." : editingExpense ? "Update Expense" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Expense Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || "#6366f1" }} />
                  <span className="text-sm font-medium flex-1">{cat.name}</span>
                  {cat.isSystem && <Badge variant="outline" className="text-xs">System</Badge>}
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Add New Category</p>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={(e) => setNewCatColor(e.target.value)}
                  className="h-10 w-10 rounded-md border cursor-pointer"
                />
                <Input
                  placeholder="Category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddCategory} disabled={!newCatName.trim()}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DEFAULT_CATEGORIES.map((dc) => (
                  <button
                    key={dc.name}
                    onClick={() => setNewCatName(dc.name)}
                    className="text-xs rounded-full border px-2 py-0.5 hover:bg-muted transition-colors"
                  >
                    {dc.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
