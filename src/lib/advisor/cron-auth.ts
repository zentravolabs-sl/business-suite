import crypto from "crypto";

export interface CronAuthOptions {
  cronSecret?: string;
  nodeEnv?: string;
}

export interface CronAuthResult {
  authorized: boolean;
  statusCode: number;
  error?: string;
}

/**
 * Timing-safe string comparison to protect against side-channel timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Validates request authentication for advisor cron endpoints.
 *
 * Rules:
 * 1. In production (nodeEnv === "production"):
 *    - CRON_SECRET is strictly mandatory (fail-closed: returns 401 Unauthorized if missing/empty).
 *    - Request must supply a matching Bearer token or 'secret' query param.
 * 2. In non-production (development / test):
 *    - If CRON_SECRET is configured, matching token is strictly verified.
 *    - If CRON_SECRET is not configured, allowed for local convenience with a warning.
 */
export function validateCronRequest(
  authHeader: string | null | undefined,
  querySecret: string | null | undefined,
  options: CronAuthOptions = {}
): CronAuthResult {
  const cronSecret = (options.cronSecret ?? process.env.CRON_SECRET)?.trim();
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === "production";

  // Production requirement: CRON_SECRET must be configured
  if (!cronSecret) {
    if (isProduction) {
      return {
        authorized: false,
        statusCode: 401,
        error: "Unauthorized: CRON_SECRET is not configured on this server (fail-closed)",
      };
    }
    // Local development/test fallback when secret is not configured
    return {
      authorized: true,
      statusCode: 200,
    };
  }

  // Extract Bearer token from Authorization header or 'secret' query param
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim() || querySecret?.trim();

  if (!token || !timingSafeCompare(token, cronSecret)) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Invalid or missing cron secret",
    };
  }

  return {
    authorized: true,
    statusCode: 200,
  };
}
