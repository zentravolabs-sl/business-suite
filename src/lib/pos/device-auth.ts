import { getPosDatabase, OfflineSaleQueueItem, OfflineSession, ZentravoPosDatabase } from "./offline-db";

const DEVICE_ID_KEY = "zentravo_pos_device_id";
const DEFAULT_MAX_OFFLINE_HOURS = 48; // 48 hours offline session limit

/**
 * Returns or generates a durable UUID for this POS terminal/browser.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-environment-device";
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = "DEV-" + crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return "DEV-ephemeral-device";
  }
}

export interface CacheSessionParams {
  businessId: string;
  branchId: string | null;
  userId: string;
  userName: string;
  roleName: string;
  isOwner: boolean;
  permissions: string[];
  maxOfflineHours?: number;
  db?: ZentravoPosDatabase;
}

/**
 * Persists an authenticated user session into IndexedDB for offline operation.
 */
export async function cacheDeviceSession(params: CacheSessionParams): Promise<OfflineSession> {
  const db = params.db || getPosDatabase();
  const deviceId = getOrCreateDeviceId();
  const now = Date.now();
  const maxHours = params.maxOfflineHours || DEFAULT_MAX_OFFLINE_HOURS;
  const sessionExpiresAt = now + maxHours * 60 * 60 * 1000;

  const sessionRecord: OfflineSession = {
    id: `${params.businessId}_${params.userId}`,
    businessId: params.businessId,
    branchId: params.branchId,
    userId: params.userId,
    userName: params.userName,
    roleName: params.roleName,
    isOwner: params.isOwner,
    permissions: params.permissions || [],
    deviceId,
    sessionExpiresAt,
    maxOfflineHours: maxHours,
    cachedAt: now,
    lastActiveAt: now,
  };

  await db.sessions.put(sessionRecord);
  return sessionRecord;
}

export interface OfflineAuthResult {
  valid: boolean;
  session: OfflineSession | null;
  reason?: "NO_CACHED_SESSION" | "DEVICE_MISMATCH" | "SESSION_EXPIRED" | "VALID";
}

/**
 * Validates whether the current device is authorized to operate offline.
 */
export async function validateOfflineSession(
  businessId: string,
  userId: string,
  db?: ZentravoPosDatabase
): Promise<OfflineAuthResult> {
  const database = db || getPosDatabase();
  const deviceId = getOrCreateDeviceId();
  const id = `${businessId}_${userId}`;

  const session = await database.sessions.get(id);
  if (!session) {
    return { valid: false, session: null, reason: "NO_CACHED_SESSION" };
  }

  if (session.deviceId !== deviceId) {
    return { valid: false, session: null, reason: "DEVICE_MISMATCH" };
  }

  const now = Date.now();
  if (now > session.sessionExpiresAt) {
    return { valid: false, session, reason: "SESSION_EXPIRED" };
  }

  // Update last active
  session.lastActiveAt = now;
  await database.sessions.put(session);

  return { valid: true, session, reason: "VALID" };
}

/**
 * Checks if a cached offline session has the required permission.
 */
export function checkOfflinePermission(
  session: OfflineSession | null,
  permission: string
): boolean {
  if (!session) return false;
  if (session.isOwner) return true;
  return session.permissions.includes(permission);
}

/**
 * Retrieves the count of unsynchronized sales across all businesses or for a specific business.
 * Safe for multi-tenant switching.
 */
export async function getPendingSalesCountByBusiness(
  businessId?: string,
  db?: ZentravoPosDatabase
): Promise<number> {
  const database = db || getPosDatabase();
  if (businessId) {
    return database.salesQueue
      .where("[businessId+status]")
      .anyOf([businessId, "PENDING"], [businessId, "SYNCING"], [businessId, "FAILED"])
      .count();
  }
  return database.salesQueue
    .where("status")
    .anyOf("PENDING", "SYNCING", "FAILED")
    .count();
}

export interface SafeSignOutResult {
  pendingCount: number;
  hasUnsyncedSales: boolean;
  warning?: string;
}

/**
 * Safely handles user logout or business switching on shared POS devices:
 * 1. Checks if there are pending unsynced sales.
 * 2. Clears private session credentials from local IndexedDB (without touching salesQueue).
 * 3. Signals Service Worker to evict any cached private route responses.
 * 4. Preserves all unsynced sales in IndexedDB for the authorized recovery workflow.
 */
export async function handleSafeSignOut(
  businessId?: string,
  userId?: string,
  db?: ZentravoPosDatabase
): Promise<SafeSignOutResult> {
  const database = db || getPosDatabase();
  const pendingCount = await getPendingSalesCountByBusiness(businessId, database);

  // Clear cached sessions for this user/business to prevent offline session replay
  try {
    if (businessId && userId) {
      await database.sessions.delete(`${businessId}_${userId}`);
    } else if (businessId) {
      await database.sessions.where("businessId").equals(businessId).delete();
    } else {
      await database.sessions.clear();
    }
  } catch (err) {
    console.warn("Failed to clear offline session record:", err);
  }

  // Post message to Service Worker to purge private cached responses
  if (typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
    } catch {
      // ignore
    }
  }

  return {
    pendingCount,
    hasUnsyncedSales: pendingCount > 0,
    warning:
      pendingCount > 0
        ? `${pendingCount} unsynced sale(s) remain safely preserved in local storage. They can be synchronized when an authorized user logs back in.`
        : undefined,
  };
}

/**
 * Recovery Flow: Fetches all unsynced sales for a business so an authorized cashier or manager
 * can review, manually push, or export an emergency audit backup file.
 */
export async function getUnsyncedSalesForRecovery(
  businessId?: string,
  db?: ZentravoPosDatabase
): Promise<OfflineSaleQueueItem[]> {
  const database = db || getPosDatabase();
  if (businessId) {
    return database.salesQueue
      .where("[businessId+status]")
      .anyOf([businessId, "PENDING"], [businessId, "SYNCING"], [businessId, "FAILED"], [businessId, "CONFLICT"])
      .toArray();
  }
  return database.salesQueue
    .where("status")
    .anyOf("PENDING", "SYNCING", "FAILED", "CONFLICT")
    .toArray();
}

/**
 * Recovery Flow: Generates a downloadable JSON backup blob of unsynced transactions.
 */
export async function exportUnsyncedSalesBackup(
  businessId?: string,
  db?: ZentravoPosDatabase
): Promise<string> {
  const sales = await getUnsyncedSalesForRecovery(businessId, db);
  const backup = {
    exportedAt: new Date().toISOString(),
    businessId: businessId || "ALL",
    deviceId: getOrCreateDeviceId(),
    totalCount: sales.length,
    sales,
  };
  return JSON.stringify(backup, null, 2);
}
