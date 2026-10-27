import {
  getPosDatabase,
  OfflineSaleQueueItem,
  SyncStatus,
  ZentravoPosDatabase,
} from "./offline-db";
import { getOrCreateDeviceId } from "./device-auth";

export type NetworkReachability = "ONLINE" | "OFFLINE" | "SERVER_UNREACHABLE" | "CHECKING";

export interface SyncEngineConfig {
  batchSize: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffFactor: number;
  jitterRatio: number;
  pingTimeoutMs: number;
  autoSyncIntervalMs: number;
}

export const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  batchSize: 15,
  initialBackoffMs: 2000, // 2s base
  maxBackoffMs: 60000,    // 60s max
  backoffFactor: 2,       // exponential multiplier
  jitterRatio: 0.2,       // +/- 20% random jitter
  pingTimeoutMs: 4000,    // 4s reachability probe
  autoSyncIntervalMs: 30000, // 30s background retry tick
};

export interface SyncStats {
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSuccessfulSyncAt: number | null;
  reachability: NetworkReachability;
}

export type SyncEventListener = (stats: SyncStats) => void;

/**
 * Calculates exponential backoff with jitter.
 */
export function calculateBackoffMs(
  retryCount: number,
  config: SyncEngineConfig = DEFAULT_SYNC_CONFIG
): number {
  const exponential = Math.min(
    config.maxBackoffMs,
    config.initialBackoffMs * Math.pow(config.backoffFactor, retryCount)
  );
  // Add random jitter between -jitterRatio and +jitterRatio
  const jitterFactor = 1 + (Math.random() * 2 - 1) * config.jitterRatio;
  return Math.max(config.initialBackoffMs, Math.round(exponential * jitterFactor));
}

/**
 * Checks storage quota to prevent accepting unpersisted transactions.
 */
export async function checkStorageQuota(): Promise<{
  safe: boolean;
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  warning?: string;
}> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;
      const percent = (usage / quota) * 100;

      // Reserve at least 10MB or 95% threshold
      const remainingBytes = quota - usage;
      if (remainingBytes < 10 * 1024 * 1024 || percent >= 95) {
        return {
          safe: false,
          usageBytes: usage,
          quotaBytes: quota,
          percentUsed: percent,
          warning: "Device local storage is critically low. Clear browser cache or sync sales to prevent data loss.",
        };
      }

      return {
        safe: true,
        usageBytes: usage,
        quotaBytes: quota,
        percentUsed: percent,
      };
    } catch {
      // Fallback
    }
  }

  return { safe: true, usageBytes: 0, quotaBytes: 0, percentUsed: 0 };
}

/**
 * Verifies real API connectivity by hitting a lightweight ping endpoint.
 * Never relies on browser online event alone.
 */
export async function probeServerReachability(
  pingUrl = "/api/pos/sync/ping",
  timeoutMs = 4000
): Promise<NetworkReachability> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "OFFLINE";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(pingUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return "ONLINE";
    }
    return "SERVER_UNREACHABLE";
  } catch {
    clearTimeout(timer);
    return "SERVER_UNREACHABLE";
  }
}

/**
 * Client-Side Durable POS Synchronization Engine
 */
export class PosSyncEngine {
  private db: ZentravoPosDatabase;
  private businessId: string;
  private config: SyncEngineConfig;
  private isSyncing = false;
  private reachability: NetworkReachability = "CHECKING";
  private lastSuccessfulSyncAt: number | null = null;
  private listeners: Set<SyncEventListener> = new Set();
  private timerId: any = null;

  constructor(
    businessId: string,
    db?: ZentravoPosDatabase,
    config: Partial<SyncEngineConfig> = {}
  ) {
    this.businessId = businessId;
    this.db = db || getPosDatabase();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    this.emitStats();
    return () => this.listeners.delete(listener);
  }

  public getReachability(): NetworkReachability {
    return this.reachability;
  }

  public async getStats(): Promise<SyncStats> {
    const [pending, syncing, synced, failed] = await Promise.all([
      this.db.salesQueue
        .where("[businessId+status]")
        .equals([this.businessId, "PENDING"])
        .count(),
      this.db.salesQueue
        .where("[businessId+status]")
        .equals([this.businessId, "SYNCING"])
        .count(),
      this.db.salesQueue
        .where("[businessId+status]")
        .equals([this.businessId, "SYNCED"])
        .count(),
      this.db.salesQueue
        .where("[businessId+status]")
        .equals([this.businessId, "FAILED"])
        .count(),
    ]);

    return {
      pendingCount: pending,
      syncingCount: syncing,
      syncedCount: synced,
      failedCount: failed,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      reachability: this.reachability,
    };
  }

