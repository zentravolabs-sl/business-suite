# Zentravo BMS — Setup & Developer Guide

This guide walks you through setting up and running Zentravo BMS locally or in production.

---

## 1. System Requirements

- **Node.js**: v18.17+ or v20+ recommended
- **Package Manager**: npm or pnpm
- **Database**: PostgreSQL (Neon Serverless PostgreSQL recommended)

---

## 2. Environment Configuration

1. Duplicate `.env.example` to `.env` (and `.env.local` for Next.js):
   ```bash
   cp .env.example .env
   cp .env.example .env.local
   ```

2. Configure your database connection strings:
   ```env
   DATABASE_URL="postgresql://neondb_owner:[PASSWORD]@[HOST]/neondb?sslmode=require"
   DIRECT_URL="postgresql://neondb_owner:[PASSWORD]@[HOST]/neondb?sslmode=require"
   ```

3. Configure authentication secret:
   ```env
   AUTH_SECRET="super-secret-random-key-at-least-32-characters"
   AUTH_URL="http://localhost:3000"
   NEXTAUTH_URL="http://localhost:3000"
   ```

---

## 3. Database Migration & Seeding

1. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Push Schema to PostgreSQL Database:**
   ```bash
   npx prisma db push
   ```

3. **Seed Demo Data (ABC Electronics & Multi-Branch Demo):**
   ```bash
   node run-seed.js
   ```

   This populates:
   - 4 Subscription Plans (Starter, Business, Professional, Enterprise)
   - 78 Granular Permissions & 8 System Roles
   - ABC Electronics Demo Business with 2 Branches (Colombo & Kalutara)
   - 8 Demo Products with Barcodes & Stock
   - Demo Customers, Suppliers, Expense Categories, and Chart of Accounts
   - 5 Demo Staff Users

4. **Launch Prisma Studio (Optional GUI DB Inspector):**
   ```bash
   npx prisma studio
   ```

---

## 4. Running the Application

1. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

2. **Build for Production:**
   ```bash
   npm run build
   npm run start
   ```

---

## 5. Demo Credentials

Use any of these pre-seeded accounts to explore the system:

| Role | Email | Password | Access / Notes |
|---|---|---|---|
| **Owner** | `owner@example.com` | `Demo@2026` | Full access to all business modules, financial reports, & settings |
| **Cashier** | `cashier@example.com` | `Demo@2026` | POS billing, customer search, cash drawer shifts, and receipt printing |
| **Accountant** | `accountant@example.com` | `Demo@2026` | General ledger, journal entries, P&L, balance sheet, & tax reports |
| **Technician** | `technician@example.com` | `Demo@2026` | Warranty claims verification, repair job tickets, & parts usage |
| **Manager** | `manager@example.com` | `Demo@2026` | Branch inventory adjustments, supplier purchasing, & staff management |

---

## 6. Key Application Routes

- **Sign In**: `/login`
- **Dashboard Overview**: `/dashboard`
- **Business Onboarding Wizard**: `/onboarding`
- **Super Admin Panel**: `/super-admin`
- **Universal Command Search**: Press `Ctrl+K` or click the search bar anywhere in the dashboard
