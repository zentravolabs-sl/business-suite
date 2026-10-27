"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  X,
  Layers,
  Database,
  Check,
  AlertCircle,
  Download,
} from "lucide-react";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPosDatabase, OfflineSaleQueueItem, SyncStatus } from "@/lib/pos/offline-db";
import { PosSyncEngine, SyncStats, NetworkReachability } from "@/lib/pos/sync-engine";
import { exportUnsyncedSalesBackup } from "@/lib/pos/device-auth";

interface SyncDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  syncEngine: PosSyncEngine | null;
  syncStats: SyncStats;
  onSyncTriggered?: () => void;
}

export function SyncDashboardModal({
  open,
  onOpenChange,
  businessId,
  syncEngine,
  syncStats,
  onSyncTriggered,
}: SyncDashboardModalProps) {
  const [sales, setSales] = useState<OfflineSaleQueueItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | SyncStatus>("ALL");
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<OfflineSaleQueueItem | null>(null);

  const fetchSalesQueue = async () => {
    try {
      const db = getPosDatabase();
      let query = db.salesQueue.where("businessId").equals(businessId);
      const list = await query.reverse().sortBy("createdAt");
      setSales(list);
    } catch (err) {
      console.error("Failed to load offline queue:", err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSalesQueue();
    }
  }, [open, businessId, syncStats]);

  if (!open) return null;

  const handleManualSync = async () => {
    if (!syncEngine) return;
    setLoading(true);
    toast.info("Initiating manual sync...");
    try {
      const res = await syncEngine.syncPendingSales(true);
      await fetchSalesQueue();
      if (res.success > 0) {
        toast.success(`Synchronized ${res.success} sale(s) to cloud!`);
      } else if (res.failed > 0) {
        toast.warning(`${res.failed} sale(s) encountered errors.`);
      } else {
        toast.info("All sales are up to date.");
      }
      onSyncTriggered?.();
    } catch (e: any) {
      toast.error("Sync error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySingle = async (sale: OfflineSaleQueueItem) => {
    try {
      const db = getPosDatabase();
      await db.salesQueue.update(sale.offlineId, {
        status: "PENDING",
        nextRetryAt: null,
        updatedAt: Date.now(),
      });
      toast.success("Queued for immediate retry");
      if (syncEngine) {
        await syncEngine.syncPendingSales();
      }
      await fetchSalesQueue();
      onSyncTriggered?.();
    } catch (e: any) {
      toast.error("Retry failed: " + e.message);
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportUnsyncedSalesBackup(businessId);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zentravo-offline-sales-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Offline sales recovery backup exported successfully!");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  };

  const filteredSales = sales.filter((s) => {
    if (filter === "ALL") return true;
    return s.status === filter;
  });

  const getStatusBadge = (status: SyncStatus) => {
    switch (status) {
      case "SYNCED":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" /> Synced
          </span>
        );
      case "SYNCING":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/30 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
          </span>
        );
      case "PENDING":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case "FAILED":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/30">
            <AlertTriangle className="h-3 w-3" /> Failed
          </span>
        );
      case "CONFLICT":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/30">
            <AlertCircle className="h-3 w-3" /> Resolved Conflict
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="fixed inset-0" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-4xl rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">POS Synchronization Center</h2>
                {syncStats.reachability === "ONLINE" && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                    <Wifi className="h-3 w-3" /> Online & Reachable
                  </span>
                )}
                {syncStats.reachability === "SERVER_UNREACHABLE" && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30">
                    <AlertTriangle className="h-3 w-3" /> Server Unreachable
                  </span>
                )}
                {syncStats.reachability === "OFFLINE" && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">
                    <WifiOff className="h-3 w-3" /> Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Durable IndexedDB synchronization queue and conflict resolution tracker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={loading || syncStats.reachability === "OFFLINE"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>{loading ? "Syncing..." : "Sync Now"}</span>
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4 border-b">
          <div className="p-3 rounded-xl border bg-muted/20">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Pending Sync</span>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1">
              {syncStats.pendingCount}
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-muted/20">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Currently Syncing</span>
              <RefreshCw className={cn("h-3.5 w-3.5 text-blue-500", syncStats.syncingCount > 0 && "animate-spin")} />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1">
              {syncStats.syncingCount}
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-muted/20">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Failed / Retryable</span>
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            </div>
            <div className="text-xl font-extrabold text-foreground mt-1 text-destructive">
              {syncStats.failedCount}
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-muted/20">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Last Synced</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-xs font-bold text-foreground mt-2 truncate">
              {syncStats.lastSuccessfulSyncAt
                ? formatDateTime(new Date(syncStats.lastSuccessfulSyncAt))
                : "Not synced yet"}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 py-3 border-b overflow-x-auto text-xs">
          {(["ALL", "PENDING", "FAILED", "CONFLICT", "SYNCED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "px-3 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap",
                filter === tab
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {tab === "ALL" ? `All Queue (${sales.length})` : tab}
            </button>
          ))}
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {filteredSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No transactions found in this filter view.
            </div>
          ) : (
            filteredSales.map((sale) => (
              <div
                key={sale.offlineId}
                className={cn(
                  "p-3.5 rounded-xl border transition-all text-xs bg-card",
                  sale.status === "FAILED" && "border-destructive/30 bg-destructive/5",
                  sale.status === "CONFLICT" && "border-purple-500/30 bg-purple-500/5",
                  sale.status === "SYNCED" && "border-muted/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(sale.status)}
                    <span className="font-mono font-bold text-foreground">
                      {sale.provisionalReceiptNumber}
                    </span>
                    {sale.serverInvoiceNumber && (
                      <span className="text-muted-foreground font-mono">
                        → Cloud #{sale.serverInvoiceNumber}
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-foreground text-sm">
                    {formatCurrency(sale.total)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-muted-foreground mt-2 text-[11px]">
                  <div>
                    {sale.items.length} item{sale.items.length > 1 ? "s" : ""} •{" "}
                    {sale.customerName ? `Customer: ${sale.customerName}` : "Walk-in Customer"}
                  </div>
                  <div>Created: {formatDateTime(new Date(sale.createdAt))}</div>
                </div>

                {/* Error Banner */}
                {sale.status === "FAILED" && (
                  <div className="mt-2.5 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {sale.lastError || "Server rejection or network failure"}
                      </span>
                      <span className="text-[10px] opacity-75">
                        (Attempt #{sale.retryCount})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRetrySingle(sale)}
                      className="px-2.5 py-0.5 bg-destructive text-destructive-foreground rounded text-[10px] font-bold shrink-0 hover:bg-destructive/90"
                    >
                      Retry Now
                    </button>
                  </div>
                )}

                {/* Conflict Banner */}
                {sale.conflicts && sale.conflicts.length > 0 && (
                  <div className="mt-2.5 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Stock or Price Discrepancies Resolved:</span>
                    </div>
                    {sale.conflicts.map((conf, idx) => (
                      <div key={idx} className="pl-4 text-[10px]">
                        • {conf.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>Client Idempotency: All offline sales are secured by UUID keys</div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              title="Download emergency offline audit backup"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:bg-muted font-semibold transition-colors text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Recovery Backup</span>
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-1.5 bg-muted hover:bg-muted/80 rounded-xl font-semibold text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
