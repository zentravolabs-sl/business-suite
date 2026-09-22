"use client";

import { useState } from "react";
import {
  Gift,
  Trophy,
  Star,
  Crown,
  TrendingUp,
  Users,
  Coins,
  Award,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Zap,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface LoyaltyTier {
  id: string;
  tier: string;
  name: string;
  minPoints: number;
  pointsMultiplier: number;
  benefits: string[] | null;
  memberCount: number;
}

interface TopMember {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  isVip: boolean;
  tierName: string;
  tierCode: string | null;
  points: number;
  lifetimePoints: number;
}

interface RecentTransaction {
  id: string;
  customerName: string;
  type: string;
  points: number;
  balance: number;
  notes: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

interface Stats {
  totalMembers: number;
  totalActivePoints: number;
  totalLifetimePoints: number;
  avgPoints: number;
}

interface Props {
  tiers: LoyaltyTier[];
  topMembers: TopMember[];
  recentTransactions: RecentTransaction[];
  stats: Stats;
}

const TIER_CONFIG: Record<string, { gradient: string; icon: string; bg: string; text: string; border: string }> = {
  SILVER: {
    gradient: "from-slate-400 to-slate-600",
    icon: "🥈",
    bg: "bg-slate-50 dark:bg-slate-800/50",
    text: "text-slate-600 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  },
  GOLD: {
    gradient: "from-amber-400 to-orange-500",
    icon: "🥇",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  PLATINUM: {
    gradient: "from-violet-500 to-purple-700",
    icon: "💎",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800",
  },
};

const EARN_TYPES = new Set(["EARN", "BONUS", "BIRTHDAY", "REFERRAL"]);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-LK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---- Tier Config Modal ----
function TierConfigModal({
  existing,
  onClose,
  onSaved,
}: {
  existing?: LoyaltyTier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const TIERS = ["SILVER", "GOLD", "PLATINUM"];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tier: existing?.tier || "SILVER",
    name: existing?.name || "Silver",
    minPoints: existing?.minPoints?.toString() || "500",
    pointsMultiplier: existing?.pointsMultiplier?.toString() || "1",
    benefits: (existing?.benefits || []).join("\n"),
  });

  const handleSave = async () => {
    setSaving(true);
    const r = await fetch("/api/loyalty/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: form.tier,
        name: form.name,
        minPoints: parseInt(form.minPoints),
        pointsMultiplier: parseFloat(form.pointsMultiplier),
        benefits: form.benefits ? form.benefits.split("\n").filter(Boolean) : null,
      }),
    });
    setSaving(false);
    if (r.ok) { onSaved(); onClose(); }
  };

  const TIER_NAMES: Record<string, string> = { SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Configure Loyalty Tier</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Tier Level</label>
            <div className="grid grid-cols-3 gap-2">
              {TIERS.map((t) => {
                const cfg = TIER_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, tier: t, name: TIER_NAMES[t] })}
                    className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      form.tier === t
                        ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-lg`
                        : `${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`
                    }`}
                  >
                    {cfg.icon} {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Display Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="e.g. Gold Member" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Min Lifetime Points</label>
              <input type="number" min={0} value={form.minPoints} onChange={(e) => setForm({ ...form, minPoints: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Points Multiplier</label>
              <input type="number" min={1} step={0.5} value={form.pointsMultiplier} onChange={(e) => setForm({ ...form, pointsMultiplier: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="1.5" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">Member Benefits (one per line)</label>
            <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              placeholder={"Free delivery\n5% discount on all items\nPriority service"} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Tier
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
export function LoyaltyClient({ tiers, topMembers, recentTransactions, stats }: Props) {
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [currentTiers, setCurrentTiers] = useState(tiers);

  const refreshTiers = async () => {
    const r = await fetch("/api/loyalty/tiers");
    const d = await r.json();
    if (d.tiers) setCurrentTiers(d.tiers);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Loyalty Program</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Manage tiers, points, and member rewards</p>
        </div>
        <button
          onClick={() => { setEditingTier(null); setShowTierModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" /> Configure Tier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: stats.totalMembers.toLocaleString(), icon: Users, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
          { label: "Active Points Pool", value: stats.totalActivePoints.toLocaleString(), icon: Coins, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "Lifetime Points Issued", value: stats.totalLifetimePoints.toLocaleString(), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Avg Balance / Member", value: stats.avgPoints.toLocaleString(), icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 flex items-center gap-4 border border-white/50 dark:border-slate-700`}>
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tier Cards */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Tier Configuration</h2>
        {currentTiers.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-10 text-center">
            <Gift className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No loyalty tiers configured</p>
            <p className="text-gray-400 text-sm mt-1">Click "Configure Tier" to set up Silver, Gold, and Platinum tiers</p>
            <button
              onClick={() => setShowTierModal(true)}
              className="mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentTiers.map((tier) => {
              const cfg = TIER_CONFIG[tier.tier] || TIER_CONFIG.SILVER;
              return (
                <div key={tier.id} className={`relative overflow-hidden rounded-2xl border ${cfg.border} bg-white dark:bg-slate-900`}>
                  {/* Gradient header */}
                  <div className={`bg-gradient-to-br ${cfg.gradient} p-6 text-white relative`}>
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, white 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <span className="text-3xl">{cfg.icon}</span>
                        <p className="text-xl font-black mt-1">{tier.name}</p>
                        <p className="text-white/70 text-sm">{tier.tier} Tier</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black">{tier.memberCount}</p>
                        <p className="text-white/70 text-xs">members</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="bg-white/20 rounded-lg px-3 py-1.5">
                        <p className="text-white/70 text-xs">Min Points</p>
                        <p className="text-white font-bold">{tier.minPoints.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/20 rounded-lg px-3 py-1.5">
                        <p className="text-white/70 text-xs">Multiplier</p>
                        <p className="text-white font-bold">{tier.pointsMultiplier}×</p>
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="p-4">
                    {tier.benefits && tier.benefits.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Member Benefits</p>
                        {tier.benefits.map((b, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircle className={`w-4 h-4 ${cfg.text} shrink-0 mt-0.5`} />
                            {b}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No benefits configured</p>
                    )}
                    <button
                      onClick={() => { setEditingTier(tier); setShowTierModal(true); }}
                      className={`mt-4 w-full py-2 rounded-xl text-sm font-semibold ${cfg.bg} ${cfg.text} border ${cfg.border} hover:opacity-80 transition-opacity`}
                    >
                      Edit Tier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Members Leaderboard */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Points Leaderboard</h2>
            </div>
            <span className="text-xs text-gray-400">Top {topMembers.length} members</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {topMembers.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No loyalty members yet</p>
              </div>
            ) : (
              topMembers.slice(0, 10).map((m, idx) => {
                const cfg = m.tierCode ? TIER_CONFIG[m.tierCode] : null;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="w-7 text-center">
                      {idx < 3 ? (
                        <span className="text-lg">{medals[idx]}</span>
                      ) : (
                        <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                      )}
                    </div>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold ${cfg ? `bg-gradient-to-br ${cfg.gradient}` : "bg-violet-500"}`}>
                      {m.customerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{m.customerName}</p>
                        {m.isVip && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      {m.tierName !== "No Tier" && (
                        <span className={`text-xs ${cfg?.text || "text-gray-400"}`}>{m.tierName}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-violet-600 dark:text-violet-400">{m.points.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">pts</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-500" />
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Recent Activity</h2>
            </div>
            <span className="text-xs text-gray-400">Last {recentTransactions.length} events</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
            {recentTransactions.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <Coins className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              recentTransactions.map((t) => {
                const isEarn = EARN_TYPES.has(t.type);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isEarn ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                      {isEarn
                        ? <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        : <ArrowDownRight className="w-4 h-4 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.customerName}</p>
                      <p className="text-xs text-gray-400">
                        {t.type}{t.invoiceNumber ? ` · ${t.invoiceNumber}` : ""}{t.notes ? ` · ${t.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isEarn ? "text-emerald-600" : "text-red-500"}`}>
                        {isEarn ? "+" : "-"}{t.points}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tier Config Modal */}
      {showTierModal && (
        <TierConfigModal
          existing={editingTier}
          onClose={() => { setShowTierModal(false); setEditingTier(null); }}
          onSaved={refreshTiers}
        />
      )}
    </div>
  );
}
