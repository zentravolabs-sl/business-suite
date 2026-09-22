/**
 * Seed script to create an initial AdminUser for the super admin panel.
 * Run with: node scripts/seed-admin.js
 */

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || "superadmin@zentravo.com";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "Admin@2026!";
const ADMIN_NAME = "Super Admin";

async function main() {
  const pool = new Pool({ connectionString });

  try {
    // Check if already exists
    const { rows: existing } = await pool.query(
      "SELECT id FROM admin_users WHERE email = $1",
      [ADMIN_EMAIL]
    );

    if (existing.length > 0) {
      console.log(`✓ AdminUser already exists: ${ADMIN_EMAIL}`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const now = new Date().toISOString();
    const cuid = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await pool.query(
      `INSERT INTO admin_users (id, email, name, "passwordHash", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, $5, $5)`,
      [cuid, ADMIN_EMAIL, ADMIN_NAME, passwordHash, now]
    );

    console.log("✅ AdminUser created successfully!");
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   URL:      http://localhost:3000/admin/login`);
  } catch (err) {
    console.error("Error seeding admin user:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
