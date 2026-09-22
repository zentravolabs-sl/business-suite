"use client";

import { useState } from "react";
import {
  Building2, Globe, FileText, Receipt, Shield, Bell, Megaphone,
  Save, CheckCircle, Settings, Phone, Mail, CreditCard, Gift, Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BusinessSettings {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  category: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  businessRegNo: string | null;
  taxNumber: string | null;
  vatNumber: string | null;
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  invoicePrefix: string;
  receiptPrefix: string;
  quotationPrefix: string;
  purchaseOrderPrefix: string;
  warrantyPrefix: string;
  servicePrefix: string;
  taxEnabled: boolean;
  taxRate: number | null;
  taxName: string | null;
  taxInclusive: boolean;
  invoiceFooter: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  thankYouMessage: string | null;
  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  smsEnabled: boolean;
  emailEnabled: boolean;
  loyaltyEnabled: boolean;
  loyaltyPointsPerLkr: number | null;
  warrantyEnabled: boolean;
  ecommerceEnabled: boolean;
}

interface SettingsClientProps {
  business: BusinessSettings;
}

const TABS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "invoice", label: "Invoice & Receipt", icon: FileText },
  { id: "tax", label: "Tax Settings", icon: Receipt },
  { id: "loyalty", label: "Loyalty Program", icon: Gift },
  { id: "communication", label: "Communication", icon: Megaphone },
  { id: "features", label: "Features", icon: Settings },
];

const DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Mullaitivu", "Vavuniya", "Trincomalee", "Batticaloa", "Ampara",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

