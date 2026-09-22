import { PrismaClient } from "@prisma/client";

// Prisma v7 requires a driver adapter for database connections.
// We use @prisma/adapter-neon for Vercel Edge / serverless (Next.js route handlers)
// and @prisma/adapter-pg for Node.js environments (seed, tests).

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Determine environment - use pg adapter for Node.js, neon for edge
  const isEdge =
    typeof (globalThis as unknown as { EdgeRuntime?: string }).EdgeRuntime !== "undefined" ||
    process.env.NEXT_RUNTIME === "edge";

  if (isEdge) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const sql = neon(connectionString);
    const adapter = new PrismaNeon(sql);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  } else {
    // Node.js environment (server components, API routes, seed, tests)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
