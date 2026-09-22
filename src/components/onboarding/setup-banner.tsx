"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Building2,
  Tag,
  Store,
  Receipt,
  FileText,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  X,
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
    description: "Ideal for small single-counter retail shops",
    features: ["1 Branch & up to 3 Users", "500 Products", "POS Billing & Inventory"],
  },
  {
    type: "BUSINESS",
    name: "Business",
    price: "Rs. 5,990",
    description: "Great for growing stores",
    isPopular: true,
    features: ["3 Branches & up to 10 Users", "E-Commerce Storefront", "SMS & Marketing"],
  },
  {
    type: "PROFESSIONAL",
    name: "Professional",
    price: "Rs. 9,990",
    description: "Advanced management for multi-branch shops",
    features: ["10 Branches & up to 25 Users", "Warranty Tracking", "AI Assistant"],
  },
  {
    type: "ENTERPRISE",
    name: "Enterprise",
    price: "Rs. 24,990",
    description: "Unlimited scale for large operations",
    features: ["Unlimited Branches & Staff", "API Access", "Dedicated Manager"],
  },
];

const STEPS = [
  { id: 1, name: "Category", icon: Tag },
  { id: 2, name: "Business Info", icon: Building2 },
  { id: 3, name: "Main Branch", icon: Store },
  { id: 4, name: "Tax & Currency", icon: Receipt },
  { id: 5, name: "Receipts", icon: FileText },
  { id: 6, name: "Subscription", icon: CreditCard },
];

interface SetupBannerProps {
  businessName: string;
}