export function SettingsClient({ business }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: business.name,
    legalName: business.legalName || "",
    email: business.email || "",
    phone: business.phone || "",
    website: business.website || "",
    address: business.address || "",
    city: business.city || "",
    district: business.district || "",
    province: business.province || "",
    postalCode: business.postalCode || "",
    businessRegNo: business.businessRegNo || "",
    taxNumber: business.taxNumber || "",
    vatNumber: business.vatNumber || "",
    // Invoice
    invoicePrefix: business.invoicePrefix,
    receiptPrefix: business.receiptPrefix,
    quotationPrefix: business.quotationPrefix,
    purchaseOrderPrefix: business.purchaseOrderPrefix,
    warrantyPrefix: business.warrantyPrefix,
    servicePrefix: business.servicePrefix,
    invoiceFooter: business.invoiceFooter || "",
    receiptHeader: business.receiptHeader || "",
    receiptFooter: business.receiptFooter || "",
    thankYouMessage: business.thankYouMessage || "",
    // Tax
    taxEnabled: business.taxEnabled,
    taxRate: String(business.taxRate || ""),
    taxName: business.taxName || "VAT",
    taxInclusive: business.taxInclusive,
    // Loyalty
    loyaltyEnabled: business.loyaltyEnabled,
    loyaltyPointsPerLkr: String(business.loyaltyPointsPerLkr || "1"),
    // Communication
    whatsappEnabled: business.whatsappEnabled,
    whatsappNumber: business.whatsappNumber || "",
    smsEnabled: business.smsEnabled,
    emailEnabled: business.emailEnabled,
    // Features
    warrantyEnabled: business.warrantyEnabled,
    ecommerceEnabled: business.ecommerceEnabled,
    language: business.language,
    currency: business.currency,
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggle = (key: string) => () =>
    setForm((f) => ({ ...f, [key]: !f[key as keyof typeof f] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        legalName: form.legalName || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        address: form.address || null,
        city: form.city || null,
        district: form.district || null,
        province: form.province || null,
        postalCode: form.postalCode || null,
        businessRegNo: form.businessRegNo || null,
        taxNumber: form.taxNumber || null,
        vatNumber: form.vatNumber || null,
        invoicePrefix: form.invoicePrefix,
        receiptPrefix: form.receiptPrefix,
        quotationPrefix: form.quotationPrefix,
        purchaseOrderPrefix: form.purchaseOrderPrefix,
        warrantyPrefix: form.warrantyPrefix,
        servicePrefix: form.servicePrefix,
        invoiceFooter: form.invoiceFooter || null,
        receiptHeader: form.receiptHeader || null,
        receiptFooter: form.receiptFooter || null,
        thankYouMessage: form.thankYouMessage || null,
        taxEnabled: form.taxEnabled,
        taxRate: form.taxRate ? parseFloat(form.taxRate) : null,
        taxName: form.taxName || null,
        taxInclusive: form.taxInclusive,
        loyaltyEnabled: form.loyaltyEnabled,
        loyaltyPointsPerLkr: form.loyaltyPointsPerLkr ? parseFloat(form.loyaltyPointsPerLkr) : null,
        whatsappEnabled: form.whatsappEnabled,
        whatsappNumber: form.whatsappNumber || null,
        smsEnabled: form.smsEnabled,
        emailEnabled: form.emailEnabled,
        warrantyEnabled: form.warrantyEnabled,
        ecommerceEnabled: form.ecommerceEnabled,
        language: form.language,
        currency: form.currency,
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const ToggleSwitch = ({ value, onChange, label, description }: any) => (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div>
        <p className="font-medium text-sm">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
          value ? "bg-violet-600" : "bg-muted"
        )}
      >
        <span className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )} />
      </button>
    </div>
  );

  const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your business information, invoicing, tax, and feature settings
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700",
            saved && "from-emerald-600 to-emerald-700"
          )}
        >
          {saved ? (
            <><CheckCircle className="h-4 w-4 mr-1.5" />Saved!</>
          ) : (
            <><Save className="h-4 w-4 mr-1.5" />{saving ? "Saving..." : "Save Changes"}</>
          )}
        </Button>
      </div>

      {/* Business Info Banner */}
      <div className="rounded-2xl border bg-gradient-to-r from-violet-500/5 to-indigo-500/5 p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {form.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-bold">{form.name}</h2>
          <p className="text-sm text-muted-foreground">{business.slug} · {business.category.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Business ID: {business.id.substring(0, 12)}...</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border bg-card shadow-sm p-6">
        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-base border-b pb-3">Business Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Business Name *">
                <Input value={form.name} onChange={set("name")} placeholder="e.g. ABC Electronics" />
              </FormField>
              <FormField label="Legal Name">
                <Input value={form.legalName} onChange={set("legalName")} placeholder="Registered legal name" />
              </FormField>
              <FormField label="Email Address">
                <Input type="email" value={form.email} onChange={set("email")} placeholder="info@business.com" />
              </FormField>
              <FormField label="Phone Number">
                <Input value={form.phone} onChange={set("phone")} placeholder="+94 11 234 5678" />
              </FormField>
              <FormField label="Website">
                <Input value={form.website} onChange={set("website")} placeholder="https://www.business.com" />
              </FormField>
              <FormField label="Business Registration No.">
                <Input value={form.businessRegNo} onChange={set("businessRegNo")} placeholder="PV/12345" />
              </FormField>
              <FormField label="Tax/VAT Number">
                <Input value={form.vatNumber} onChange={set("vatNumber")} placeholder="VAT registration number" />
              </FormField>
              <FormField label="Language">
                <select value={form.language} onChange={set("language")} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="en">English</option>
                  <option value="si">Sinhala (සිංහල)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                </select>
              </FormField>
            </div>

            <h3 className="font-semibold text-base border-b pb-3 mt-6">Address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Street Address">
                  <Input value={form.address} onChange={set("address")} placeholder="123 Main Street" />
                </FormField>
              </div>
              <FormField label="City">
                <Input value={form.city} onChange={set("city")} placeholder="e.g. Colombo" />
              </FormField>
              <FormField label="District">
                <select value={form.district} onChange={set("district")} className="w-full h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="">Select district</option>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </FormField>
              <FormField label="Postal Code">
                <Input value={form.postalCode} onChange={set("postalCode")} placeholder="00100" />
              </FormField>
            </div>
          </div>
        )}

        {/* Invoice Tab */}
        {activeTab === "invoice" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-base border-b pb-3">Document Numbering Prefixes</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Invoice Prefix">
                <Input value={form.invoicePrefix} onChange={set("invoicePrefix")} placeholder="INV" />
              </FormField>
              <FormField label="Receipt Prefix">
                <Input value={form.receiptPrefix} onChange={set("receiptPrefix")} placeholder="RCP" />
              </FormField>
              <FormField label="Quotation Prefix">
                <Input value={form.quotationPrefix} onChange={set("quotationPrefix")} placeholder="QT" />
              </FormField>
              <FormField label="Purchase Order Prefix">
                <Input value={form.purchaseOrderPrefix} onChange={set("purchaseOrderPrefix")} placeholder="PO" />
              </FormField>
              <FormField label="Warranty Card Prefix">
                <Input value={form.warrantyPrefix} onChange={set("warrantyPrefix")} placeholder="WC" />
              </FormField>
              <FormField label="Service Ticket Prefix">
                <Input value={form.servicePrefix} onChange={set("servicePrefix")} placeholder="ST" />
              </FormField>
            </div>

            <h3 className="font-semibold text-base border-b pb-3 mt-6">Invoice & Receipt Content</h3>
            <div className="space-y-4">
              <FormField label="Receipt Header">
                <textarea
                  value={form.receiptHeader}
                  onChange={set("receiptHeader")}
                  rows={2}
                  placeholder="Text to appear at the top of receipts"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
                />
              </FormField>
              <FormField label="Invoice Footer">
                <textarea
                  value={form.invoiceFooter}
                  onChange={set("invoiceFooter")}
                  rows={2}
                  placeholder="Footer text on invoices (e.g. payment terms)"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
                />
              </FormField>
              <FormField label="Receipt Footer">
                <textarea
                  value={form.receiptFooter}
                  onChange={set("receiptFooter")}
                  rows={2}
                  placeholder="e.g. Returns accepted within 7 days with receipt"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
                />
              </FormField>
              <FormField label="Thank You Message">
                <Input
                  value={form.thankYouMessage}
                  onChange={set("thankYouMessage")}
                  placeholder="e.g. Thank you for shopping with us!"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Tax Tab */}
        {activeTab === "tax" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-base border-b pb-3">Tax Configuration</h3>
            <ToggleSwitch
              value={form.taxEnabled}
              onChange={toggle("taxEnabled")}
              label="Enable Tax on Sales"
              description="Apply tax to all sales invoices and receipts"
            />
            {form.taxEnabled && (
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Tax Name">
                  <Input value={form.taxName} onChange={set("taxName")} placeholder="e.g. VAT" />
                </FormField>
                <FormField label="Tax Rate (%)">
                  <Input type="number" value={form.taxRate} onChange={set("taxRate")} placeholder="e.g. 15" />
                </FormField>
                <div className="flex flex-col justify-end">
                  <ToggleSwitch
                    value={form.taxInclusive}
                    onChange={toggle("taxInclusive")}
                    label="Tax Inclusive"
                    description="Prices already include tax"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">ℹ️ Sri Lankan VAT Note</p>
              <p>Standard VAT rate in Sri Lanka is 18%. Set your tax rate accordingly.</p>
              <p className="mt-1">Tax settings apply to all POS sales and online orders.</p>
            </div>
          </div>
        )}

        {/* Loyalty Tab */}
        {activeTab === "loyalty" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-base border-b pb-3">Loyalty Program</h3>
            <ToggleSwitch
              value={form.loyaltyEnabled}
              onChange={toggle("loyaltyEnabled")}
              label="Enable Loyalty Program"
              description="Reward customers with points on every purchase"
            />
            {form.loyaltyEnabled && (
              <div className="rounded-xl border p-4 space-y-4">
                <FormField label="Points per Rs. 100 spent">
                  <Input
                    type="number"
                    value={form.loyaltyPointsPerLkr}
                    onChange={set("loyaltyPointsPerLkr")}
                    placeholder="e.g. 1"
                  />
                </FormField>
                <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 text-sm">
                  <p className="font-medium text-violet-700 dark:text-violet-400">Example Calculation</p>
                  <p className="text-muted-foreground mt-1">
                    Customer spends Rs. 5,000 → earns{" "}
                    <strong>{((parseFloat(form.loyaltyPointsPerLkr) || 1) * 50).toFixed(0)} points</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Communication Tab */}
        {activeTab === "communication" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-base border-b pb-3">Communication Channels</h3>
            <ToggleSwitch
              value={form.whatsappEnabled}
              onChange={toggle("whatsappEnabled")}
              label="WhatsApp Messaging"
              description="Send receipts, warranty cards, and notifications via WhatsApp"
            />
            {form.whatsappEnabled && (
              <div className="ml-4">
                <FormField label="WhatsApp Business Number">
                  <Input
                    value={form.whatsappNumber}
                    onChange={set("whatsappNumber")}
                    placeholder="+94 71 234 5678"
                  />
                </FormField>
              </div>
            )}
            <ToggleSwitch
              value={form.smsEnabled}
              onChange={toggle("smsEnabled")}
              label="SMS Notifications"
              description="Send OTP, service ready, and payment confirmation via SMS"
            />
            <ToggleSwitch
              value={form.emailEnabled}
              onChange={toggle("emailEnabled")}
              label="Email Notifications"
              description="Send invoices, receipts, and reports via email"
            />
          </div>
        )}

        {/* Features Tab */}
        {activeTab === "features" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-base border-b pb-3">Module Settings</h3>
            <ToggleSwitch
              value={form.warrantyEnabled}
              onChange={toggle("warrantyEnabled")}
              label="Digital Warranty System"
              description="Automatically generate warranty cards on product sales"
            />
            <ToggleSwitch
              value={form.ecommerceEnabled}
              onChange={toggle("ecommerceEnabled")}
              label="Online Store (E-Commerce)"
              description="Enable public-facing online store for your business"
            />

            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">💡 Pro Tip</p>
              <p className="text-muted-foreground mt-1">
                Disabling a module hides it from the navigation but doesn&apos;t delete existing data.
                You can re-enable it at any time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button (bottom) */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className={cn(
            "bg-gradient-to-r from-violet-600 to-indigo-600",
            saved && "from-emerald-600 to-emerald-700"
          )}
        >
          {saved ? <><CheckCircle className="h-4 w-4 mr-1.5" />Changes Saved</> : <><Save className="h-4 w-4 mr-1.5" />{saving ? "Saving..." : "Save All Changes"}</>}
        </Button>
      </div>
    </div>
  );
}
