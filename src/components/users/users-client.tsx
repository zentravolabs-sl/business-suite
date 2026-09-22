"use client";

import { useState } from "react";
import {
  Plus, Search, UserCog, MoreHorizontal, Edit2, Trash2,
  CheckCircle, XCircle, Shield, GitBranch, Crown, UserX, UserCheck,
  Mail, Phone, Clock, Key,
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
import { cn, formatDate } from "@/lib/utils";

interface StaffUser {
  id: string;
  userBusinessId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  isOwner: boolean;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
  branchId: string | null;
  branchName: string | null;
  lastLoginAt: string | null;
  joinedAt: string;
}

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
}

interface Branch {
  id: string;
  name: string;
}

interface UsersClientProps {
  initialUsers: StaffUser[];
  roles: Role[];
  branches: Branch[];
}

const DEFAULT_ROLES = [
  { key: "OWNER", label: "Owner", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "MANAGER", label: "Manager", color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "ACCOUNTANT", label: "Accountant", color: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "CASHIER", label: "Cashier", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { key: "STOCK_MANAGER", label: "Stock Manager", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { key: "TECHNICIAN", label: "Technician", color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
];

export function UsersClient({ initialUsers, roles, branches }: UsersClientProps) {
  const [users, setUsers] = useState<StaffUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleId: roles[0]?.id || "",
    branchId: branches[0]?.id || "",
  });

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.roleName || "").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", phone: "", password: "", roleId: roles[0]?.id || "", branchId: branches[0]?.id || "" });
    setShowAddModal(true);
  };

  const openEdit = (user: StaffUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      roleId: user.roleId || roles[0]?.id || "",
      branchId: user.branchId || branches[0]?.id || "",
    });
    setShowAddModal(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editingUser) {
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userBusinessId: editingUser.userBusinessId,
            roleId: form.roleId || null,
            branchId: form.branchId || null,
            name: form.name,
          }),
        });
        if (!res.ok) throw new Error("Failed to update user");
        const role = roles.find((r) => r.id === form.roleId);
        const branch = branches.find((b) => b.id === form.branchId);
        setUsers((prev) =>
          prev.map((u) =>
            u.userBusinessId === editingUser.userBusinessId
              ? { ...u, name: form.name, roleId: form.roleId, roleName: role?.name || null, branchId: form.branchId, branchName: branch?.name || null }
              : u
          )
        );
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email || null,
            phone: form.phone || null,
            password: form.password || undefined,
            roleId: form.roleId || null,
            branchId: form.branchId || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create user");
        setUsers((prev) => [data.user, ...prev]);
      }
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userBusinessId: user.userBusinessId, isActive: !user.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUsers((prev) => prev.map((u) => u.userBusinessId === user.userBusinessId ? { ...u, isActive: !u.isActive } : u));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (user: StaffUser) => {
    if (user.isOwner) return alert("Cannot remove the business owner");
    if (!confirm(`Remove ${user.name} from this business?`)) return;
    try {
      const res = await fetch(`/api/users?userBusinessId=${user.userBusinessId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove user");
      setUsers((prev) => prev.filter((u) => u.userBusinessId !== user.userBusinessId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff, roles, and branch assignments for your business
          </p>
        </div>
        <Button onClick={openAdd} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
          <Plus className="h-4 w-4 mr-1.5" />
          Invite Staff
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-extrabold mt-1">{users.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</p>
          <p className="text-2xl font-extrabold mt-1 text-emerald-600">{users.filter((u) => u.isActive).length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inactive</p>
          <p className="text-2xl font-extrabold mt-1 text-amber-600">{users.filter((u) => !u.isActive).length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles Assigned</p>
          <p className="text-2xl font-extrabold mt-1">{users.filter((u) => u.roleId).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <UserCog className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No staff members found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try a different search" : "Invite your first team member"}
            </p>
            {!search && <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Invite Staff</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Staff Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Last Active</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user) => (
                  <tr key={user.userBusinessId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold flex items-center gap-1.5">
                            {user.name}
                            {user.isOwner && (
                              <Crown className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.email || user.phone || "No contact info"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.isOwner ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 border">
                          <Crown className="h-3 w-3 mr-1" />
                          Owner
                        </Badge>
                      ) : user.roleName ? (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {user.roleName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No role</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {user.branchName ? (
                        <span className="flex items-center gap-1 text-xs">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          {user.branchName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">All branches</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-muted-foreground">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        user.isActive
                          ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                          : "text-slate-600 bg-slate-50 border-slate-200"
                      )}>
                        {user.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Role & Branch
                          </DropdownMenuItem>
                          {!user.isOwner && (
                            <>
                              <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                {user.isActive ? (
                                  <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                                ) : (
                                  <><UserCheck className="h-4 w-4 mr-2" />Activate</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(user)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove from Business
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? `Edit ${editingUser.name}` : "Invite New Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Full Name *</label>
              <Input
                placeholder="e.g. Kasun Perera"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            {!editingUser && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email Address</label>
                  <Input
                    type="email"
                    placeholder="kasun@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
                  <Input
                    placeholder="+94 71 234 5678"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5" />
                    Temporary Password
                  </label>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to auto-generate</p>
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Role
              </label>
              <select
                value={form.roleId}
                onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No role assigned</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {branches.length > 1 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  Assigned Branch
                </label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading || !form.name}>
              {loading ? "Saving..." : editingUser ? "Update Staff" : "Invite Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
