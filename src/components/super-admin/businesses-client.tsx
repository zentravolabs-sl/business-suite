"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Ban,
  MoreHorizontal,
  ExternalLink,
  Shield,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Edit2,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BusinessTenant {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED" | "ONBOARDING";
  email: string | null;
  phone: string | null;
  city: string | null;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  branchesCount: number;
  usersCount: number;
  productsCount: number;
  salesCount: number;
  customersCount: number;
  plan: string;
  planType: string;
  subscriptionStatus: string;
  createdAt: string;
}

export function BusinessesClient() {
  const [businesses, setBusinesses] = useState<BusinessTenant[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState<BusinessTenant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editStatus, setEditStatus] = useState<string>("ACTIVE");
  const [editPlanId, setEditPlanId] = useState<string>("");

  // Create business state
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    businessName: "",
    ownerEmail: "",
    ownerPassword: "",
    planId: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/businesses?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      if (res.ok) {
        const json = await res.json();
        setBusinesses(json.businesses || []);
        setPlans(json.plans || []);
      }
    } catch (err) {
      console.error("Failed to load businesses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBusinesses();
  };

  const openEditModal = (biz: BusinessTenant) => {
    setSelectedBiz(biz);
    setEditStatus(biz.status);
    const matchedPlan = plans.find((p) => p.name === biz.plan);
    setEditPlanId(matchedPlan ? matchedPlan.id : plans[0]?.id || "");
    setModalOpen(true);
  };

  const handleSaveBusiness = async () => {
    if (!selectedBiz) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/super-admin/businesses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedBiz.id,
          status: editStatus,
          planId: editPlanId || undefined,
        }),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchBusinesses();
      }
    } catch (err) {
      console.error("Failed to update business:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBusiness = async () => {
    setCreateError(null);
    if (!createForm.businessName.trim()) { setCreateError("Business name is required."); return; }
    if (!createForm.ownerEmail.trim()) { setCreateError("Owner email is required."); return; }
    if (createForm.ownerPassword.length < 6) { setCreateError("Password must be at least 6 characters."); return; }
    if (!createForm.planId) { setCreateError("Please select a plan."); return; }

    setCreateLoading(true);
    try {
      const res = await fetch("/api/super-admin/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create business.");
        return;
      }
      setCreateOpen(false);
      setCreateForm({ businessName: "", ownerEmail: "", ownerPassword: "", planId: "" });
      fetchBusinesses();
    } catch (err: any) {
      setCreateError(err.message || "Network error.");
    } finally {
      setCreateLoading(false);
    }
  };

  const activeCount = businesses.filter((b) => b.status === "ACTIVE").length;
  const trialCount = businesses.filter((b) => b.status === "TRIAL").length;
  const suspendedCount = businesses.filter((b) => b.status === "SUSPENDED").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Tenants & Businesses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor, provision, configure subscriptions, and manage tenant organizations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setCreateError(null);
              setCreateForm({ businessName: "", ownerEmail: "", ownerPassword: "", planId: plans[0]?.id || "" });
              setCreateOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Business
          </Button>
          <Button variant="outline" size="sm" onClick={fetchBusinesses} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Tenants</p>
            <p className="text-2xl font-black mt-1">{businesses.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Registered organizations</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Subscriptions</p>
            <p className="text-2xl font-black mt-1 text-emerald-600">{activeCount}</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Live & operating</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Free Trialists</p>
            <p className="text-2xl font-black mt-1 text-amber-600">{trialCount}</p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">In evaluation phase</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suspended</p>
            <p className="text-2xl font-black mt-1 text-red-600">{suspendedCount}</p>
            <p className="text-[11px] text-red-600 font-medium mt-0.5">Access restricted</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search business, owner, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["ALL", "ACTIVE", "TRIAL", "SUSPENDED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0",
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Businesses Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Business Name & Category</th>
                  <th className="px-4 py-3">Owner / Contact</th>
                  <th className="px-4 py-3">Subscription Tier</th>
                  <th className="px-4 py-3 text-center">Branches</th>
                  <th className="px-4 py-3 text-center">Staff</th>
                  <th className="px-4 py-3 text-center">Sales Vol</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      Loading businesses...
                    </td>
                  </tr>
                ) : businesses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No businesses found matching your filters.
                    </td>
                  </tr>
                ) : (
                  businesses.map((biz) => (
                    <tr key={biz.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-sm text-foreground">{biz.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                            {biz.category.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground font-mono">/{biz.slug}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-foreground">{biz.ownerName}</p>
                        <p className="text-muted-foreground text-[11px]">{biz.ownerPhone || biz.ownerEmail || "—"}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">{biz.plan}</div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-bold mt-0.5",
                            biz.subscriptionStatus === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}
                        >
                          {biz.subscriptionStatus}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-muted-foreground">
                        {biz.branchesCount}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-muted-foreground">
                        {biz.usersCount}
                      </td>

                      <td className="px-4 py-3.5 text-center font-semibold text-foreground">
                        {biz.salesCount} txns
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase",
                            biz.status === "ACTIVE" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                            biz.status === "TRIAL" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                            biz.status === "SUSPENDED" && "bg-red-500/10 text-red-600 border-red-500/20",
                            biz.status === "CANCELLED" && "bg-muted text-muted-foreground"
                          )}
                        >
                          {biz.status}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(biz)}
                          className="h-8 text-xs"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Tenant Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tenant: {selectedBiz?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Update operational status, plan tier, or tenant configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Tenant Operating Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
              >
                <option value="ACTIVE">ACTIVE (Full access)</option>
                <option value="TRIAL">TRIAL (Evaluation period)</option>
                <option value="SUSPENDED">SUSPENDED (Access locked)</option>
                <option value="CANCELLED">CANCELLED (Terminated)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Assigned Subscription Plan</label>
              <select
                value={editPlanId}
                onChange={(e) => setEditPlanId(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-xs"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Rs. {Number(p.monthlyPrice).toLocaleString()}/mo ({p.maxBranches} branches, {p.maxUsers} users)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveBusiness} disabled={actionLoading}>
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Business Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Create New Business
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provision a new tenant. The owner can log in and complete business setup from their dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Business Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Business Name *</label>
              <Input
                id="create-business-name"
                placeholder="e.g. Apex Electronics, Lanka Super Store"
                value={createForm.businessName}
                onChange={(e) => setCreateForm((f) => ({ ...f, businessName: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Owner Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Owner Email / Username *</label>
              <Input
                id="create-owner-email"
                type="email"
                placeholder="owner@business.lk"
                value={createForm.ownerEmail}
                onChange={(e) => setCreateForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Owner Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Initial Password *</label>
              <div className="relative">
                <Input
                  id="create-owner-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={createForm.ownerPassword}
                  onChange={(e) => setCreateForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                  className="text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Plan */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Subscription Plan *</label>
              <select
                id="create-plan"
                value={createForm.planId}
                onChange={(e) => setCreateForm((f) => ({ ...f, planId: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>Select a plan...</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Rs. {Number(p.monthlyPrice).toLocaleString()}/mo
                  </option>
                ))}
              </select>
            </div>

            {createError && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{createError}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateBusiness} disabled={createLoading}>
              {createLoading ? "Creating..." : "Create Business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
