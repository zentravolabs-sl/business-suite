import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

async function main() {
  console.log("Applying tax immutability triggers to PostgreSQL database...");
  const sqlPath = path.join(__dirname, "../prisma/sql/002_tax_immutability.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  // Neon / PG execute raw
  await prisma.$executeRawUnsafe(sql);
  console.log("✓ Tax immutability triggers applied successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error applying triggers:", err);
  process.exit(1);
});
