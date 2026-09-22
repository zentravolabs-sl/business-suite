"use client";

import { useState } from "react";
import {
  Megaphone,
  Plus,
  Send,
  Clock,
  CheckCircle,
  X,
  Users,
  MessageSquare,
  Phone,
  Mail,
  Bell,
  BarChart3,
  Filter,
  Loader2,
  Eye,
  Trash2,
  Calendar,
  Target,
  Zap,
  Crown,
  Gift,
  TrendingUp,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  subject: string | null;
  message: string;
  imageUrl: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  targetAll: boolean;
  targetTier: string | null;
  stats: { total: number; sent: number; delivered: number; read: number } | null;
  recipientCount: number;
  products: { productId: string; name: string; imageUrl: string | null }[];
  createdAt: string;
}

interface LoyaltyTier {
  id: string;
  tier: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
  retailPrice: number;
}

interface AudienceStats {
  totalCustomers: number;
  vipCount: number;
  silverCount: number;
  goldCount: number;
  platinumCount: number;
}

interface Props {
  initialCampaigns: Campaign[];
  loyaltyTiers: LoyaltyTier[];
  availableProducts: Product[];
  audienceStats: AudienceStats;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: Clock },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Calendar },
  RUNNING: { label: "Running", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Zap },
  COMPLETED: { label: "Sent", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", icon: X },
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  WHATSAPP: { label: "WhatsApp", icon: Phone, color: "text-emerald-600" },
  SMS: { label: "SMS", icon: MessageSquare, color: "text-blue-600" },
  EMAIL: { label: "Email", icon: Mail, color: "text-violet-600" },
  PUSH: { label: "Push", icon: Bell, color: "text-orange-600" },
};

const TYPE_LABELS: Record<string, string> = {
  NEW_PRODUCT: "New Product",
  DISCOUNT: "Discount",
  SEASONAL: "Seasonal",
  BIRTHDAY: "Birthday",
  LOYALTY: "Loyalty",
  CLEARANCE: "Clearance",
  GENERAL: "General",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}

