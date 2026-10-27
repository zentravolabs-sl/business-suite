"use client";

import { useState } from "react";
import {
  Receipt, Building2, Percent, Layers, FileText, Hash, BarChart3,
  ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Download,
  Plus, Calendar, Lock,
  Eye, Check, Save, Info, AlertCircle,
  Sliders, ShieldAlert, ArrowUpRight, ArrowDownLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatTaxInvoiceSerial } from "@/lib/tax/numbering";
import { toSriLankanRupeesAndCents } from "@/lib/tax/amount-in-words";
import { TIN_PATTERN } from "@/lib/tax/constants";
import { toast } from "sonner";

interface TaxRateVersion {
  id: string;
  ratePercent: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
}

interface TaxRate {
  id: string;
  name: string;
  code: string | null;
  rate: number;
  treatment: string;
  isDefault: boolean;
  description: string | null;
  legalReference: string | null;
  versions: TaxRateVersion[];
}

interface TaxCategory {
  id: string;
  name: string;
  code: string;
  treatment: string;
  taxRateId: string | null;
  taxRateName: string | null;
  taxRatePercent: number | null;
  isDefault: boolean;
  description: string | null;
  legalReference: string | null;
  productCount: number;
}

interface NumberingRule {
  id: string;
  documentType: string;
  prefix: string;
  suffix: string | null;
  minDigits: number;
  resetPeriod: string;
  includeBranchCode: boolean;
  branchPadding: number;
}

interface DocumentSequence {
  id: string;
  documentType: string;
  branchId: string | null;
  periodKey: string;
  currentValue: number;
  lastIssuedAt: string;
  lastResetAt: string | null;
}

interface Branch {
  id: string;
  name: string;
  code: string | null;
}

interface IntegrationSettings {
  id: string;
  enabled: boolean;
  provider: string;
  environment: string;
  endpointUrl: string;
  autoSubmit: boolean;
  maxRetries: number;
  hasCredentials: boolean;
  lastValidatedAt: string | null;
  lastError: string | null;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaxProfileState = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BusinessState = Record<string, any>;

export interface ReportSummaryData {
  outputVat: number;
  totalStandardTaxable: number;
  inputVatEligible: number;
  inputVatIneligible: number;
  netVatPayable: number;
  totalZeroRated: number;
  totalExempt: number;
  totalOutOfScope: number;
  [key: string]: unknown;
}

export interface ReportRegisterItem {
  id: string;
  documentNumber: string;
  documentType: string;
  issueDate: string;
  partyName: string;
  partyTin: string | null;
  netTaxable: number;
  taxTotal: number;
  grandTotal: number;
  status: string;
  [key: string]: unknown;
}

interface TaxSettingsProps {
  initialData: {
    profile: TaxProfileState;
    business: BusinessState;
    accounts?: AccountOption[];
    accountMappings?: Record<string, string>;
    taxRates: TaxRate[];
    categories: TaxCategory[];
    numberingRules: NumberingRule[];
    sequences: DocumentSequence[];
    branches: Branch[];
    integration: IntegrationSettings | null;
    canEdit: boolean;
  };
}

const TABS = [
  { id: "profile", label: "Tax Profile", icon: Building2 },
  { id: "rates", label: "Tax Rates", icon: Percent },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "templates", label: "Invoice Templates", icon: FileText },
  { id: "numbering", label: "Serial Numbering", icon: Hash },
  { id: "reports", label: "Tax Reports", icon: BarChart3 },
  { id: "integration", label: "GL Accounts & IRD Integration", icon: ShieldCheck },
];

