"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Star,
  Crown,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Coins,
  X,
  Edit,
  Eye,
  Gift,
  CreditCard,
  Calendar,
  BarChart3,
  Badge,
  ChevronRight,
  Award,
  Zap,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface Customer {
  id: string;
  customerCode: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  notes: string | null;
  creditLimit: number;
  creditBalance: number;
  isVip: boolean;
  isActive: boolean;
  portalEnabled: boolean;
  createdAt: string;
  totalSales: number;
  totalServiceTickets: number;
  totalSpend: number;
  loyaltyPoints: number;
  lifetimePoints: number;
  loyaltyTier: string | null;
  loyaltyTierCode: string | null;
}

interface LoyaltyTier {
  id: string;
  tier: string;
  name: string;
  minPoints: number;
  pointsMultiplier: number;
}

interface SummaryStats {
  total: number;
  totalVip: number;
  totalLoyalty: number;
  totalRevenue: number;
}

interface Props {
  initialCustomers: Customer[];
  loyaltyTiers: LoyaltyTier[];
  summaryStats: SummaryStats;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  SILVER: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-300", icon: "🥈" },
  GOLD: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-300", icon: "🥇" },
  PLATINUM: { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600 dark:text-violet-400", border: "border-violet-300", icon: "💎" },
};

const TIER_GRADIENTS: Record<string, string> = {
  SILVER: "from-slate-400 to-slate-600",
  GOLD: "from-amber-400 to-orange-500",
  PLATINUM: "from-violet-500 to-purple-700",
};

function formatLKR(v: number) {
  return new Intl.NumberFormat("si-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}

// ---- Customer Detail Drawer ----
function CustomerDetailDrawer({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [awardModal, setAwardModal] = useState(false);
  const [awardPoints, setAwardPoints] = useState(100);
  const [awardType, setAwardType] = useState("BONUS");
  const [awardNotes, setAwardNotes] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "loyalty" | "credit">("overview");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/customers/${customerId}`)
      .then((r) => r.json())
      .then((d) => { setData(d.customer); setLoading(false); })
      .catch(() => setLoading(false));
  }, [customerId]);

  const handleAwardPoints = async () => {
    setAwarding(true);
    await fetch(`/api/customers/${customerId}/loyalty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: awardType, points: awardPoints, notes: awardNotes }),
    });
    setAwarding(false);
    setAwardModal(false);
    // Refresh
    const r = await fetch(`/api/customers/${customerId}`);
    const d = await r.json();
    setData(d.customer);
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-[540px] bg-white dark:bg-slate-900 shadow-2xl flex items-center justify-center border-l border-gray-200 dark:border-slate-700">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tierStyle = data.loyaltyAccount?.tierCode ? TIER_COLORS[data.loyaltyAccount.tierCode] : null;
  const tierGradient = data.loyaltyAccount?.tierCode ? TIER_GRADIENTS[data.loyaltyAccount.tierCode] : "from-gray-400 to-gray-600";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-[560px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className={`relative bg-gradient-to-br ${tierGradient} p-6 text-white`}>
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold shadow-lg">
              {data.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{data.name}</h2>
                {data.isVip && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 text-xs font-bold">
                    <Crown className="w-3 h-3" /> VIP
                  </span>
                )}
              </div>
              <p className="text-white/70 text-sm mt-0.5">{data.customerCode || "No code"}</p>
              {data.loyaltyAccount && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-sm font-medium">
                    <Gift className="w-3.5 h-3.5" />
                    {data.loyaltyAccount.points.toLocaleString()} pts
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                    {data.loyaltyAccount.tierName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: "Total Spend", value: formatLKR(data.totalSpend), icon: TrendingUp },
              { label: "Transactions", value: data.sales?.length || 0, icon: ShoppingBag },
              { label: "Loyalty Points", value: (data.loyaltyAccount?.points || 0).toLocaleString(), icon: Coins },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-white/60 text-xs mb-1">{stat.label}</p>
                <p className="text-white font-bold text-sm">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          {(["overview", "sales", "loyalty", "credit"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 bg-white dark:bg-slate-900"
                  : "text-gray-500 hover:text-gray-700 dark:text-slate-400"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "overview" && (
            <>
              {/* Contact Info */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contact Information</h3>
                {[
                  { icon: Phone, label: data.phone || "—" },
                  { icon: Mail, label: data.email || "—" },
                  { icon: MapPin, label: [data.address, data.city, data.district].filter(Boolean).join(", ") || "—" },
                  { icon: Calendar, label: data.dateOfBirth ? formatDate(data.dateOfBirth) : "—", prefix: "Birthday: " },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <item.icon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{item.prefix}{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Warranties */}
              {data.warranties?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Active Warranties</h3>
                  <div className="space-y-2">
                    {data.warranties.map((w: any) => (
                      <div key={w.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{w.productName}</p>
                          <p className="text-xs text-gray-500">{w.warrantyCode}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          w.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                          w.status === "EXPIRING_SOON" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>{w.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service tickets */}
              {data.serviceTickets?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Service History</h3>
                  <div className="space-y-2">
                    {data.serviceTickets.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.deviceModel}</p>
                          <p className="text-xs text-gray-500">{t.ticketNumber} · {formatDate(t.createdAt)}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{data.notes}</p>
                </div>
              )}
            </>
          )}

          {activeTab === "sales" && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Purchase History</h3>
              {(!data.sales || data.sales.length === 0) ? (
                <div className="text-center py-10 text-gray-400">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No purchases yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.sales.map((s: any) => (
                    <div key={s.id} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">{formatDate(s.createdAt)} · {s.itemCount} item{s.itemCount !== 1 ? "s" : ""}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {s.paymentMethods.map((m: string) => (
                            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-medium">{m}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 shrink-0">{formatLKR(s.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "loyalty" && (
            <div className="space-y-4">
              {/* Loyalty card */}
              {data.loyaltyAccount ? (
                <>
                  <div className={`bg-gradient-to-br ${tierGradient} rounded-2xl p-5 text-white relative overflow-hidden`}>
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)", backgroundSize: "10px 10px" }} />
                    <div className="relative">
                      <p className="text-white/70 text-xs uppercase tracking-widest">Loyalty Balance</p>
                      <p className="text-4xl font-black mt-1">{data.loyaltyAccount.points.toLocaleString()}</p>
                      <p className="text-white/70 text-sm">points</p>
                      <div className="flex items-center justify-between mt-4">
                        <div>
                          <p className="text-white/60 text-xs">Lifetime Earned</p>
                          <p className="text-white font-bold">{data.loyaltyAccount.lifetimePoints.toLocaleString()} pts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/60 text-xs">Tier</p>
                          <p className="text-white font-bold">{data.loyaltyAccount.tierName}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAwardType("BONUS"); setAwardModal(true); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Award Points
                    </button>
                    <button
                      onClick={() => { setAwardType("REDEEM"); setAwardModal(true); }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Gift className="w-4 h-4" /> Redeem
                    </button>
                  </div>

                  {/* Transactions */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Point History</h3>
                    {data.loyaltyAccount.transactions?.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No transactions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {data.loyaltyAccount.transactions?.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                            <div>
                              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                                {t.type} {t.invoiceNumber ? `· ${t.invoiceNumber}` : ""}
                              </p>
                              <p className="text-xs text-gray-400">{formatDate(t.createdAt)}{t.notes ? ` · ${t.notes}` : ""}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${t.type === "EARN" || t.type === "BONUS" || t.type === "BIRTHDAY" || t.type === "REFERRAL" ? "text-green-600" : "text-red-500"}`}>
                                {t.type === "EARN" || t.type === "BONUS" || t.type === "BIRTHDAY" || t.type === "REFERRAL" ? "+" : "-"}{t.points}
                              </p>
                              <p className="text-xs text-gray-400">Bal: {t.balance}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <Gift className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No loyalty account</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "credit" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Credit Limit</p>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-300">{formatLKR(data.creditLimit)}</p>
                </div>
                <div className={`rounded-xl p-4 ${data.creditBalance > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                  <p className={`text-xs font-medium mb-1 ${data.creditBalance > 0 ? "text-red-600" : "text-green-600"}`}>Outstanding</p>
                  <p className={`text-xl font-black ${data.creditBalance > 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>
                    {formatLKR(data.creditBalance)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Credit History</h3>
                {(!data.creditTransactions || data.creditTransactions.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-6">No credit transactions</p>
                ) : (
                  <div className="space-y-2">
                    {data.creditTransactions.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{t.type.replace("_", " ")}</p>
                          <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${t.type === "PAYMENT" ? "text-green-600" : "text-red-500"}`}>
                            {t.type === "PAYMENT" ? "-" : "+"}{formatLKR(t.amount)}
                          </p>
                          <p className="text-xs text-gray-400">Bal: {formatLKR(t.balance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Award Points Modal */}
      {awardModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAwardModal(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {awardType === "REDEEM" ? "Redeem Points" : "Award Points"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Type</label>
                <select
                  value={awardType}
                  onChange={(e) => setAwardType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="EARN">Earn (Purchase)</option>
                  <option value="BONUS">Bonus</option>
                  <option value="BIRTHDAY">Birthday Reward</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="REDEEM">Redeem</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Points</label>
                <input
                  type="number"
                  min={1}
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
                <input
                  type="text"
                  value={awardNotes}
                  onChange={(e) => setAwardNotes(e.target.value)}
                  placeholder="Reason..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setAwardModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAwardPoints}
                disabled={awarding}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {awarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Add Customer Modal ----
function AddCustomerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "", district: "", gender: "", notes: "", creditLimit: "", isVip: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, creditLimit: form.creditLimit ? Number(form.creditLimit) : 0 }),
    });
    setSaving(false);
    if (r.ok) { onSuccess(); onClose(); }
  };

  const districts = ["Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add New Customer</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Full Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Customer full name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="07XXXXXXXX" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Colombo" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">District</label>
              <select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Select district</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Credit Limit (LKR)</label>
              <input type="number" min={0} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Street address" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                placeholder="Internal notes about this customer..." />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isVip} onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
                  className="w-4 h-4 rounded accent-violet-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" /> Mark as VIP Customer
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main Component ----
export function CustomersClient({ initialCustomers, loyaltyTiers, summaryStats }: Props) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "SILVER" | "GOLD" | "PLATINUM">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const filtered = customers.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.customerCode?.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === "all" ||
      (filter === "vip" && c.isVip) ||
      c.loyaltyTierCode === filter;

    return matchSearch && matchFilter;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/customers?limit=100");
    const d = await r.json();
    if (d.customers) setCustomers(d.customers);
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Customer 360 — Profiles, Loyalty, Credit & History</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={loading} className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: summaryStats.total.toLocaleString(), icon: Users, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-100 dark:border-violet-800" },
          { label: "VIP Members", value: summaryStats.totalVip.toLocaleString(), icon: Crown, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-100 dark:border-amber-800" },
          { label: "Loyalty Members", value: summaryStats.totalLoyalty.toLocaleString(), icon: Gift, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-100 dark:border-pink-800" },
          { label: "Total Revenue", value: formatLKR(summaryStats.totalRevenue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-100 dark:border-emerald-800" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border ${stat.border} rounded-2xl p-4 flex items-center gap-4`}>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
              <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loyalty Tiers Overview */}
      {loyaltyTiers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {loyaltyTiers.map((tier) => {
            const style = TIER_COLORS[tier.tier] || TIER_COLORS.SILVER;
            const gradient = TIER_GRADIENTS[tier.tier] || "from-gray-400 to-gray-600";
            const count = customers.filter((c) => c.loyaltyTierCode === tier.tier).length;
            return (
              <div key={tier.id} className={`relative overflow-hidden rounded-2xl border ${style.border} ${style.bg} p-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-2xl">{style.icon}</span>
                    <p className={`font-bold text-sm mt-1 ${style.text}`}>{tier.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tier.minPoints.toLocaleString()}+ pts</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${style.text}`}>{count}</p>
                    <p className="text-xs text-gray-500">members</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{tier.pointsMultiplier}× points multiplier</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, or code..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "vip", "SILVER", "GOLD", "PLATINUM"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                  : "border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              {f === "vip" ? "⭐ VIP" : f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No customers found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const tierStyle = c.loyaltyTierCode ? TIER_COLORS[c.loyaltyTierCode] : null;
            const tierGradient = c.loyaltyTierCode ? TIER_GRADIENTS[c.loyaltyTierCode] : null;
            return (
              <div
                key={c.id}
                className="group bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedCustomer(c.id)}
              >
                {/* Tier color bar */}
                {tierGradient && (
                  <div className={`h-1 bg-gradient-to-r ${tierGradient}`} />
                )}

                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                      tierGradient ? `bg-gradient-to-br ${tierGradient}` : "bg-gradient-to-br from-violet-500 to-purple-600"
                    }`}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                        {c.isVip && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400">{c.customerCode || "—"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors shrink-0 mt-0.5" />
                  </div>

                  {/* Contact */}
                  <div className="space-y-1 mb-3">
                    {c.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3 h-3 text-gray-400" /> {c.phone}
                      </div>
                    )}
                    {c.city && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 text-gray-400" /> {c.city}{c.district ? `, ${c.district}` : ""}
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Spend</p>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                        {c.totalSpend >= 1000 ? `${(c.totalSpend / 1000).toFixed(0)}K` : c.totalSpend.toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">Orders</p>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">{c.totalSales}</p>
                    </div>
                    <div className={`rounded-lg p-2 text-center ${tierStyle ? tierStyle.bg : "bg-gray-50 dark:bg-slate-800"}`}>
                      <p className="text-xs text-gray-400">Points</p>
                      <p className={`text-xs font-bold mt-0.5 ${tierStyle ? tierStyle.text : "text-gray-800 dark:text-gray-200"}`}>
                        {c.loyaltyPoints.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Tier badge */}
                  {c.loyaltyTier && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tierStyle?.text} ${tierStyle?.bg} border ${tierStyle?.border}`}>
                        {TIER_COLORS[c.loyaltyTierCode!]?.icon} {c.loyaltyTier}
                      </span>
                      {c.creditBalance > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <CreditCard className="w-3 h-3" /> {formatLKR(c.creditBalance)} due
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer 360 Drawer */}
      {selectedCustomer && (
        <CustomerDetailDrawer
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {/* Add Customer Modal */}
      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
