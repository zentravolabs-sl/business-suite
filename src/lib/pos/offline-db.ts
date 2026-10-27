import Dexie, { type EntityTable } from "dexie";

export type SyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export interface OfflineSaleItem {
  productId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discountAmount?: number;
  taxAmount?: number;
  total: number;
  warrantyMonths?: number;
  serialNumber?: string | null;
  pricesIncludeTax?: boolean;
}

export interface OfflineSalePayment {
  method: string;
  amount: number;
  reference?: string | null;
}

export interface SyncConflictRecord {
  type: "PRICE_DISCREPANCY" | "STOCK_DEFICIT" | "TAX_RULE_CHANGED" | "CONCURRENCY_WARNING";
  productId?: string;
  productName?: string;
  chargedPrice?: number;
  serverPrice?: number;
  difference?: number;
  requestedQty?: number;
  availableQty?: number;
  action: string;
  message: string;
  resolvedAt: string;
}

export interface OfflineSaleQueueItem {
  offlineId: string; // Client UUIDv4
  businessId: string;
  branchId: string;
  deviceId: string;
  userId: string;
  userName?: string;
  shiftId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  provisionalReceiptNumber: string;
  items: OfflineSaleItem[];
  payments: OfflineSalePayment[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  creditAmount: number;
  notes?: string | null;
  status: SyncStatus;
  retryCount: number;
  nextRetryAt?: number | null;
  lastError?: string | null;
  serverSaleId?: string | null;
  serverInvoiceNumber?: string | null;
  serverReceiptNumber?: string | null;
  conflicts?: SyncConflictRecord[];
  createdAt: number; // Unix epoch ms
  updatedAt: number;
  syncedAt?: number | null;
}

export interface OfflineProduct {
  id: string;
  businessId: string;
  branchId: string;
  name: string;
  sku: string | null;
  barcode: string;
  categoryId: string | null;
  categoryName: string;
  costPrice: number;
  retailPrice: number;
  stockQuantity: number;
  isSerialTracked: boolean;
  warrantyMonths: number;
  pricesIncludeTax: boolean;
  updatedAt: number;
}

export interface OfflineCategory {
  id: string;
  businessId: string;
  name: string;
}

export interface OfflineCustomer {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  tin: string | null;
  vatRegistrationNumber: string | null;
  isVatRegistered: boolean;
  creditLimit: number;
  creditBalance: number;
  address: string | null;
  loyaltyPoints: number;
  updatedAt: number;
}

export interface OfflineSession {
  id: string; // `${businessId}_${userId}`
  businessId: string;
  branchId: string | null;
  userId: string;
  userName: string;
  roleName: string;
  isOwner: boolean;
  permissions: string[];
  deviceId: string;
  sessionExpiresAt: number;
  maxOfflineHours: number; // e.g. 48h
  cachedAt: number;
  lastActiveAt: number;
}

export interface OfflineTaxRate {
  id: string;
  businessId: string;
  code: string;
  name: string;
  ratePercent: number;
  isCompound: boolean;
}

export interface OfflineSyncMeta {
  key: string; // `${businessId}_meta`
  businessId: string;
  lastSyncAt?: number;
  lastCatalogSyncAt?: number;
  deviceId: string;
}

/**
 * Robust IndexedDB database for Zentravo Offline-First POS.
 * Multi-tenant partitioned by businessId.
 */
export class ZentravoPosDatabase extends Dexie {
  salesQueue!: EntityTable<OfflineSaleQueueItem, "offlineId">;
  products!: EntityTable<OfflineProduct, "id">;
  categories!: EntityTable<OfflineCategory, "id">;
  customers!: EntityTable<OfflineCustomer, "id">;
  sessions!: EntityTable<OfflineSession, "id">;
  taxRates!: EntityTable<OfflineTaxRate, "id">;
  syncMeta!: EntityTable<OfflineSyncMeta, "key">;

  constructor(dbName = "zentravo_pos_v2") {
    super(dbName);

    this.version(1).stores({
      salesQueue: "offlineId, businessId, [businessId+status], branchId, deviceId, status, createdAt, nextRetryAt",
      products: "id, businessId, [businessId+branchId], barcode, sku, name",
      categories: "id, businessId, name",
      customers: "id, businessId, phone, name",
      sessions: "id, businessId, [businessId+deviceId]",
      taxRates: "id, businessId, code",
      syncMeta: "key, businessId",
    });
  }
}

// Singleton instance for client environment
let posDbInstance: ZentravoPosDatabase | null = null;

export function getPosDatabase(dbName?: string): ZentravoPosDatabase {
  if (typeof window === "undefined") {
    return new ZentravoPosDatabase(dbName || "zentravo_pos_ssr");
  }

  if (!posDbInstance) {
    posDbInstance = new ZentravoPosDatabase(dbName || "zentravo_pos_v2");
  }
  return posDbInstance;
}
