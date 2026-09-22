"use client";

import { useState } from "react";
import {
  Plus, GitBranch, MoreHorizontal, Edit2, Trash2,
  MapPin, Phone, Mail, Users, Package, TrendingUp,
  Crown, Building2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  managerId: string | null;
  openingCash: number;
  isHeadOffice: boolean;
  isActive: boolean;
  monthlySales?: number;
  monthlyTransactions?: number;
  stockItems?: number;
  staffCount?: number;
}

interface Manager {
  id: string;
  name: string;
}

interface BranchesClientProps {
  initialBranches: Branch[];
  managers: Manager[];
}

export function BranchesClient({ initialBranches, managers }: BranchesClientProps) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    managerId: "",
    openingCash: "0",
    isHeadOffice: false,
  });

  const openAdd = () => {
    setEditingBranch(null);
    setForm({ name: "", code: "", address: "", city: "", phone: "", email: "", managerId: managers[0]?.id || "", openingCash: "0", isHeadOffice: false });
    setShowModal(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code || "",
      address: branch.address || "",
      city: branch.city || "",
      phone: branch.phone || "",
      email: branch.email || "",
      managerId: branch.managerId || "",
      openingCash: String(branch.openingCash),
      isHeadOffice: branch.isHeadOffice,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        address: form.address || null,
        city: form.city || null,
        phone: form.phone || null,
        email: form.email || null,
        managerId: form.managerId || null,
        openingCash: parseFloat(form.openingCash) || 0,
        isHeadOffice: form.isHeadOffice,
      };

      if (editingBranch) {
        const res = await fetch("/api/branches", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingBranch.id, ...payload }),
        });
        if (!res.ok) throw new Error("Failed to update");
        setBranches((prev) => prev.map((b) => b.id === editingBranch.id ? { ...b, ...payload } : b));
      } else {
        const res = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setBranches((prev) => [...prev, { ...data.branch, openingCash: Number(data.branch.openingCash) }]);
      }
      setShowModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    if (branch.isHeadOffice) return;
    try {
      const res = await fetch("/api/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: branch.id, isActive: !branch.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      setBranches((prev) => prev.map((b) => b.id === branch.id ? { ...b, isActive: !b.isActive } : b));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (branch.isHeadOffice) return alert("Cannot deactivate the head office branch.");
    if (!confirm(`Deactivate branch "${branch.name}"?`)) return;
    try {
      const res = await fetch(`/api/branches?id=${branch.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setBranches((prev) => prev.map((b) => b.id === branch.id ? { ...b, isActive: false } : b));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branch Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage all business locations, staff, and branch-level performance
          </p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-violet-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Branch
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Branches</p>
          <p className="text-2xl font-extrabold mt-1">{branches.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</p>
          <p className="text-2xl font-extrabold mt-1 text-emerald-600">{branches.filter((b) => b.isActive).length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total This Month</p>
          <p className="text-2xl font-extrabold mt-1">{formatCurrency(branches.reduce((s, b) => s + (b.monthlySales || 0), 0))}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-extrabold mt-1">{branches.reduce((s, b) => s + (b.staffCount || 0), 0)}</p>
        </div>
      </div>

      {/* Branch Cards */}
      {branches.length === 0 ? (
        <div className="rounded-2xl border bg-card p-16 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No branches yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your first branch location</p>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Add Branch</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const manager = managers.find((m) => m.id === branch.managerId);
            return (
              <div
                key={branch.id}
                className={cn(
                  "rounded-2xl border bg-card shadow-sm overflow-hidden transition-all",
                  !branch.isActive && "opacity-60"
                )}
              >
                {/* Branch Header */}
                <div className="p-5 border-b bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {branch.code?.substring(0, 2) || branch.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base">{branch.name}</h3>
                          {branch.isHeadOffice && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 border text-[10px]">
                              <Crown className="h-2.5 w-2.5 mr-0.5" />HQ
                            </Badge>
                          )}
                        </div>
                        {branch.code && (
                          <p className="text-xs text-muted-foreground font-mono">{branch.code}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(branch)}>
                          <Edit2 className="h-4 w-4 mr-2" />Edit Branch
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(branch)} disabled={branch.isHeadOffice}>
                          {branch.isActive ? (
                            <><ToggleLeft className="h-4 w-4 mr-2" />Deactivate</>
                          ) : (
                            <><ToggleRight className="h-4 w-4 mr-2" />Activate</>
                          )}
                        </DropdownMenuItem>
                        {!branch.isHeadOffice && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(branch)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />Remove Branch
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Branch Details */}
                <div className="p-5 space-y-3">
                  {branch.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{branch.address}{branch.city ? `, ${branch.city}` : ""}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{branch.phone}</span>
                    </div>
                  )}
                  {manager && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Manager: <span className="font-medium text-foreground">{manager.name}</span></span>
                    </div>
                  )}
                </div>

                {/* Branch Stats */}
                <div className="grid grid-cols-3 border-t divide-x">
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sales</p>
                    <p className="font-bold text-sm mt-0.5">{formatCurrency(branch.monthlySales || 0)}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Products</p>
                    <p className="font-bold text-sm mt-0.5">{branch.stockItems || 0}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Staff</p>
                    <p className="font-bold text-sm mt-0.5">{branch.staffCount || 0}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "Edit Branch" : "Add New Branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Branch Name *</label>
                <Input
                  placeholder="e.g. Colombo Branch"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Branch Code</label>
                <Input
                  placeholder="e.g. CMB"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Address</label>
              <Input
                placeholder="Street address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">City</label>
                <Input
                  placeholder="e.g. Colombo"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Phone</label>
                <Input
                  placeholder="+94 11 234 5678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Manager</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No manager assigned</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Opening Cash (Rs.)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.openingCash}
                  onChange={(e) => setForm((f) => ({ ...f, openingCash: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                id="isHQ"
                checked={form.isHeadOffice}
                onChange={(e) => setForm((f) => ({ ...f, isHeadOffice: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="isHQ" className="text-sm font-medium">
                This is the Head Office / Main Branch
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading || !form.name}>
              {loading ? "Saving..." : editingBranch ? "Update Branch" : "Add Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