  private async emitStats(): Promise<void> {
    const stats = await this.getStats();
    this.listeners.forEach((fn) => {
      try {
        fn(stats);
      } catch (err) {
        console.error("Sync listener error:", err);
      }
    });
  }

  /**
   * Initializes listeners for browser events: online, visibilitychange, and background poll.
   */
  public start(): void {
    if (typeof window === "undefined") return;

    const onOnline = () => {
      this.checkAndSync("BROWSER_ONLINE");
    };

    const onOffline = () => {
      this.reachability = "OFFLINE";
      this.emitStats();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        this.checkAndSync("TAB_VISIBLE");
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    // Initial check
    this.checkAndSync("INITIAL_LOAD");

    // Periodic retry ticker for exponential backoff items
    this.timerId = setInterval(() => {
      this.syncPendingSales();
    }, this.config.autoSyncIntervalMs);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Probes network and initiates sync if reachable.
   */
  public async checkAndSync(triggerName = "MANUAL"): Promise<boolean> {
    this.reachability = await probeServerReachability("/api/pos/sync/ping", this.config.pingTimeoutMs);
    await this.emitStats();

    if (this.reachability === "ONLINE") {
      await this.syncPendingSales();
      return true;
    }
    return false;
  }

  /**
   * Performs the durable batch synchronization of all eligible pending/failed sales.
   */
  public async syncPendingSales(forceAll = false): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    if (this.isSyncing) {
      return { processed: 0, success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let processedTotal = 0;
    let successTotal = 0;
    let failedTotal = 0;

    try {
      // 1. Check actual connectivity
      this.reachability = await probeServerReachability("/api/pos/sync/ping", this.config.pingTimeoutMs);
      if (this.reachability !== "ONLINE") {
        await this.emitStats();
        return { processed: 0, success: 0, failed: 0 };
      }

      const now = Date.now();
      const deviceId = getOrCreateDeviceId();

      // 2. Fetch sales that are eligible to sync:
      // status = 'PENDING' OR (status = 'FAILED' and (forceAll or now >= nextRetryAt))
      const allBusinessSales = await this.db.salesQueue
        .where("businessId")
        .equals(this.businessId)
        .toArray();

      const eligible = allBusinessSales.filter((sale) => {
        if (sale.status === "PENDING" || sale.status === "SYNCING") return true;
        if (sale.status === "FAILED") {
          if (forceAll) return true;
          return !sale.nextRetryAt || now >= sale.nextRetryAt;
        }
        return false;
      });

      if (eligible.length === 0) {
        await this.emitStats();
        return { processed: 0, success: 0, failed: 0 };
      }

      // Process in batches
      for (let i = 0; i < eligible.length; i += this.config.batchSize) {
        const batch = eligible.slice(i, i + this.config.batchSize);

        // Mark items as SYNCING in IndexedDB
        await this.db.transaction("rw", this.db.salesQueue, async () => {
          for (const item of batch) {
            await this.db.salesQueue.update(item.offlineId, {
              status: "SYNCING",
              updatedAt: Date.now(),
            });
          }
        });
        await this.emitStats();

        // Send batch to server API
        try {
          const res = await fetch("/api/pos/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deviceId,
              sales: batch.map((item) => ({
                offlineId: item.offlineId,
                branchId: item.branchId,
                deviceId: item.deviceId || deviceId,
                userId: item.userId,
                shiftId: item.shiftId,
                customerId: item.customerId,
                provisionalReceiptNumber: item.provisionalReceiptNumber,
                items: item.items,
                payments: item.payments,
                subtotal: item.subtotal,
                discountAmount: item.discountAmount,
                taxAmount: item.taxAmount,
                total: item.total,
                paidAmount: item.paidAmount,
                changeAmount: item.changeAmount,
                creditAmount: item.creditAmount,
                notes: item.notes,
                offlineCreatedAt: new Date(item.createdAt).toISOString(),
              })),
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned ${res.status}`);
          }

          const responseData = await res.json();
          const results: Array<{
            offlineId: string;
            status: "SUCCESS" | "ALREADY_PROCESSED" | "FAILED";
            saleId?: string;
            invoiceNumber?: string;
            receiptNumber?: string;
            conflicts?: any[];
            error?: string;
          }> = responseData.results || [];

          // Process per-item result from server
          await this.db.transaction("rw", this.db.salesQueue, async () => {
            for (const item of batch) {
              processedTotal++;
              const result = results.find((r) => r.offlineId === item.offlineId);

              if (result && (result.status === "SUCCESS" || result.status === "ALREADY_PROCESSED")) {
                successTotal++;
                await this.db.salesQueue.update(item.offlineId, {
                  status: result.conflicts && result.conflicts.length > 0 ? "CONFLICT" : "SYNCED",
                  serverSaleId: result.saleId,
                  serverInvoiceNumber: result.invoiceNumber,
                  serverReceiptNumber: result.receiptNumber,
                  conflicts: result.conflicts || [],
                  lastError: null,
                  syncedAt: Date.now(),
                  updatedAt: Date.now(),
                });
              } else {
                failedTotal++;
                const nextRetry = Date.now() + calculateBackoffMs(item.retryCount, this.config);
                await this.db.salesQueue.update(item.offlineId, {
                  status: "FAILED",
                  retryCount: item.retryCount + 1,
                  nextRetryAt: nextRetry,
                  lastError: result?.error || "Batch processing failed on server",
                  updatedAt: Date.now(),
                });
              }
            }
          });

          this.lastSuccessfulSyncAt = Date.now();
        } catch (batchErr: any) {
          // Entire batch request failed (e.g. network disconnect during POST)
          await this.db.transaction("rw", this.db.salesQueue, async () => {
            for (const item of batch) {
              processedTotal++;
              failedTotal++;
              const nextRetry = Date.now() + calculateBackoffMs(item.retryCount, this.config);
              await this.db.salesQueue.update(item.offlineId, {
                status: "FAILED",
                retryCount: item.retryCount + 1,
                nextRetryAt: nextRetry,
                lastError: batchErr.message || "Network transmission failed",
                updatedAt: Date.now(),
              });
            }
          });
        }

        await this.emitStats();
      }
    } finally {
      this.isSyncing = false;
      await this.emitStats();
    }

    return { processed: processedTotal, success: successTotal, failed: failedTotal };
  }

  /**
   * Synchronizes the product and customer catalog from server into IndexedDB.
   */
  public async syncCatalog(branchId: string): Promise<boolean> {
    if (this.reachability === "OFFLINE") return false;

    try {
      const res = await fetch(`/api/pos/sync/catalog?branchId=${branchId}`);
      if (!res.ok) return false;

      const data = await res.json();
      const { products, categories, customers } = data;

      await this.db.transaction("rw", [this.db.products, this.db.categories, this.db.customers], async () => {
        if (products && Array.isArray(products)) {
          for (const p of products) {
            await this.db.products.put({
              id: p.id,
              businessId: this.businessId,
              branchId,
              name: p.name,
              sku: p.sku || null,
              barcode: p.barcode || "",
              categoryId: p.categoryId || null,
              categoryName: p.categoryName || "General",
              costPrice: Number(p.costPrice || 0),
              retailPrice: Number(p.retailPrice || 0),
              stockQuantity: Number(p.stockQuantity || 0),
              isSerialTracked: !!p.isSerialTracked,
              warrantyMonths: Number(p.warrantyMonths || 0),
              pricesIncludeTax: !!p.pricesIncludeTax,
              updatedAt: Date.now(),
            });
          }
        }

        if (categories && Array.isArray(categories)) {
          for (const c of categories) {
            await this.db.categories.put({
              id: c.id,
              businessId: this.businessId,
              name: c.name,
            });
          }
        }

        if (customers && Array.isArray(customers)) {
          for (const cust of customers) {
            await this.db.customers.put({
              id: cust.id,
              businessId: this.businessId,
              name: cust.name,
              phone: cust.phone || null,
              email: cust.email || null,
              tin: cust.tin || null,
              vatRegistrationNumber: cust.vatRegistrationNumber || null,
              isVatRegistered: !!cust.isVatRegistered,
              creditLimit: Number(cust.creditLimit || 0),
              creditBalance: Number(cust.creditBalance || 0),
              address: cust.address || null,
              loyaltyPoints: Number(cust.loyaltyPoints || 0),
              updatedAt: Date.now(),
            });
          }
        }
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper to create and locally persist an offline sale in IndexedDB.
   */
  public async createOfflineSale(sale: Omit<OfflineSaleQueueItem, "offlineId" | "status" | "retryCount" | "createdAt" | "updatedAt">): Promise<OfflineSaleQueueItem> {
    const quota = await checkStorageQuota();
    if (!quota.safe) {
      throw new Error(quota.warning || "Cannot create offline sale: Device storage is full.");
    }

    const offlineId = crypto.randomUUID();
    const now = Date.now();
    const queueItem: OfflineSaleQueueItem = {
      ...sale,
      offlineId,
      status: "PENDING",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.salesQueue.add(queueItem);

    // Optimistically deduct local stock count in Dexie products table
    for (const item of queueItem.items) {
      const prod = await this.db.products.get(item.productId);
      if (prod) {
        await this.db.products.update(item.productId, {
          stockQuantity: Math.max(0, prod.stockQuantity - item.quantity),
          updatedAt: now,
        });
      }
    }

    await this.emitStats();
    return queueItem;
  }
}