export function TaxSettingsClient({ initialData }: TaxSettingsProps) {
  const [activeTab, setActiveTab] = useState("profile");

  // Profile Form State
  const [profile, setProfile] = useState<TaxProfileState>(initialData.profile || {});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Rates State
  const [taxRates, setTaxRates] = useState<TaxRate[]>(initialData.taxRates);
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [selectedRateForVersion, setSelectedRateForVersion] = useState<TaxRate | null>(null);
  const [versionForm, setVersionForm] = useState({
    ratePercent: 18,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    note: "",
  });
  const [versionSubmitting, setVersionSubmitting] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const [showNewRateModal, setShowNewRateModal] = useState(false);
  const [newRateForm, setNewRateForm] = useState({
    name: "",
    code: "",
    rate: 0,
    treatment: "STANDARD_RATED",
    isDefault: false,
    description: "",
    legalReference: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  const [newRateSubmitting, setNewRateSubmitting] = useState(false);
  const [newRateError, setNewRateError] = useState<string | null>(null);

  // Categories State
  const [categories, setCategories] = useState<TaxCategory[]>(initialData.categories);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{
    id?: string;
    name: string;
    code: string;
    treatment: string;
    taxRateId: string;
    description: string;
    legalReference: string;
    isDefault: boolean;
  }>({
    name: "",
    code: "",
    treatment: "STANDARD_RATED",
    taxRateId: "",
    description: "",
    legalReference: "",
    isDefault: false,
  });
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Templates State
  const [templatePreviewMode, setTemplatePreviewMode] = useState<"REGISTERED" | "NOT_REGISTERED">(
    profile.vatStatus === "REGISTERED" ? "REGISTERED" : "NOT_REGISTERED"
  );

  // Numbering State
  const [numberingRules, setNumberingRules] = useState<NumberingRule[]>(initialData.numberingRules);
  const [sequences] = useState<DocumentSequence[]>(initialData.sequences);
  const [showEditRuleModal, setShowEditRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<NumberingRule | null>(null);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [sandboxDate, setSandboxDate] = useState(new Date().toISOString().slice(0, 10));
  const [sandboxCode, setSandboxCode] = useState(profile.classificationCode || "MAIN");
  const [sandboxSeq, setSandboxSeq] = useState(1);

  // Reports State
  const [reportDateFrom, setReportDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [reportDateTo, setReportDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [reportBranchId, setReportBranchId] = useState("");
  const [reportSummary, setReportSummary] = useState<ReportSummaryData | null>(null);
  const [reportRegister, setReportRegister] = useState<ReportRegisterItem[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTab, setReportTab] = useState<"summary" | "register">("summary");

  // Integration State
  const [integration, setIntegration] = useState<IntegrationSettings | null>(initialData.integration);
  const [integrationForm, setIntegrationForm] = useState({
    enabled: initialData.integration?.enabled ?? false,
    environment: initialData.integration?.environment ?? "SANDBOX",
    endpointUrl: initialData.integration?.endpointUrl ?? "",
    clientId: "",
    clientSecret: "",
    autoSubmit: initialData.integration?.autoSubmit ?? false,
    maxRetries: initialData.integration?.maxRetries ?? 3,
  });
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [validatingIrd, setValidatingIrd] = useState(false);
  const [validationTestResult, setValidationTestResult] = useState<string | null>(null);

  // General Ledger Account Mappings State
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>(initialData.accountMappings || {});
  const [accountsSaving, setAccountsSaving] = useState(false);
  const [accountsMessage, setAccountsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ==========================================
  // PROFILE HANDLERS
  // ==========================================
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/tax/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update tax profile");

      setProfileMessage({ type: "success", text: "Tax profile updated successfully" });
      setTimeout(() => setProfileMessage(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tax profile";
      setProfileMessage({ type: "error", text: message });
    } finally {
      setProfileSaving(false);
    }
  };

  // ==========================================
  // RATE VERSION HANDLERS
  // ==========================================
  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRateForVersion) return;
    setVersionSubmitting(true);
    setVersionError(null);
    try {
      const res = await fetch("/api/tax/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_VERSION",
          taxRateId: selectedRateForVersion.id,
          ratePercent: Number(versionForm.ratePercent),
          effectiveFrom: versionForm.effectiveFrom,
          effectiveTo: versionForm.effectiveTo || null,
          note: versionForm.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add rate version");

      // Refresh rates list
      const updatedRates = taxRates.map((r) => {
        if (r.id === selectedRateForVersion.id) {
          return {
            ...r,
            versions: [
              {
                id: data.version.id,
                ratePercent: Number(data.version.ratePercent),
                effectiveFrom: data.version.effectiveFrom.slice(0, 10),
                effectiveTo: data.version.effectiveTo ? data.version.effectiveTo.slice(0, 10) : null,
                note: data.version.note,
              },
              ...r.versions,
            ],
          };
        }
        return r;
      });
      setTaxRates(updatedRates);
      setShowAddVersionModal(false);
      setVersionForm({
        ratePercent: 18,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: "",
        note: "",
      });
    } catch (err: unknown) {
      setVersionError(err instanceof Error ? err.message : "Failed to add version");
    } finally {
      setVersionSubmitting(false);
    }
  };

  const handleCreateNewRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewRateSubmitting(true);
    setNewRateError(null);
    try {
      const res = await fetch("/api/tax/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRateForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tax rate");

      const created = data.rate;
      setTaxRates([
        ...taxRates,
        {
          id: created.id,
          name: created.name,
          code: created.code,
          rate: Number(created.rate),
          treatment: created.treatment,
          isDefault: created.isDefault,
          description: created.description,
          legalReference: created.legalReference,
          versions: created.versions.map((v: {
            id: string;
            ratePercent: number | string;
            effectiveFrom: string;
            effectiveTo: string | null;
            note: string | null;
          }) => ({
            id: v.id,
            ratePercent: Number(v.ratePercent),
            effectiveFrom: v.effectiveFrom.slice(0, 10),
            effectiveTo: v.effectiveTo ? v.effectiveTo.slice(0, 10) : null,
            note: v.note,
          })),
        },
      ]);
      setShowNewRateModal(false);
      setNewRateForm({
        name: "",
        code: "",
        rate: 0,
        treatment: "STANDARD_RATED",
        isDefault: false,
        description: "",
        legalReference: "",
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    } catch (err: unknown) {
      setNewRateError(err instanceof Error ? err.message : "Failed to create tax rate");
    } finally {
      setNewRateSubmitting(false);
    }
  };

  // ==========================================
  // CATEGORY HANDLERS
  // ==========================================
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySubmitting(true);
    setCategoryError(null);
    try {
      const res = await fetch("/api/tax/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save tax category");

      // Reload categories from server
      const refreshRes = await fetch("/api/tax/categories");
      const refreshData = await refreshRes.json();
      if (refreshData.categories) {
        setCategories(
          refreshData.categories.map((c: {
            id: string;
            name: string;
            code: string;
            treatment: string;
            taxRateId: string | null;
            taxRate?: { name: string; rate: number | string } | null;
            isDefault: boolean;
            description: string | null;
            legalReference: string | null;
            _count?: { products: number };
          }) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            treatment: c.treatment,
            taxRateId: c.taxRateId,
            taxRateName: c.taxRate ? c.taxRate.name : null,
            taxRatePercent: c.taxRate ? Number(c.taxRate.rate) : null,
            isDefault: c.isDefault,
            description: c.description,
            legalReference: c.legalReference,
            productCount: c._count?.products || 0,
          }))
        );
      }
      setShowCategoryModal(false);
    } catch (err: unknown) {
      setCategoryError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setCategorySubmitting(false);
    }
  };

  // ==========================================
  // NUMBERING HANDLERS
  // ==========================================
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setRuleSubmitting(true);
    try {
      const res = await fetch("/api/tax/numbering", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: editingRule.documentType,
          prefix: editingRule.prefix,
          minDigits: Number(editingRule.minDigits),
          resetPeriod: editingRule.resetPeriod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rule");

      setNumberingRules(
        numberingRules.map((r) =>
          r.documentType === editingRule.documentType ? { ...r, ...editingRule } : r
        )
      );
      setShowEditRuleModal(false);
      toast.success("Numbering rule updated successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save numbering rule");
    } finally {
      setRuleSubmitting(false);
    }
  };

  // ==========================================
  // REPORT HANDLERS
  // ==========================================
  const loadReports = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportTab,
        from: reportDateFrom,
        to: reportDateTo,
      });
      if (reportBranchId) params.append("branchId", reportBranchId);

      const res = await fetch(`/api/tax/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load report");

      if (reportTab === "summary") {
        setReportSummary(data.summary);
      } else {
        setReportRegister(data.register || []);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportCsv = (type: "summary" | "register") => {
    const params = new URLSearchParams({
      type,
      format: "csv",
      from: reportDateFrom,
      to: reportDateTo,
    });
    if (reportBranchId) params.append("branchId", reportBranchId);
    window.open(`/api/tax/reports?${params.toString()}`, "_blank");
  };

  const handleExportXlsx = (type: "summary" | "register") => {
    const params = new URLSearchParams({
      type,
      format: "xlsx",
      from: reportDateFrom,
      to: reportDateTo,
    });
    if (reportBranchId) params.append("branchId", reportBranchId);
    window.open(`/api/tax/reports?${params.toString()}`, "_blank");
  };

  // ==========================================
  // INTEGRATION HANDLERS
  // ==========================================
  const handleSaveIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrationSaving(true);
    setIntegrationMessage(null);
    try {
      const res = await fetch("/api/tax/integration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(integrationForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save integration settings");

      setIntegration(data.settings);
      setIntegrationMessage({ type: "success", text: "IRD RAMIS credentials and settings saved securely (AES-256-GCM)" });
      toast.success("RAMIS settings saved securely");
      setTimeout(() => setIntegrationMessage(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save integration settings";
      setIntegrationMessage({ type: "error", text: message });
      toast.error(message);
    } finally {
      setIntegrationSaving(false);
    }
  };

  const runValidationTest = async () => {
    setValidatingIrd(true);
    setValidationTestResult(null);
    try {
      const res = await fetch("/api/tax/integration/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation request failed");

      if (data.isValid) {
        let msg =
          "✓ IRD Schema Validation Passed: Profile meets all 11 statutory requirements under Inland Revenue Department Gazette Extraordinary No. 2481/22 and No. 2500/106.";
        if (data.warnings && data.warnings.length > 0) {
          msg += `\n\nAdvisory Notices (${data.warnings.length}):\n• ` + data.warnings.join("\n• ");
        }
        setValidationTestResult(msg);
        toast.success("IRD Profile Validation Passed");
      } else {
        const errorList = data.errors || ["Unknown statutory validation error"];
        setValidationTestResult(
          `✗ Validation Failed (${errorList.length} issue${errorList.length > 1 ? "s" : ""}):\n• ` +
            errorList.join("\n• ")
        );
        toast.error("IRD Profile Validation Failed");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Validation error occurred";
      setValidationTestResult(`✗ Validation Error: ${message}`);
      toast.error(message);
    } finally {
      setValidatingIrd(false);
    }
  };

  const handleSaveAccountMappings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountsSaving(true);
    setAccountsMessage(null);
    try {
      const res = await fetch("/api/tax/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: accountMappings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save account mappings");

      setAccountMappings(data.mappings || {});
      setAccountsMessage({ type: "success", text: "General Ledger account mappings saved successfully." });
      toast.success("Account mappings saved");
      setTimeout(() => setAccountsMessage(null), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save account mappings";
      setAccountsMessage({ type: "error", text: message });
      toast.error(message);
    } finally {
      setAccountsSaving(false);
    }
  };

  // Sandbox serial computed
  let sandboxSerial = "Invalid serial input";
  try {
    sandboxSerial = formatTaxInvoiceSerial({
      issueDate: new Date(sandboxDate),
      classificationCode: sandboxCode || "MAIN",
      sequence: sandboxSeq,
      minDigits: 5,
    });
  } catch (err: unknown) {
    sandboxSerial = err instanceof Error ? err.message : "Invalid serial input";
  }

  const isVatRegistered = profile.vatStatus === "REGISTERED";

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sri Lanka Tax & Invoicing</h1>
              <p className="text-sm text-muted-foreground">
                Inland Revenue Department (IRD) statutory compliance, VAT management, serial numbering, and e-invoicing suite
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isVatRegistered ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3 py-1 font-medium text-xs">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 inline" />
              VAT REGISTERED • TIN: {profile.tin || "NOT SET"}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-3 py-1 font-medium text-xs">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5 inline" />
              NON-VAT REGISTERED • STANDARD INVOICING
            </Badge>
          )}

          <Button
            onClick={handleSaveProfile}
            disabled={profileSaving || !initialData.canEdit}
            className="gap-2 shadow-sm"
          >
            {profileSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </Button>
        </div>
      </div>

      {profileMessage && (
        <div
          className={cn(
            "p-4 rounded-xl border text-sm flex items-center gap-3",
            profileMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          )}
        >
          {profileMessage.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{profileMessage.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/50 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: BUSINESS TAX PROFILE                             */}
      {/* ======================================================== */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Legal Business & Tax Identification
              </CardTitle>
              <CardDescription>
                Statutory identification details appearing on official Tax Invoices, Commercial Invoices, and IRD submission manifests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium">Legal Business Name *</label>
                  <Input
                    value={profile.legalName || ""}
                    onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                    placeholder="e.g. Zentravo Technologies (Pvt) Ltd"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must match your business registration certificate or Inland Revenue file
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Inland Revenue TIN (Taxpayer Identification No.) *</label>
                  <div className="relative mt-1.5">
                    <Input
                      value={profile.tin || ""}
                      onChange={(e) => setProfile({ ...profile, tin: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                      placeholder="9-digit TIN (e.g. 102938475)"
                      className={cn(
                        "pr-10",
                        profile.tin && TIN_PATTERN.test(profile.tin)
                          ? "border-emerald-500 focus-visible:ring-emerald-500"
                          : profile.tin
                          ? "border-amber-500 focus-visible:ring-amber-500"
                          : ""
                      )}
                    />
                    <div className="absolute right-3 top-2.5">
                      {profile.tin && TIN_PATTERN.test(profile.tin) ? (
                        <Check className="h-5 w-5 text-emerald-500" />
                      ) : profile.tin ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mandatory 9-digit numeric code issued by Sri Lanka Inland Revenue Department
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">VAT Registration Status *</label>
                  <select
                    value={profile.vatStatus}
                    onChange={(e) => setProfile({ ...profile, vatStatus: e.target.value })}
                    className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="NOT_REGISTERED">Not Registered (Standard / Commercial Invoicing)</option>
                    <option value="PENDING_REGISTRATION">Registration Application Pending</option>
                    <option value="REGISTERED">Registered (Legally Authorized to Issue TAX INVOICE)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only businesses marked as Registered may issue documents titled &quot;TAX INVOICE&quot;
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">VAT Registration Number</label>
                  <Input
                    value={profile.vatRegistrationNumber || ""}
                    onChange={(e) => setProfile({ ...profile, vatRegistrationNumber: e.target.value })}
                    placeholder="e.g. 102938475-7000"
                    disabled={profile.vatStatus !== "REGISTERED"}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Format usually includes the 9-digit TIN followed by the VAT branch code (e.g. -7000)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Registration Effective Date</label>
                  <Input
                    type="date"
                    value={profile.registrationEffectiveDate || ""}
                    onChange={(e) => setProfile({ ...profile, registrationEffectiveDate: e.target.value })}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Official effective date of your VAT registration under the Inland Revenue Department
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Tax Invoice Classification Code *</label>
                  <Input
                    value={profile.classificationCode || "MAIN"}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        classificationCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15),
                      })
                    }
                    placeholder="e.g. MAIN, HQ, BRANCH01"
                    className="mt-1.5 uppercase font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Appears in statutory serials (YYMMM_<strong>QQQQ</strong>_XXXXX). Max 15 alphanumeric characters.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Registered Address *</label>
                  <Input
                    value={profile.registeredAddress || ""}
                    onChange={(e) => setProfile({ ...profile, registeredAddress: e.target.value })}
                    placeholder="e.g. No. 45, Galle Road, Colombo 03, Sri Lanka"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Registered Phone</label>
                  <Input
                    value={profile.registeredPhone || ""}
                    onChange={(e) => setProfile({ ...profile, registeredPhone: e.target.value })}
                    placeholder="e.g. +94 11 234 5678"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Default Operating Currency</label>
                  <Input value="LKR (Sri Lankan Rupee)" disabled className="mt-1.5 bg-muted/50 cursor-not-allowed" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Calculation Rules */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                Pricing Mode & Tax Calculation Engine
              </CardTitle>
              <CardDescription>
                Configure how catalog prices are interpreted and how discounts and line-item rounding are resolved
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium">Catalog Pricing Mode</label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, pricingMode: "TAX_INCLUSIVE" })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        profile.pricingMode === "TAX_INCLUSIVE"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="font-semibold text-sm">Tax-Inclusive</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Retail tag contains VAT. System back-calculates Net = Price / (1 + Rate)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, pricingMode: "TAX_EXCLUSIVE" })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        profile.pricingMode === "TAX_EXCLUSIVE"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="font-semibold text-sm">Tax-Exclusive</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        B2B style. Tax is added on top of item base price: Total = Net + (Net × Rate)
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Rounding Reconciliation Mode</label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, roundingLevel: "LINE" })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        profile.roundingLevel === "LINE"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="font-semibold text-sm">Line-Level (Recommended)</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Each line rounded to 2 decimals; invoice total equals exact sum of lines
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, roundingLevel: "INVOICE" })}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        profile.roundingLevel === "INVOICE"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <div className="font-semibold text-sm">Invoice-Level</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Tax calculated on total net; remainder reconciled using largest-remainder algorithm
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Default Non-Tax Document Type</label>
                  <select
                    value={profile.defaultNonTaxDocument}
                    onChange={(e) => setProfile({ ...profile, defaultNonTaxDocument: e.target.value })}
                    className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="SALES_INVOICE">Sales Invoice (Standard)</option>
                    <option value="COMMERCIAL_INVOICE">Commercial Invoice (B2B)</option>
                    <option value="RECEIPT">Sales Receipt</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used when issuing sales if the business is not VAT-registered or customer does not request a tax invoice
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Input VAT Default Eligibility</label>
                  <select
                    value={profile.inputVatDefaultEligibility}
                    onChange={(e) => setProfile({ ...profile, inputVatDefaultEligibility: e.target.value })}
                    className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="ELIGIBLE">Eligible (Recoverable against Output VAT)</option>
                    <option value="UNDER_REVIEW">Under Review (Requires tax officer sign-off)</option>
                    <option value="INELIGIBLE">Ineligible / Blocked (Exempt activities, passenger vehicles, entertainment)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Applied to vendor bills and GRNs when entering purchase inventory or operational expenses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Gazette Notice */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-semibold text-foreground">
                Sri Lanka Inland Revenue Department Gazette Compliance
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed">
                As promulgated under Gazette Extraordinary No. 2481/22 and deferred under Gazette Extraordinary No. 2500/106 to <strong>1 October 2026</strong>, all VAT-registered entities must strictly issue serials adhering to <code>YYMMM_QQQQ_XXXXX</code>, record both Issue Date and Date of Supply, state buyer TINs for transactions exceeding statutory thresholds, and maintain immutable, concurrency-safe records.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TAX RATES & VERSIONS                             */}
      {/* ======================================================== */}
      {activeTab === "rates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Tax Rates & Effective-Dated Versions</h2>
              <p className="text-sm text-muted-foreground">
                Manage statutory VAT rates and maintain historical version timelines with overlap protection
              </p>
            </div>
            <Button onClick={() => setShowNewRateModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Tax Rate
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {taxRates.map((rate) => (
              <Card key={rate.id} className="border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary font-bold">
                        {rate.rate}%
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {rate.name}
                          {rate.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs font-mono">
                            {rate.treatment}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {rate.description || "No description provided"}
                          {rate.legalReference && ` • Ref: ${rate.legalReference}`}
                        </CardDescription>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRateForVersion(rate);
                        setVersionForm({
                          ratePercent: rate.rate,
                          effectiveFrom: new Date().toISOString().slice(0, 10),
                          effectiveTo: "",
                          note: "",
                        });
                        setShowAddVersionModal(true);
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Effective Version
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Effective Versions Timeline ({rate.versions.length})
                  </div>
                  <div className="divide-y divide-border/40 border rounded-xl overflow-hidden text-sm">
                    {rate.versions.map((ver, idx) => (
                      <div
                        key={ver.id}
                        className={cn(
                          "p-3 flex items-center justify-between",
                          idx === 0 ? "bg-primary/5 font-medium" : "bg-card"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-base font-bold text-primary">
                            {ver.ratePercent}%
                          </span>
                          <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              <span>{ver.effectiveFrom}</span>
                              <span>→</span>
                              <span>{ver.effectiveTo || "Present / Open-ended"}</span>
                            </div>
                            {ver.note && (
                              <div className="text-xs text-foreground/80 mt-0.5">{ver.note}</div>
                            )}
                          </div>
                        </div>

                        {idx === 0 && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[11px]">
                            Currently Effective
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PRODUCT TAX CATEGORIES                           */}
      {/* ======================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Product Tax Categories</h2>
              <p className="text-sm text-muted-foreground">
                Map products to statutory treatments (Standard, Zero-rated, Exempt, Out of scope)
              </p>
            </div>
            <Button
              onClick={() => {
                setCategoryForm({
                  name: "",
                  code: "",
                  treatment: "STANDARD_RATED",
                  taxRateId: taxRates[0]?.id || "",
                  description: "",
                  legalReference: "",
                  isDefault: false,
                });
                setShowCategoryModal(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>

          <div className="border border-border/60 rounded-2xl overflow-hidden shadow-sm bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border/60 text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">Code</th>
                    <th className="px-4 py-3.5">Category Name</th>
                    <th className="px-4 py-3.5">Tax Treatment</th>
                    <th className="px-4 py-3.5">Linked Rate</th>
                    <th className="px-4 py-3.5 text-center">Products</th>
                    <th className="px-4 py-3.5">Legal Reference</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-semibold text-primary">{cat.code}</td>
                      <td className="px-4 py-3.5 font-medium">
                        {cat.name}
                        {cat.isDefault && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Default
                          </Badge>
                        )}
                        {cat.description && (
                          <div className="text-xs text-muted-foreground font-normal mt-0.5">
                            {cat.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-mono",
                            cat.treatment === "STANDARD_RATED"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : cat.treatment === "ZERO_RATED"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : cat.treatment === "EXEMPT"
                              ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {cat.treatment}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 font-semibold">
                        {cat.taxRatePercent !== null ? `${cat.taxRatePercent}% (${cat.taxRateName})` : "0% (Exempt/None)"}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono">{cat.productCount}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {cat.legalReference || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCategoryForm({
                              id: cat.id,
                              name: cat.name,
                              code: cat.code,
                              treatment: cat.treatment,
                              taxRateId: cat.taxRateId || "",
                              description: cat.description || "",
                              legalReference: cat.legalReference || "",
                              isDefault: cat.isDefault,
                            });
                            setShowCategoryModal(true);
                          }}
                          className="h-8 text-xs"
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: INVOICE TEMPLATES & PREFERENCES                  */}
      {/* ======================================================== */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Document Templates & Appearance</h2>
              <p className="text-sm text-muted-foreground">
                Customize statutory headers, legal notices, amount in words, and thermal receipt formats
              </p>
            </div>

            {/* Template Switcher */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setTemplatePreviewMode("REGISTERED")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  templatePreviewMode === "REGISTERED"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                VAT Registered (TAX INVOICE)
              </button>
              <button
                type="button"
                onClick={() => setTemplatePreviewMode("NOT_REGISTERED")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  templatePreviewMode === "NOT_REGISTERED"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Non-VAT (SALES INVOICE)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Template Configuration Controls */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Display Toggles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Show Amount in Words</div>
                      <div className="text-xs text-muted-foreground">
                        Spells out totals in Sri Lankan Rupees and Cents
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.showAmountInWords}
                      onChange={(e) => setProfile({ ...profile, showAmountInWords: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Show Unit of Measure (UoM)</div>
                      <div className="text-xs text-muted-foreground">
                        Displays unit column (e.g. PCS, KG, LTR, HRS)
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.showUnitOfMeasure}
                      onChange={(e) => setProfile({ ...profile, showUnitOfMeasure: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Show Company Logo</div>
                      <div className="text-xs text-muted-foreground">
                        Embeds primary business logo on top header
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.showLogo}
                      onChange={(e) => setProfile({ ...profile, showLogo: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Show Payment Method</div>
                      <div className="text-xs text-muted-foreground">
                        Prints CASH, CARD, or BANK TRANSFER summary
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.showPaymentMethod}
                      onChange={(e) => setProfile({ ...profile, showPaymentMethod: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Auto-Print Receipt on Checkout</div>
                      <div className="text-xs text-muted-foreground">
                        Automatically sends thermal receipt to printer on POS payment
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.autoPrintReceipt}
                      onChange={(e) => setProfile({ ...profile, autoPrintReceipt: e.target.checked })}
                      className="h-4 w-4 rounded border-input"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Terms, Notes & Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Payment Terms</label>
                    <Input
                      value={profile.paymentTerms || ""}
                      onChange={(e) => setProfile({ ...profile, paymentTerms: e.target.value })}
                      placeholder="e.g. Payment due within 30 days of invoice date"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Invoice Notes / Bank Instructions</label>
                    <textarea
                      value={profile.invoiceNotes || ""}
                      onChange={(e) => setProfile({ ...profile, invoiceNotes: e.target.value })}
                      rows={3}
                      placeholder="Bank: Commercial Bank | Acc: 1002938475 | Branch: Colombo Main"
                      className="mt-1 w-full p-2.5 rounded-md border border-input bg-background text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Thermal Receipt Footer Message</label>
                    <textarea
                      value={profile.receiptFooter || ""}
                      onChange={(e) => setProfile({ ...profile, receiptFooter: e.target.value })}
                      rows={2}
                      placeholder="Thank you for shopping with us! Please retain this receipt for warranty."
                      className="mt-1 w-full p-2.5 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Interactive Invoice Preview */}
            <div className="lg:col-span-7">
              <div className="p-6 rounded-2xl border border-border/80 shadow-md bg-white text-slate-900 font-sans space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">
                      {profile.legalName || "ZENTRAVO ENTERPRISE"}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {profile.registeredAddress || "No. 123, High Level Road, Colombo"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Tel: {profile.registeredPhone || "+94 11 234 5678"}
                    </p>
                    <div className="mt-2 text-xs font-mono">
                      <span className="font-semibold">TIN: </span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">{profile.tin || "102938475"}</span>
                      {templatePreviewMode === "REGISTERED" && (
                        <>
                          <span className="ml-3 font-semibold">VAT No: </span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">{profile.vatRegistrationNumber || "102938475-7000"}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={cn(
                        "inline-block px-3 py-1 text-sm font-bold tracking-wider uppercase rounded",
                        templatePreviewMode === "REGISTERED"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-200 text-slate-800"
                      )}
                    >
                      {templatePreviewMode === "REGISTERED" ? "TAX INVOICE" : "SALES INVOICE"}
                    </span>
                    <div className="mt-2 font-mono text-xs font-bold text-slate-800">
                      {templatePreviewMode === "REGISTERED" ? "26OCT_MAIN_00042" : "INV-2026-00042"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      <div><strong>Date of Issue:</strong> {new Date().toISOString().slice(0, 10)}</div>
                      <div><strong>Date of Supply:</strong> {new Date().toISOString().slice(0, 10)}</div>
                    </div>
                  </div>
                </div>

                {/* Buyer section */}
                <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                    Customer / Recipient Details:
                  </div>
                  <div className="font-bold text-slate-900">Apex Lanka Trading (Pvt) Ltd</div>
                  <div className="text-slate-600">45 Commercial Avenue, Colombo 02</div>
                  <div className="font-mono">
                    <strong>Buyer TIN:</strong> 998877665 {templatePreviewMode === "REGISTERED" && "• VAT: 998877665-7000"}
                  </div>
                </div>

                {/* Items Table Mockup */}
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b-2 border-slate-900 text-slate-700 text-[11px]">
                      <th className="py-1.5">Description</th>
                      {profile.showUnitOfMeasure && <th className="py-1.5 text-center">UoM</th>}
                      <th className="py-1.5 text-right">Qty</th>
                      <th className="py-1.5 text-right">Unit Price</th>
                      {templatePreviewMode === "REGISTERED" && <th className="py-1.5 text-right">VAT%</th>}
                      <th className="py-1.5 text-right">Total (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2">
                        <div className="font-medium text-slate-900">Commercial Cloud Appliance X100</div>
                        <div className="text-[10px] text-slate-500">STD Rate Supply (First Schedule Compliant)</div>
                      </td>
                      {profile.showUnitOfMeasure && <td className="py-2 text-center">PCS</td>}
                      <td className="py-2 text-right">2</td>
                      <td className="py-2 text-right">50,000.00</td>
                      {templatePreviewMode === "REGISTERED" && <td className="py-2 text-right">18%</td>}
                      <td className="py-2 text-right font-medium">100,000.00</td>
                    </tr>
                    <tr>
                      <td className="py-2">
                        <div className="font-medium text-slate-900">Software Integration Support</div>
                        <div className="text-[10px] text-slate-500">Standard Rated Service</div>
                      </td>
                      {profile.showUnitOfMeasure && <td className="py-2 text-center">HRS</td>}
                      <td className="py-2 text-right">5</td>
                      <td className="py-2 text-right">10,000.00</td>
                      {templatePreviewMode === "REGISTERED" && <td className="py-2 text-right">18%</td>}
                      <td className="py-2 text-right font-medium">50,000.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals Section */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Net Taxable Supplies:</span>
                      <span className="font-mono">150,000.00</span>
                    </div>
                    {templatePreviewMode === "REGISTERED" ? (
                      <div className="flex justify-between text-slate-600">
                        <span>Output VAT (18%):</span>
                        <span className="font-mono">27,000.00</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 italic">
                        * VAT not charged (Supplier is non-registered under VAT Act No. 14 of 2002)
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-900 pt-1.5 font-bold text-sm text-slate-900">
                      <span>Total Payable (LKR):</span>
                      <span className="font-mono">
                        {templatePreviewMode === "REGISTERED" ? "177,000.00" : "150,000.00"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount in words */}
                {profile.showAmountInWords && (
                  <div className="p-2.5 rounded bg-slate-50 text-xs border border-slate-200">
                    <span className="font-semibold text-slate-700">Amount in Words: </span>
                    <span className="text-slate-800 italic">
                      {templatePreviewMode === "REGISTERED"
                        ? toSriLankanRupeesAndCents(177000)
                        : toSriLankanRupeesAndCents(150000)}
                    </span>
                  </div>
                )}

                {/* Legal Footer */}
                <div className="border-t pt-3 text-[10px] text-slate-500 space-y-1">
                  {profile.paymentTerms && <div><strong>Terms:</strong> {profile.paymentTerms}</div>}
                  {profile.invoiceNotes && <div><strong>Notes:</strong> {profile.invoiceNotes}</div>}
                  {templatePreviewMode === "REGISTERED" && (
                    <div className="text-slate-400 italic">
                      Issued in accordance with the Value Added Tax Act No. 14 of 2002 and Sri Lanka Inland Revenue Department Gazette Extraordinary No. 2481/22 and No. 2500/106.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: CONCURRENCY-SAFE SERIAL NUMBERING                */}
      {/* ======================================================== */}
      {activeTab === "numbering" && (
        <div className="space-y-6">
          {/* Statutory Pattern Explainer */}
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                IRD Mandatory Serial Numbering Standard
              </CardTitle>
              <CardDescription>
                Under Section 20 of the VAT Act and IRD Circular SEC/2026/E/03, all Tax Invoices must follow the strict immutable format:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 font-mono text-sm bg-background p-4 rounded-xl border border-border">
                <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-lg font-bold text-primary">YY</div>
                  <div className="text-[10px] text-muted-foreground uppercase">2-Digit Year</div>
                </div>
                <div className="text-xl text-muted-foreground font-bold">_</div>
                <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-lg font-bold text-primary">MMM</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Month Abbr</div>
                </div>
                <div className="text-xl text-muted-foreground font-bold">_</div>
                <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-lg font-bold text-primary">QQQQ</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Branch / Class Code</div>
                </div>
                <div className="text-xl text-muted-foreground font-bold">_</div>
                <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-lg font-bold text-primary">XXXXX</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Atomic Counter (≥5 digits)</div>
                </div>
              </div>

              {/* Interactive Serial Tester */}
              <div className="p-4 rounded-xl border border-border/60 bg-card space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Interactive Serial Format Simulator
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Issue Date</label>
                    <Input
                      type="date"
                      value={sandboxDate}
                      onChange={(e) => setSandboxDate(e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Classification Code</label>
                    <Input
                      value={sandboxCode}
                      onChange={(e) => setSandboxCode(e.target.value.toUpperCase())}
                      className="mt-1 h-9 text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Sequence Number</label>
                    <Input
                      type="number"
                      min={1}
                      value={sandboxSeq}
                      onChange={(e) => setSandboxSeq(Number(e.target.value))}
                      className="mt-1 h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/60 flex items-center justify-between font-mono text-sm">
                  <span className="text-xs text-muted-foreground font-sans">Formatted Tax Invoice Serial:</span>
                  <span className="font-bold text-primary text-base">{sandboxSerial}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Numbering Rules Table */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Document Numbering Rules</h3>
            <div className="border border-border/60 rounded-2xl overflow-hidden shadow-sm bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border/60 text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">Document Type</th>
                    <th className="px-4 py-3.5">Numbering Format</th>
                    <th className="px-4 py-3.5">Prefix</th>
                    <th className="px-4 py-3.5 text-center">Padding</th>
                    <th className="px-4 py-3.5">Reset Period</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {numberingRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3.5 font-medium">
                        {rule.documentType.replace(/_/g, " ")}
                        {rule.documentType === "TAX_INVOICE" && (
                          <Badge className="ml-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px]">
                            Mandatory IRD
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {rule.documentType === "TAX_INVOICE"
                          ? "YYMMM_QQQQ_XXXXX"
                          : `${rule.prefix}{NUMBER}${rule.suffix || ""}`}
                      </td>
                      <td className="px-4 py-3.5 font-mono">{rule.prefix}</td>
                      <td className="px-4 py-3.5 text-center font-mono">{rule.minDigits}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {rule.resetPeriod}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule(rule);
                            setShowEditRuleModal(true);
                          }}
                          className="h-8 text-xs"
                        >
                          Configure
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Counters Table */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Live Concurrency-Safe Sequence Counters</h3>
            <div className="border border-border/60 rounded-2xl overflow-hidden shadow-sm bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border/60 text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Document Type</th>
                    <th className="px-4 py-3">Period Key</th>
                    <th className="px-4 py-3 text-center">Current Counter Value</th>
                    <th className="px-4 py-3">Last Issued Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sequences.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No documents issued yet. Counter allocations will populate atomically upon first transaction.
                      </td>
                    </tr>
                  ) : (
                    sequences.map((seq) => (
                      <tr key={seq.id}>
                        <td className="px-4 py-3 font-medium">{seq.documentType}</td>
                        <td className="px-4 py-3 font-mono text-xs">{seq.periodKey}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-primary">
                          {seq.currentValue}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(seq.lastIssuedAt).toLocaleString("en-GB")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: REAL-TIME TAX REPORTS & REGISTER                 */}
      {/* ======================================================== */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <Card className="border-border/60 shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">From Date</label>
                  <Input
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">To Date</label>
                  <Input
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Branch</label>
                  <select
                    value={reportBranchId}
                    onChange={(e) => setReportBranchId(e.target.value)}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="">All Branches</option>
                    {initialData.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || "MAIN"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={loadReports} disabled={reportLoading} className="h-9 gap-1.5 flex-1 text-xs">
                    {reportLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subtabs for Summary vs Register */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Button
                variant={reportTab === "summary" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setReportTab("summary");
                }}
                className="text-xs"
              >
                VAT Return Summary
              </Button>
              <Button
                variant={reportTab === "register" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setReportTab("register");
                }}
                className="text-xs"
              >
                Tax Invoice Register
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCsv(reportTab)}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportXlsx(reportTab)}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Excel (XLSX)
              </Button>
            </div>
          </div>

          {/* SUMMARY REPORT VIEW */}
          {reportTab === "summary" && (
            <div className="space-y-6">
              {reportSummary ? (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border/60 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-between">
                          <span>Output VAT (Sales)</span>
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-bold font-mono mt-2 text-foreground">
                          LKR {reportSummary.outputVat.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Net Taxable: LKR {reportSummary.totalStandardTaxable.toLocaleString("en-LK")}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-between">
                          <span>Input VAT (Recoverable)</span>
                          <ArrowDownLeft className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold font-mono mt-2 text-foreground">
                          LKR {reportSummary.inputVatEligible.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Ineligible/Blocked: LKR {reportSummary.inputVatIneligible.toLocaleString("en-LK")}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-between">
                          <span>Net VAT to IRD</span>
                          <Receipt className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-2xl font-bold font-mono mt-2 text-primary">
                          LKR {reportSummary.netVatPayable.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {reportSummary.netVatPayable >= 0 ? "Payable to Inland Revenue" : "Refund / Credit Carried Forward"}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-sm">
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground uppercase font-semibold flex items-center justify-between">
                          <span>Exempt / Zero-Rated</span>
                          <ShieldCheck className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="text-2xl font-bold font-mono mt-2 text-foreground">
                          LKR {(reportSummary.totalZeroRated + reportSummary.totalExempt).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Zero: LKR {reportSummary.totalZeroRated.toLocaleString("en-LK")} • Exempt: LKR {reportSummary.totalExempt.toLocaleString("en-LK")}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Treatments Breakdown Table */}
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Supplies Breakdown by IRD Tax Treatment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Treatment Classification</th>
                            <th className="px-4 py-3 text-right">Gross Turnover (LKR)</th>
                            <th className="px-4 py-3 text-right">Net Taxable (LKR)</th>
                            <th className="px-4 py-3 text-right">Tax Charged (LKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono text-xs">
                          <tr>
                            <td className="px-4 py-3 font-sans font-medium">Standard Rated Supplies (18%)</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {(reportSummary.totalStandardTaxable + reportSummary.outputVat).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {reportSummary.totalStandardTaxable.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-primary">
                              {reportSummary.outputVat.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-sans font-medium">Zero-Rated Supplies (0%)</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {reportSummary.totalZeroRated.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {reportSummary.totalZeroRated.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">0.00</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-sans font-medium">Exempt Supplies (First Schedule)</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {reportSummary.totalExempt.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">0.00</td>
                            <td className="px-4 py-3 text-right">0.00</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-sans font-medium">Out of Scope Supplies</td>
                            <td className="px-4 py-3 text-right font-medium">
                              {reportSummary.totalOutOfScope.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">0.00</td>
                            <td className="px-4 py-3 text-right">0.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
                  <BarChart3 className="h-8 w-8 mx-auto opacity-50" />
                  <div className="font-semibold text-sm">No report loaded yet</div>
                  <div className="text-xs">Click &quot;Generate Report&quot; above to compile real-time VAT figures for this period.</div>
                </div>
              )}
            </div>
          )}

          {/* REGISTER REPORT VIEW */}
          {reportTab === "register" && (
            <div className="border border-border/60 rounded-2xl overflow-hidden shadow-sm bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Document Number</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Party Name</th>
                    <th className="px-4 py-3">Party TIN</th>
                    <th className="px-4 py-3 text-right">Net Taxable (LKR)</th>
                    <th className="px-4 py-3 text-right">VAT (LKR)</th>
                    <th className="px-4 py-3 text-right">Grand Total (LKR)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs font-mono">
                  {reportRegister.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground font-sans">
                        No invoices match the selected date range. Click &quot;Generate Report&quot; to query records.
                      </td>
                    </tr>
                  ) : (
                    reportRegister.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-bold text-primary">{inv.documentNumber}</td>
                        <td className="px-4 py-3 font-sans">
                          <Badge variant="outline" className="text-[10px]">
                            {inv.documentType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{inv.issueDate}</td>
                        <td className="px-4 py-3 font-sans font-medium text-foreground">{inv.partyName}</td>
                        <td className="px-4 py-3">{inv.partyTin || "—"}</td>
                        <td className="px-4 py-3 text-right">{inv.netTaxable.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-semibold">{inv.taxTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-bold">{inv.grandTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px]">
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-sans">
                          <a
                            href={`/print/tax-document/${inv.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: IRD RAMIS E-INVOICING INTEGRATION               */}
      {/* ======================================================== */}
      {activeTab === "integration" && (
        <div className="space-y-6">
          {/* General Ledger Account Mapping */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-primary" />
                    General Ledger Account Mappings
                  </CardTitle>
                  <CardDescription>
                    Link Output VAT, Input VAT, revenue, inventory, receivables, and payables directly to your Chart of Accounts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAccountMappings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Tax Accounts */}
                  <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Tax Accounts
                    </div>
                    <div>
                      <label className="text-xs font-medium">Output VAT Account (2100)</label>
                      <select
                        value={accountMappings["OUTPUT_VAT"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, OUTPUT_VAT: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 2100 Output VAT)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Credited when sales tax invoices are issued
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Input VAT Account (1400)</label>
                      <select
                        value={accountMappings["INPUT_VAT"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, INPUT_VAT: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 1400 Input VAT)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Debited when eligible purchase bills/expenses are recorded
                      </p>
                    </div>
                  </div>

                  {/* Revenue & Returns */}
                  <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Revenue & Returns
                    </div>
                    <div>
                      <label className="text-xs font-medium">Sales Revenue (4000)</label>
                      <select
                        value={accountMappings["SALES_REVENUE"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, SALES_REVENUE: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 4000 Sales Revenue)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Sales Returns & Allowances (4200)</label>
                      <select
                        value={accountMappings["SALES_RETURNS"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, SALES_RETURNS: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 4200 Sales Returns)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Service Revenue (4100)</label>
                      <select
                        value={accountMappings["SERVICE_REVENUE"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, SERVICE_REVENUE: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 4100 Service Revenue)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Inventory & Receivables/Payables */}
                  <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Inventory, Receivables & Payables
                    </div>
                    <div>
                      <label className="text-xs font-medium">Accounts Receivable (1200)</label>
                      <select
                        value={accountMappings["ACCOUNTS_RECEIVABLE"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, ACCOUNTS_RECEIVABLE: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 1200 Accounts Receivable)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Accounts Payable (2000)</label>
                      <select
                        value={accountMappings["ACCOUNTS_PAYABLE"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, ACCOUNTS_PAYABLE: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 2000 Accounts Payable)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Cost of Goods Sold (5000)</label>
                      <select
                        value={accountMappings["COGS"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, COGS: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 5000 COGS)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Inventory Asset (1300)</label>
                      <select
                        value={accountMappings["INVENTORY"] || ""}
                        onChange={(e) => setAccountMappings({ ...accountMappings, INVENTORY: e.target.value })}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="">Default (Auto-resolve 1300 Inventory)</option>
                        {initialData.accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            [{acc.code}] {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {accountsMessage && (
                  <div
                    className={cn(
                      "p-3 rounded-xl border text-xs flex items-center gap-2",
                      accountsMessage.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    )}
                  >
                    {accountsMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{accountsMessage.text}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={accountsSaving} className="gap-2 text-xs">
                    {accountsSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Account Mappings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Inland Revenue RAMIS 3.0 Integration Gateway
                  </CardTitle>
                  <CardDescription>
                    Securely configure electronic invoice transmission, client keys, and real-time validation for IRD RAMIS
                  </CardDescription>
                </div>
                {integration?.enabled ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                    Integration Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Disabled
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveIntegration} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium">Gateway Environment</label>
                    <div className="grid grid-cols-2 gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setIntegrationForm({ ...integrationForm, environment: "SANDBOX" })}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all text-sm font-medium",
                          integrationForm.environment === "SANDBOX"
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <div>Sandbox / Test</div>
                        <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                          UAT & Validation environment
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIntegrationForm({ ...integrationForm, environment: "PRODUCTION" })}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all text-sm font-medium",
                          integrationForm.environment === "PRODUCTION"
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <div>Production</div>
                        <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                          Live Inland Revenue Gateway
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Endpoint URL</label>
                    <Input
                      value={integrationForm.endpointUrl}
                      onChange={(e) => setIntegrationForm({ ...integrationForm, endpointUrl: e.target.value })}
                      placeholder="e.g. https://api.ird.gov.lk/ramis/v1 (pending official IRD specification)"
                      className="mt-1.5 font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Official RAMIS REST/SOAP gateway endpoint provided by IRD
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">RAMIS Client ID / Entity ID</label>
                    <Input
                      value={integrationForm.clientId}
                      onChange={(e) => setIntegrationForm({ ...integrationForm, clientId: e.target.value })}
                      placeholder={integration?.hasCredentials ? "••••••••••••••••" : "Enter IRD client identifier"}
                      className="mt-1.5 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Client Secret / Private Key</label>
                    <Input
                      type="password"
                      value={integrationForm.clientSecret}
                      onChange={(e) => setIntegrationForm({ ...integrationForm, clientSecret: e.target.value })}
                      placeholder={integration?.hasCredentials ? "••••••••••••••••" : "Enter IRD client secret"}
                      className="mt-1.5 font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Credentials encrypted using AES-256-GCM before storage
                    </p>
                  </div>

                  <div className="md:col-span-2 flex flex-col sm:flex-row gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrationForm.enabled}
                        onChange={(e) => setIntegrationForm({ ...integrationForm, enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm font-medium">Enable IRD Transmission Service</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrationForm.autoSubmit}
                        onChange={(e) => setIntegrationForm({ ...integrationForm, autoSubmit: e.target.checked })}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm font-medium">Auto-Submit Finalized Tax Invoices to Queue</span>
                    </label>
                  </div>
                </div>

                {integrationMessage && (
                  <div
                    className={cn(
                      "p-3 rounded-xl border text-xs flex items-center gap-2",
                      integrationMessage.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    )}
                  >
                    {integrationMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span>{integrationMessage.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runValidationTest}
                    disabled={validatingIrd}
                    className="gap-2 text-xs"
                  >
                    {validatingIrd ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldAlert className="h-4 w-4" />
                    )}
                    Test Document Validation Engine
                  </Button>

                  <Button type="submit" disabled={integrationSaving} className="gap-2 text-xs">
                    {integrationSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Integration Credentials
                  </Button>
                </div>
              </form>

              {validationTestResult && (
                <div
                  className={cn(
                    "mt-4 p-4 rounded-xl border text-xs whitespace-pre-line font-mono",
                    validationTestResult.startsWith("✓")
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                  )}
                >
                  {validationTestResult}
                </div>
              )}
            </CardContent>
          </Card>

          {/* IRD Statutory Notice */}
          <Card className="border-border/60 bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Statutory Electronic Invoicing Roadmap Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Inland Revenue Department electronic invoice submission operates in accordance with Gazette Extraordinary No. 2481/22, as deferred by Gazette Extraordinary No. 2500/106 to <strong>1 October 2026</strong>.
              </p>
              <p>
                The Zentravo RAMIS Engine validates all 11 statutory rules locally (sequential serials, dual dates, 9-digit TINs, largest-remainder tax reconciliation, and immutable audit logs) so your enterprise is ready for instant live submission when IRD opens the production endpoints for your sector.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS & DIALOGS                                        */}
      {/* ======================================================== */}

      {/* Add Rate Version Modal */}
      <Dialog open={showAddVersionModal} onOpenChange={setShowAddVersionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Effective Rate Version</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddVersion} className="space-y-4">
            {versionError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {versionError}
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Rate Percentage (%) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={versionForm.ratePercent}
                onChange={(e) => setVersionForm({ ...versionForm, ratePercent: Number(e.target.value) })}
                required
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Effective From *</label>
                <Input
                  type="date"
                  value={versionForm.effectiveFrom}
                  onChange={(e) => setVersionForm({ ...versionForm, effectiveFrom: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Effective To (Optional)</label>
                <Input
                  type="date"
                  value={versionForm.effectiveTo}
                  onChange={(e) => setVersionForm({ ...versionForm, effectiveTo: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Gazette / Statutory Note</label>
              <Input
                value={versionForm.note}
                onChange={(e) => setVersionForm({ ...versionForm, note: e.target.value })}
                placeholder="e.g. Value Added Tax (Amendment) Act No. 32 of 2023"
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddVersionModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={versionSubmitting}>
                {versionSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Version"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Tax Rate Modal */}
      <Dialog open={showNewRateModal} onOpenChange={setShowNewRateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Tax Rate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNewRate} className="space-y-4">
            {newRateError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {newRateError}
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Tax Rate Name *</label>
              <Input
                value={newRateForm.name}
                onChange={(e) => setNewRateForm({ ...newRateForm, name: e.target.value })}
                placeholder="e.g. Standard VAT, SSCL, Tourism Cess"
                required
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Code</label>
                <Input
                  value={newRateForm.code}
                  onChange={(e) => setNewRateForm({ ...newRateForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. VAT18"
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Rate Percentage (%) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newRateForm.rate}
                  onChange={(e) => setNewRateForm({ ...newRateForm, rate: Number(e.target.value) })}
                  required
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Tax Treatment</label>
              <select
                value={newRateForm.treatment}
                onChange={(e) => setNewRateForm({ ...newRateForm, treatment: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                <option value="STANDARD_RATED">Standard Rated</option>
                <option value="ZERO_RATED">Zero Rated</option>
                <option value="EXEMPT">Exempt</option>
                <option value="OUT_OF_SCOPE">Out of Scope</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Effective From Date *</label>
              <Input
                type="date"
                value={newRateForm.effectiveFrom}
                onChange={(e) => setNewRateForm({ ...newRateForm, effectiveFrom: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewRateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={newRateSubmitting}>
                {newRateSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Create Rate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryForm.id ? "Edit Tax Category" : "Add Tax Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            {categoryError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {categoryError}
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Category Name *</label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g. Zero-Rated Direct Exports"
                required
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Category Code *</label>
                <Input
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. EXPORT"
                  required
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Tax Treatment *</label>
                <select
                  value={categoryForm.treatment}
                  onChange={(e) => setCategoryForm({ ...categoryForm, treatment: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                >
                  <option value="STANDARD_RATED">Standard Rated</option>
                  <option value="ZERO_RATED">Zero Rated</option>
                  <option value="EXEMPT">Exempt</option>
                  <option value="OUT_OF_SCOPE">Out of Scope</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Linked Tax Rate</label>
              <select
                value={categoryForm.taxRateId}
                onChange={(e) => setCategoryForm({ ...categoryForm, taxRateId: e.target.value })}
                className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                <option value="">No Tax Rate (0% / Exempt)</option>
                {taxRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.rate}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Legal Reference</label>
              <Input
                value={categoryForm.legalReference}
                onChange={(e) => setCategoryForm({ ...categoryForm, legalReference: e.target.value })}
                placeholder="e.g. Section 2(b) or First Schedule, Part II"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="catIsDefault"
                checked={categoryForm.isDefault}
                onChange={(e) => setCategoryForm({ ...categoryForm, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="catIsDefault" className="text-xs font-medium">
                Set as Default Category for new products
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCategoryModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={categorySubmitting}>
                {categorySubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Configure Numbering Rule Modal */}
      <Dialog open={showEditRuleModal} onOpenChange={setShowEditRuleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Numbering: {editingRule?.documentType}</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <form onSubmit={handleSaveRule} className="space-y-4">
              {editingRule.documentType === "TAX_INVOICE" ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  Tax Invoices use the statutory IRD pattern (<code>YYMMM_QQQQ_XXXXX</code>). Prefix and format cannot be altered. Reset frequency may be adjusted.
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium">Prefix</label>
                  <Input
                    value={editingRule.prefix}
                    onChange={(e) => setEditingRule({ ...editingRule, prefix: e.target.value.toUpperCase() })}
                    className="mt-1 font-mono uppercase"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Minimum Digits (Padding)</label>
                  <Input
                    type="number"
                    min={4}
                    max={10}
                    value={editingRule.minDigits}
                    onChange={(e) => setEditingRule({ ...editingRule, minDigits: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Reset Period</label>
                  <select
                    value={editingRule.resetPeriod}
                    onChange={(e) => setEditingRule({ ...editingRule, resetPeriod: e.target.value })}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="NEVER">Never (Continuous)</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditRuleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={ruleSubmitting}>
                  {ruleSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Rule"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
