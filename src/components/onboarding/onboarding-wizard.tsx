"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2,
  Tag,
  UserCheck,
  Store,
  Receipt,
  FileText,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "ELECTRONICS", label: "Electronics & Appliances", icon: "⚡" },
  { id: "MOBILE_PHONES", label: "Mobile Phones & Accessories", icon: "📱" },
  { id: "COMPUTERS", label: "Computers & IT Accessories", icon: "💻" },
  { id: "SUPERMARKET", label: "Supermarket & Groceries", icon: "🛒" },
  { id: "FASHION", label: "Clothing & Fashion Boutique", icon: "👗" },
  { id: "PHARMACY", label: "Pharmacy & Wellness", icon: "💊" },
  { id: "HARDWARE", label: "Hardware & Construction", icon: "🔨" },
  { id: "SPARE_PARTS", label: "Automobile & Spare Parts", icon: "⚙️" },
  { id: "SERVICE_REPAIR", label: "Repair & Service Center", icon: "🔧" },
  { id: "GENERAL_RETAIL", label: "General Retail & Mart", icon: "🏪" },
];

const PLANS = [
  {
    type: "STARTER",
    name: "Starter",
    price: "Rs. 2,990",
    period: "/month",
    description: "Ideal for small single-counter retail shops",
    badge: "1 Branch",
    features: [
      "1 Branch & up to 3 Users",
      "500 Products & 500 Monthly Sales",
      "Point of Sale (POS) Billing",
      "Inventory & Barcode Scanner",
      "Customer Directory & Loyalty",
      "Thermal Receipt Printing",
    ],
  },
  {
    type: "BUSINESS",
    name: "Business",
    price: "Rs. 5,990",
    period: "/month",
    description: "Great for growing stores with multi-counter checkout",
    badge: "Most Popular",
    isPopular: true,
    features: [
      "3 Branches & up to 10 Users",
      "2,000 Products & 2,000 Monthly Sales",
      "Full Multi-branch Inventory",
      "Customer Credit & Installments",
      "Supplier Purchasing (PO / GRN)",
      "Online E-Commerce Storefront",
      "SMS & Marketing Campaigns",
    ],
  },
  {
    type: "PROFESSIONAL",
    name: "Professional",
    price: "Rs. 9,990",
    period: "/month",
    description: "Advanced management for electronics, multi-branch & repair shops",
    badge: "Best Value",
    features: [
      "10 Branches & up to 25 Users",
      "10,000 Products & Unlimited Sales",
      "Digital Warranty Tracking & Claims",
      "Repair & Service Ticket System",
      "Full Double-Entry Accounting",
      "Zentravo AI Business Assistant",
      "WhatsApp Notification Gateway",
    ],
  },
  {
    type: "ENTERPRISE",
    name: "Enterprise",
    price: "Rs. 24,990",
    period: "/month",
    description: "Custom scale for large chains, franchises & distributors",
    badge: "Unlimited",
    features: [
      "Unlimited Branches & Staff Users",
      "Unlimited Products & Sales Volume",
      "Custom ERP Integrations & API",
      "Dedicated Account Manager",
      "Priority 24/7 SLA Support",
      "Custom SLA & White-labeling",
    ],
  },
];

const STEPS = [
  { id: 1, name: "Business Info", icon: Building2 },
  { id: 2, name: "Category", icon: Tag },
  { id: 3, name: "Owner Account", icon: UserCheck },
  { id: 4, name: "Main Branch", icon: Store },
  { id: 5, name: "Tax & Currency", icon: Receipt },
  { id: 6, name: "Receipts", icon: FileText },
  { id: 7, name: "Subscription", icon: CreditCard },
];

