import { describe, it, expect } from "vitest";
import { validateCronRequest, timingSafeCompare } from "./cron-auth";

describe("Advisor Cron Authentication & Fail-Closed Guard", () => {
  const SECRET = "super-secret-production-cron-token-xyz123";

  describe("1. Production Environment (Fail-Closed Enforcement)", () => {
    it("strictly blocks request when CRON_SECRET is not configured (fail-closed)", () => {
      const result = validateCronRequest("Bearer some-token", null, {
        cronSecret: "",
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain("fail-closed");
    });

    it("blocks request when CRON_SECRET is undefined in production", () => {
      const result = validateCronRequest("Bearer some-token", null, {
        cronSecret: undefined,
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain("fail-closed");
    });

    it("rejects unauthenticated requests when no token or secret is supplied", () => {
      const result = validateCronRequest(null, null, {
        cronSecret: SECRET,
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain("Invalid or missing");
    });

    it("rejects request when token does not match CRON_SECRET", () => {
      const result = validateCronRequest("Bearer wrong-secret-token", null, {
        cronSecret: SECRET,
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain("Invalid or missing");
    });

    it("authorizes request with valid Bearer token header in production", () => {
      const result = validateCronRequest(`Bearer ${SECRET}`, null, {
        cronSecret: SECRET,
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.error).toBeUndefined();
    });

    it("authorizes request with valid query secret parameter in production", () => {
      const result = validateCronRequest(null, SECRET, {
        cronSecret: SECRET,
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.error).toBeUndefined();
    });

    it("handles case-insensitive Bearer prefix and extra whitespace correctly", () => {
      const result = validateCronRequest(`bearer   ${SECRET}  `, null, {
        cronSecret: SECRET,
        nodeEnv: "production",
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });

  describe("2. Non-Production Environment (Development / Testing)", () => {
    it("allows execution when CRON_SECRET is not configured in development for ease of testing", () => {
      const result = validateCronRequest(null, null, {
        cronSecret: "",
        nodeEnv: "development",
      });

      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it("verifies token if CRON_SECRET is explicitly configured even in development", () => {
      const invalid = validateCronRequest("Bearer bad-token", null, {
        cronSecret: "dev-secret",
        nodeEnv: "development",
      });
      expect(invalid.authorized).toBe(false);
      expect(invalid.statusCode).toBe(401);

      const valid = validateCronRequest("Bearer dev-secret", null, {
        cronSecret: "dev-secret",
        nodeEnv: "development",
      });
      expect(valid.authorized).toBe(true);
      expect(valid.statusCode).toBe(200);
    });
  });

  describe("3. Timing-Safe Comparison Utility", () => {
    it("accurately compares identical strings", () => {
      expect(timingSafeCompare("abcdef123456", "abcdef123456")).toBe(true);
    });

    it("returns false for different strings of same length", () => {
      expect(timingSafeCompare("abcdef123456", "abcdef123457")).toBe(false);
    });

    it("returns false for strings of different lengths without throwing", () => {
      expect(timingSafeCompare("short", "much-longer-string")).toBe(false);
      expect(timingSafeCompare("", "non-empty")).toBe(false);
    });
  });
});