// ---- Create Campaign Modal ----
function CreateCampaignModal({
  loyaltyTiers,
  availableProducts,
  totalCustomers,
  onClose,
  onCreated,
}: {
  loyaltyTiers: LoyaltyTier[];
  availableProducts: Product[];
  totalCustomers: number;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"details" | "audience" | "message">("details");
  const [form, setForm] = useState({
    name: "",
    type: "GENERAL",
    channel: "WHATSAPP",
    subject: "",
    message: "",
    targetAll: true,
    targetTier: "",
    scheduledAt: "",
    productIds: [] as string[],
  });

  const estimatedReach = form.targetAll
    ? totalCustomers
    : form.targetTier
    ? Math.floor(totalCustomers * 0.3) // rough estimate
    : totalCustomers;

  const handleCreate = async () => {
    setSaving(true);
    const r = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        targetTier: form.targetTier || null,
        scheduledAt: form.scheduledAt || null,
        productIds: form.productIds,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) {
      onCreated(d.campaign);
      onClose();
    }
  };

  const toggleProduct = (id: string) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((p) => p !== id)
        : [...prev.productIds, id],
    }));
  };

  const messageTemplates: Record<string, string> = {
    GENERAL: "Dear {name}, we have exciting news for you! Visit us today and enjoy our latest offers. 🛍️",
    DISCOUNT: "Dear {name}, enjoy an exclusive discount just for you! Use code SAVE20 for 20% off your next purchase. Valid until {date}. 🎉",
    BIRTHDAY: "Happy Birthday, {name}! 🎂 As a special gift, you've received 200 bonus loyalty points. Visit us to redeem your birthday reward!",
    LOYALTY: "Hi {name}, you have {points} loyalty points waiting! Visit our store to redeem them on your next purchase. 🎁",
    NEW_PRODUCT: "Hi {name}, we just launched an exciting new product! Come check it out at our store. 🆕",
    SEASONAL: "Hi {name}, our seasonal sale is here! Don't miss amazing deals. Visit us today! 🌟",
    CLEARANCE: "Hi {name}, clearance sale! Grab products at unbeatable prices — limited stock available. ⚡",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Campaign</h2>
            <p className="text-xs text-gray-400 capitalize">{step} setup</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-5">
          <div className="flex items-center gap-2 mb-5">
            {(["details", "audience", "message"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <button
                  onClick={() => setStep(s)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === s ? "bg-violet-600 text-white" :
                    ["details", "audience", "message"].indexOf(step) > i ? "bg-violet-100 text-violet-600" :
                    "bg-gray-100 dark:bg-slate-800 text-gray-400"
                  }`}
                >
                  {i + 1}
                </button>
                <span className={`text-xs font-medium capitalize hidden sm:block ${step === s ? "text-violet-600" : "text-gray-400"}`}>{s}</span>
                {i < 2 && <div className="w-8 h-px bg-gray-200 dark:bg-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {step === "details" && (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Campaign Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. August Clearance Sale" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Campaign Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, message: messageTemplates[e.target.value] || form.message })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Channel</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
                      <button key={key} onClick={() => setForm({ ...form, channel: key })}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
                          form.channel === key
                            ? "bg-violet-600 text-white border-violet-600 shadow"
                            : "border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {form.channel === "EMAIL" && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Email Subject</label>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Email subject line..." />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Schedule (optional)</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <p className="text-xs text-gray-400 mt-1">Leave blank to save as draft</p>
              </div>
            </>
          )}

          {step === "audience" && (
            <>
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4 flex items-center gap-3">
                <Target className="w-5 h-5 text-violet-600" />
                <div>
                  <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">Estimated Reach</p>
                  <p className="text-2xl font-black text-violet-600">{estimatedReach.toLocaleString()} <span className="text-sm font-medium">customers</span></p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">Target Audience</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <input type="radio" checked={form.targetAll} onChange={() => setForm({ ...form, targetAll: true, targetTier: "" })}
                      className="accent-violet-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Users className="w-4 h-4 text-violet-500" /> All Customers ({totalCustomers})
                      </p>
                      <p className="text-xs text-gray-400">Send to every active customer</p>
                    </div>
                  </label>

                  {loyaltyTiers.map((tier) => (
                    <label key={tier.id} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                      <input type="radio" checked={!form.targetAll && form.targetTier === tier.tier}
                        onChange={() => setForm({ ...form, targetAll: false, targetTier: tier.tier })}
                        className="accent-violet-600" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <Gift className="w-4 h-4 text-amber-500" /> {tier.name} Members Only
                        </p>
                        <p className="text-xs text-gray-400">{tier.tier} loyalty tier</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Featured Products */}
              {availableProducts.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                    Featured Products (optional, up to 3)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {availableProducts.slice(0, 20).map((p) => (
                      <button key={p.id} onClick={() => form.productIds.length < 3 || form.productIds.includes(p.id) ? toggleProduct(p.id) : null}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-all ${
                          form.productIds.includes(p.id)
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                            : "border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800"
                        } ${form.productIds.length >= 3 && !form.productIds.includes(p.id) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <span className="text-gray-400 text-xs">📦</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                          <p className="text-gray-400">Rs. {p.retailPrice.toLocaleString()}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "message" && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide block">Message *</label>
                  <span className="text-xs text-gray-400">{form.message.length} chars</span>
                </div>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  placeholder="Write your campaign message..."
                />
                <p className="text-xs text-gray-400 mt-1">Use {"{name}"}, {"{points}"}, {"{date}"} as dynamic placeholders</p>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Message Preview</p>
                <div className={`rounded-xl p-3 max-w-xs ${
                  form.channel === "WHATSAPP" ? "bg-emerald-500" :
                  form.channel === "SMS" ? "bg-blue-500" : "bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600"
                }`}>
                  <p className={`text-sm ${form.channel === "EMAIL" ? "text-gray-800 dark:text-gray-200" : "text-white"}`}>
                    {form.message.replace("{name}", "Kumara").replace("{points}", "1,250").replace("{date}", "Aug 31") || "Your message will appear here..."}
                  </p>
                </div>
              </div>

              {/* Campaign Summary */}
              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Campaign Summary</p>
                {[
                  { label: "Name", value: form.name || "—" },
                  { label: "Type", value: TYPE_LABELS[form.type] },
                  { label: "Channel", value: CHANNEL_CONFIG[form.channel]?.label },
                  { label: "Audience", value: form.targetAll ? "All Customers" : `${form.targetTier || "All"} Tier` },
                  { label: "Schedule", value: form.scheduledAt ? formatDate(form.scheduledAt) : "Save as Draft" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            {step !== "details" && (
              <button
                onClick={() => setStep(step === "message" ? "audience" : "details")}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                ← Back
              </button>
            )}
            {step === "message" ? (
              <button onClick={handleCreate} disabled={saving || !form.name || !form.message}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Create Campaign
              </button>
            ) : (
              <button onClick={() => setStep(step === "details" ? "audience" : "message")}
                disabled={step === "details" && !form.name}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                Continue → 
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Campaign Card ----
function CampaignCard({ campaign, onSend, onDelete }: { campaign: Campaign; onSend: () => void; onDelete: () => void }) {
  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  const channelCfg = CHANNEL_CONFIG[campaign.channel] || CHANNEL_CONFIG.SMS;
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    setSending(false);
    onSend();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-800 transition-all">
      {/* Status bar */}
      <div className={`h-1 ${
        campaign.status === "COMPLETED" ? "bg-emerald-500" :
        campaign.status === "SCHEDULED" ? "bg-blue-500" :
        campaign.status === "RUNNING" ? "bg-amber-500" :
        "bg-gray-200 dark:bg-slate-700"
      }`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            campaign.channel === "WHATSAPP" ? "bg-emerald-100 dark:bg-emerald-900/30" :
            campaign.channel === "EMAIL" ? "bg-violet-100 dark:bg-violet-900/30" :
            "bg-blue-100 dark:bg-blue-900/30"
          }`}>
            <channelCfg.icon className={`w-5 h-5 ${channelCfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{campaign.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400">{TYPE_LABELS[campaign.type]}</span>
              <span className="text-gray-200 dark:text-slate-600">·</span>
              <span className="text-xs text-gray-400">{channelCfg.label}</span>
            </div>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
            <statusCfg.icon className="w-3 h-3" />
            {statusCfg.label}
          </span>
        </div>

        {/* Message preview */}
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 bg-gray-50 dark:bg-slate-800 rounded-xl p-3 italic">
          "{campaign.message.substring(0, 120)}{campaign.message.length > 120 ? "..." : ""}"
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-gray-50 dark:bg-slate-800 rounded-xl p-2.5">
            <p className="text-xs text-gray-400">Recipients</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{campaign.recipientCount.toLocaleString()}</p>
          </div>
          <div className="text-center bg-gray-50 dark:bg-slate-800 rounded-xl p-2.5">
            <p className="text-xs text-gray-400">Sent</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{campaign.stats?.sent?.toLocaleString() || "0"}</p>
          </div>
          <div className="text-center bg-gray-50 dark:bg-slate-800 rounded-xl p-2.5">
            <p className="text-xs text-gray-400">Target</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              {campaign.targetAll ? "All" : campaign.targetTier || "All"}
            </p>
          </div>
        </div>

        {/* Featured products */}
        {campaign.products.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {campaign.products.map((p) => (
              <div key={p.productId} className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 shrink-0">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-5 h-5 rounded object-cover" />}
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{p.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {campaign.scheduledAt ? `Scheduled: ${formatDate(campaign.scheduledAt)}` :
             campaign.sentAt ? `Sent: ${formatDate(campaign.sentAt)}` :
             `Created: ${formatDate(campaign.createdAt)}`}
          </p>
          <div className="flex gap-2">
            {campaign.status === "DRAFT" && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Now
              </button>
            )}
            {["DRAFT", "CANCELLED"].includes(campaign.status) && (
              <button onClick={onDelete}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
export function MarketingClient({ initialCampaigns, loyaltyTiers, availableProducts, audienceStats }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = campaigns.filter((c) =>
    filterStatus === "all" || c.status === filterStatus
  );

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter((c) => c.status === "COMPLETED").length,
    scheduled: campaigns.filter((c) => c.status === "SCHEDULED").length,
    draft: campaigns.filter((c) => c.status === "DRAFT").length,
    totalReach: campaigns.reduce((sum, c) => sum + c.recipientCount, 0),
  };

  const refreshCampaigns = async () => {
    const r = await fetch("/api/campaigns");
    const d = await r.json();
    if (d.campaigns) setCampaigns(d.campaigns);
  };

  const deleteCampaign = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Marketing Campaigns</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Send WhatsApp, SMS, and Email campaigns to your customers</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Audience Stats */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-sm font-medium">Total Audience</p>
            <p className="text-4xl font-black mt-1">{audienceStats.totalCustomers.toLocaleString()}</p>
            <p className="text-white/70 text-sm">active customers</p>
          </div>
          <Users className="w-8 h-8 text-white/30" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "All Customers", value: audienceStats.totalCustomers, icon: "👥" },
            { label: "VIP", value: audienceStats.vipCount, icon: "👑" },
            { label: "Loyalty Members", value: loyaltyTiers.length > 0 ? "Active" : "None", icon: "🎁" },
            { label: "Total Campaigns", value: stats.total, icon: "📢" },
          ].map((item) => (
            <div key={item.label} className="bg-white/10 backdrop-blur rounded-xl p-3">
              <p className="text-xl">{item.icon}</p>
              <p className="text-white/70 text-xs mt-1">{item.label}</p>
              <p className="text-white font-bold">{typeof item.value === "number" ? item.value.toLocaleString() : item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: stats.sent, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Scheduled", value: stats.scheduled, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Drafts", value: stats.draft, icon: Clock, color: "text-gray-600", bg: "bg-gray-50 dark:bg-slate-800" },
          { label: "Total Reach", value: stats.totalReach.toLocaleString(), icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex items-center gap-3 border border-white/50 dark:border-slate-700`}>
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "DRAFT", "SCHEDULED", "RUNNING", "COMPLETED"].map((f) => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
              filterStatus === f
                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                : "border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "All Campaigns" : STATUS_CONFIG[f]?.label || f}
            {f !== "all" && (
              <span className="ml-1.5 opacity-60">{campaigns.filter((c) => c.status === f).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Campaigns Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No campaigns yet</p>
          <p className="text-xs mt-1">Create your first campaign to reach your customers</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onSend={refreshCampaigns}
              onDelete={() => deleteCampaign(campaign.id)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateCampaignModal
          loyaltyTiers={loyaltyTiers}
          availableProducts={availableProducts}
          totalCustomers={audienceStats.totalCustomers}
          onClose={() => setShowCreate(false)}
          onCreated={(c: any) => setCampaigns((prev) => [c, ...prev])}
        />
      )}
    </div>
  );
}