export function OnboardingWizard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Business Info
    businessName: "",
    legalName: "",
    email: "",
    phone: "",
    address: "",
    city: "Colombo",
    district: "Colombo",
    businessRegNo: "",
    // Step 2: Category
    category: "ELECTRONICS",
    // Step 3: Owner Account
    ownerName: session?.user?.name || "",
    ownerEmail: session?.user?.email || "",
    ownerPassword: "",
    // Step 4: Branch
    branchName: "Main Colombo Showroom",
    branchCity: "Colombo",
    branchPhone: "",
    // Step 5: Tax & Currency
    currency: "LKR",
    enableVat: false,
    vatRate: 18.0,
    vatNumber: "",
    enableSscl: false,
    ssclRate: 2.5,
    // Step 6: Receipt
    invoicePrefix: "INV",
    receiptHeader: "Thank you for visiting us!",
    receiptFooter: "Goods sold are warranted according to manufacturer terms.",
    // Step 7: Plan
    planType: "PROFESSIONAL",
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Basic validation per step
    if (currentStep === 1 && !formData.businessName.trim()) {
      toast.error("Please enter your business name");
      return;
    }
    if (currentStep === 3 && !session?.user && (!formData.ownerEmail || !formData.ownerPassword)) {
      toast.error("Please provide email and password for the owner account");
      return;
    }
    if (currentStep < 7) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to setup business");
      }

      toast.success("Business setup completed successfully!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background py-10 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-semibold text-primary shadow-sm mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Zentravo BMS Onboarding
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Let's Set Up Your Business
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            Configure your branches, tax settings, and retail modules in a few quick steps.
          </p>
        </div>

        {/* Stepper Bar */}
        <div className="mb-8 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-none gap-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-1 min-w-[100px] flex-col items-center text-center cursor-pointer transition-colors",
                    isCompleted && "text-primary",
                    isCurrent && "text-primary font-bold",
                    !isCompleted && !isCurrent && "text-muted-foreground opacity-60"
                  )}
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-all mb-1",
                      isCompleted && "bg-primary text-primary-foreground border-primary",
                      isCurrent && "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                      !isCompleted && !isCurrent && "border-border bg-muted"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] whitespace-nowrap">{step.name}</span>
                </div>
              );
            })}
          </div>
          {/* Progress Indicator */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content Card */}
        <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-sm">
          {/* STEP 1: Business Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Business Information</h2>
                <p className="text-sm text-muted-foreground">
                  Basic identifying details of your retail or wholesale company.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Business / Trade Name *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => updateField("businessName", e.target.value)}
                    placeholder="e.g. Apex Electronics, Lanka Super Store"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Legal / Registered Name
                  </label>
                  <input
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => updateField("legalName", e.target.value)}
                    placeholder="e.g. Apex Electronics (Pvt) Ltd"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Business Registration (BR No.)
                  </label>
                  <input
                    type="text"
                    value={formData.businessRegNo}
                    onChange={(e) => updateField("businessRegNo", e.target.value)}
                    placeholder="e.g. PV-123456"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Official Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="e.g. 011 234 5678 or 077 123 4567"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="info@yourcompany.lk"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Shop / Headquarters Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="No. 123, Galle Road, Colombo 03"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Colombo"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    District
                  </label>
                  <select
                    value={formData.district}
                    onChange={(e) => updateField("district", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[
                      "Colombo",
                      "Gampaha",
                      "Kalutara",
                      "Kandy",
                      "Matale",
                      "Nuwara Eliya",
                      "Galle",
                      "Matara",
                      "Hambantota",
                      "Jaffna",
                      "Kilinochchi",
                      "Mannar",
                      "Vavuniya",
                      "Mullaitivu",
                      "Batticaloa",
                      "Ampara",
                      "Trincomalee",
                      "Kurunegala",
                      "Puttalam",
                      "Anuradhapura",
                      "Polonnaruwa",
                      "Badulla",
                      "Monaragala",
                      "Ratnapura",
                      "Kegalle",
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Category & Industry */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Select Business Category</h2>
                <p className="text-sm text-muted-foreground">
                  We customize POS shortcuts, warranty templates, and tax defaults based on your business type.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = formData.category === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => updateField("category", cat.id)}
                      className={cn(
                        "flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                          : "hover:border-muted-foreground/30 hover:bg-muted/40"
                      )}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{cat.label}</div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Owner Account */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Owner Administrator Account</h2>
                <p className="text-sm text-muted-foreground">
                  The primary account with master privileges, full financial audit, and billing controls.
                </p>
              </div>

              {session?.user ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold">Using Current Signed-in Account</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You are logged in as <strong>{session.user.email}</strong>. This user will automatically be designated as the Owner of this business.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.ownerName}
                      onChange={(e) => updateField("ownerName", e.target.value)}
                      placeholder="e.g. Kasun Perera"
                      className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Owner Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) => updateField("ownerEmail", e.target.value)}
                      placeholder="owner@yourshop.lk"
                      className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Secure Password *
                    </label>
                    <input
                      type="password"
                      value={formData.ownerPassword}
                      onChange={(e) => updateField("ownerPassword", e.target.value)}
                      placeholder="••••••••••••"
                      className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Main Branch Setup */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Initial Branch / Store Setup</h2>
                <p className="text-sm text-muted-foreground">
                  Your first retail outlet or head office branch. You can add more branches later.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(e) => updateField("branchName", e.target.value)}
                    placeholder="e.g. Main Colombo Showroom, Kandy Branch"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Branch City
                  </label>
                  <input
                    type="text"
                    value={formData.branchCity}
                    onChange={(e) => updateField("branchCity", e.target.value)}
                    placeholder="Colombo"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Branch Direct Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.branchPhone}
                    onChange={(e) => updateField("branchPhone", e.target.value)}
                    placeholder="e.g. 011 234 5678"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Tax & Sri Lankan Currency */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Currency & Sri Lankan Tax Configuration</h2>
                <p className="text-sm text-muted-foreground">
                  Configure VAT, SSCL, and tax invoicing per Inland Revenue Department (IRD) requirements.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                  <div>
                    <div className="text-sm font-semibold">Primary Currency</div>
                    <div className="text-xs text-muted-foreground">
                      Base currency used across all POS counters, receipts, and accounting
                    </div>
                  </div>
                  <div className="font-bold text-sm bg-card border px-3 py-1.5 rounded-lg">
                    LKR (Sri Lankan Rupee - Rs.)
                  </div>
                </div>

                <div className="p-4 rounded-xl border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Value Added Tax (VAT) Registered</div>
                      <div className="text-xs text-muted-foreground">
                        Enable if your business is registered for VAT with the Inland Revenue Department
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enableVat}
                      onChange={(e) => updateField("enableVat", e.target.checked)}
                      className="h-5 w-5 rounded border-muted-foreground text-primary focus:ring-primary"
                    />
                  </div>

                  {formData.enableVat && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          VAT Rate (%)
                        </label>
                        <input
                          type="number"
                          value={formData.vatRate}
                          onChange={(e) => updateField("vatRate", parseFloat(e.target.value))}
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          VAT Registration Number
                        </label>
                        <input
                          type="text"
                          value={formData.vatNumber}
                          onChange={(e) => updateField("vatNumber", e.target.value)}
                          placeholder="e.g. 123456789-7000"
                          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Invoice & Receipts */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Invoice & Receipt Customization</h2>
                <p className="text-sm text-muted-foreground">
                  Custom headers, prefixes, and footers printed on thermal receipts and PDF invoices.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePrefix}
                    onChange={(e) => updateField("invoicePrefix", e.target.value)}
                    placeholder="INV"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Receipt numbers will look like: {formData.invoicePrefix}-0001001
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Receipt Top Welcome Message
                  </label>
                  <input
                    type="text"
                    value={formData.receiptHeader}
                    onChange={(e) => updateField("receiptHeader", e.target.value)}
                    placeholder="Welcome to our showroom!"
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Receipt Bottom Footer Message / Return Policy
                  </label>
                  <textarea
                    rows={3}
                    value={formData.receiptFooter}
                    onChange={(e) => updateField("receiptFooter", e.target.value)}
                    placeholder="Goods once sold can only be exchanged within 7 days with original receipt."
                    className="mt-1.5 w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Subscription Plan */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Select Your Subscription Plan</h2>
                <p className="text-sm text-muted-foreground">
                  All plans include a <strong>14-day full-access free trial</strong>. No credit card required to start.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = formData.planType === plan.type;
                  return (
                    <div
                      key={plan.type}
                      onClick={() => updateField("planType", plan.type)}
                      className={cn(
                        "relative flex flex-col justify-between p-5 rounded-2xl border cursor-pointer transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg"
                          : "hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                    >
                      {plan.isPopular && (
                        <div className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wider shadow-sm">
                          {plan.badge}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg">{plan.name}</h3>
                          <div className="text-right">
                            <span className="text-xl font-extrabold">{plan.price}</span>
                            <span className="text-xs text-muted-foreground">{plan.period}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>

                        <div className="mt-4 space-y-2 border-t pt-3">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">14 Days Free Trial</span>
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wizard Action Buttons */}
          <div className="mt-8 flex items-center justify-between border-t pt-5">
            <button
              type="button"
              disabled={currentStep === 1 || loading}
              onClick={handleBack}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                currentStep === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-muted"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <span>Setting up business...</span>
              ) : currentStep === 7 ? (
                <>
                  Launch My Business
                  <Sparkles className="h-4 w-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