export function SetupBanner({ businessName }: SetupBannerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    category: "ELECTRONICS",
    email: "",
    phone: "",
    address: "",
    city: "Colombo",
    district: "Colombo",
    businessRegNo: "",
    branchName: "Main Showroom",
    branchCity: "Colombo",
    branchPhone: "",
    enableVat: false,
    vatRate: 18.0,
    vatNumber: "",
    invoicePrefix: "INV",
    receiptHeader: `Welcome to ${businessName}!`,
    receiptFooter: "Thank you for shopping with us! Please come again.",
    planType: "PROFESSIONAL",
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep((p) => p + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((p) => p - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete setup");
      toast.success("Business setup completed! Welcome aboard 🎉");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Setup Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 shadow-sm">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground">
              Complete Your Business Setup
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your account is active! Finish setting up <strong>{businessName}</strong> — configure your category, branch, tax, and subscription plan.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Complete Setup
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Setup Wizard Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-4">
              <div>
                <h2 className="text-base font-bold">Business Setup Wizard</h2>
                <p className="text-xs text-muted-foreground">Step {currentStep} of {STEPS.length}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper */}
            <div className="border-b px-6 py-3 bg-muted/20">
              <div className="flex items-center gap-1 overflow-x-auto">
                {STEPS.map((step) => {
                  const Icon = step.icon;
                  const isCompleted = step.id < currentStep;
                  const isCurrent = step.id === currentStep;
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex flex-1 min-w-[70px] flex-col items-center text-center text-[10px] font-medium transition-colors",
                        isCompleted && "text-primary",
                        isCurrent && "text-primary font-bold",
                        !isCompleted && !isCurrent && "text-muted-foreground opacity-50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg border mb-1 transition-all",
                          isCompleted && "bg-primary text-primary-foreground border-primary",
                          isCurrent && "border-primary bg-primary/10 text-primary ring-1 ring-primary/30",
                          !isCompleted && !isCurrent && "border-border bg-muted"
                        )}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      </div>
                      <span className="whitespace-nowrap">{step.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Step Content */}
            <div className="p-6 space-y-5">

              {/* STEP 1: Category */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold">Select Business Category</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">We customize POS, warranty templates, and tax defaults based on your business type.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => {
                      const isSelected = formData.category === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => updateField("category", cat.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-sm",
                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-muted-foreground/30 hover:bg-muted/40"
                          )}
                        >
                          <span className="text-xl">{cat.icon}</span>
                          <span className="font-medium">{cat.label}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Business Info */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold">Business Information</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Contact and registration details for your business.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Official Phone</label>
                      <input type="tel" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="011 234 5678" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Official Email</label>
                      <input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)}
                        placeholder="info@yourbusiness.lk" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</label>
                      <input type="text" value={formData.address} onChange={(e) => updateField("address", e.target.value)}
                        placeholder="No. 123, Galle Road, Colombo 03" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</label>
                      <input type="text" value={formData.city} onChange={(e) => updateField("city", e.target.value)}
                        placeholder="Colombo" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Reg. No.</label>
                      <input type="text" value={formData.businessRegNo} onChange={(e) => updateField("businessRegNo", e.target.value)}
                        placeholder="PV-123456" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Main Branch */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold">Main Branch Setup</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Update your head office / main retail outlet details.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch Name *</label>
                      <input type="text" value={formData.branchName} onChange={(e) => updateField("branchName", e.target.value)}
                        placeholder="e.g. Main Colombo Showroom" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch City</label>
                      <input type="text" value={formData.branchCity} onChange={(e) => updateField("branchCity", e.target.value)}
                        placeholder="Colombo" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch Phone</label>
                      <input type="tel" value={formData.branchPhone} onChange={(e) => updateField("branchPhone", e.target.value)}
                        placeholder="011 234 5678" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Tax & Currency */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold">Currency & Tax Configuration</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Configure VAT per Inland Revenue Department (IRD) requirements.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold">Primary Currency</div>
                      <div className="text-xs text-muted-foreground">Used across all POS counters and accounting</div>
                    </div>
                    <div className="font-bold text-sm bg-card border px-3 py-1.5 rounded-lg">LKR (Sri Lankan Rupee — Rs.)</div>
                  </div>
                  <div className="rounded-xl border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Value Added Tax (VAT)</div>
                        <div className="text-xs text-muted-foreground">Enable if your business is VAT registered with the IRD</div>
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
                          <label className="text-xs font-semibold text-muted-foreground">VAT Rate (%)</label>
                          <input type="number" value={formData.vatRate} onChange={(e) => updateField("vatRate", parseFloat(e.target.value))}
                            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">VAT Registration Number</label>
                          <input type="text" value={formData.vatNumber} onChange={(e) => updateField("vatNumber", e.target.value)}
                            placeholder="e.g. 123456789-7000" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: Receipts */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold">Invoice & Receipt Customization</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Custom headers, prefixes, and footers for receipts and PDF invoices.</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice Prefix</label>
                      <input type="text" value={formData.invoicePrefix} onChange={(e) => updateField("invoicePrefix", e.target.value)}
                        placeholder="INV" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      <p className="text-[11px] text-muted-foreground mt-1">Numbers will look like: {formData.invoicePrefix}-0001001</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt Welcome Message</label>
                      <input type="text" value={formData.receiptHeader} onChange={(e) => updateField("receiptHeader", e.target.value)}
                        placeholder="Welcome to our showroom!" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt Footer / Return Policy</label>
                      <textarea rows={3} value={formData.receiptFooter} onChange={(e) => updateField("receiptFooter", e.target.value)}
                        placeholder="Goods once sold can only be exchanged within 7 days with original receipt."
                        className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Subscription */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold">Select Your Subscription Plan</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">All plans include a <strong>14-day full-access free trial</strong>.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PLANS.map((plan) => {
                      const isSelected = formData.planType === plan.type;
                      return (
                        <div
                          key={plan.type}
                          onClick={() => updateField("planType", plan.type)}
                          className={cn(
                            "relative flex flex-col p-4 rounded-2xl border cursor-pointer transition-all",
                            isSelected ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg" : "hover:border-muted-foreground/40 hover:bg-muted/30"
                          )}
                        >
                          {plan.isPopular && (
                            <div className="absolute -top-2.5 right-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">
                              Popular
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold">{plan.name}</h4>
                            <span className="text-sm font-extrabold text-primary">{plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{plan.description}</p>
                          <ul className="mt-3 space-y-1.5 border-t pt-2.5">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs">
                                <Check className="h-3 w-3 text-primary shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="sticky bottom-0 flex items-center justify-between border-t bg-card px-6 py-4">
              <button
                onClick={handleBack}
                disabled={currentStep === 1 || loading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                  currentStep === 1 || loading ? "opacity-30 cursor-not-allowed" : "hover:bg-muted"
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <button
                onClick={handleNext}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  "Saving..."
                ) : currentStep === 6 ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Complete Setup
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
