# Sri Lanka Inland Revenue Department (IRD) Tax & Invoicing Compliance Guide

## 1. Executive Summary & Regulatory Framework

This document outlines the architecture, configuration, and compliance guarantees of the **Sri Lanka Tax & Invoicing Suite** integrated into the Zentravo Business Suite.

### Key Statutory Instruments:
- **Value Added Tax (VAT) Act No. 14 of 2002** (as amended).
- **Gazette Extraordinary No. 2481/22** (mandatory tax invoicing standards, dual dates, buyer TIN rules).
- **Circular SEC/2026/E/03** (standardized invoice nomenclature and structure).
- **Gazette Extraordinary No. 2500/106** (official deferral of mandatory e-invoicing enforcement to **1 October 2026**).

---

## 2. Core Architectural Principles

### A. Pure, Deterministic Tax Calculation Service (`src/lib/tax/engine.ts`)
1. **Arbitrary-Precision Arithmetic**: Built entirely using `decimal.js` (precision 40, `ROUND_HALF_UP`) to eradicate IEEE-754 binary floating-point drift.
2. **Catalog Pricing Modes**:
   - **Tax-Inclusive**: Tax is extracted: $\text{Base} = \frac{\text{Price}}{1 + r}$, $\text{Tax} = \text{Price} - \text{Base}$.
   - **Tax-Exclusive**: Tax is added: $\text{Base} = \text{Price}$, $\text{Tax} = \text{Base} \times r$.
3. **Discounts Applied Before Tax**: Line-level and invoice-level discounts (distributed pro-rata by taxable value) are deducted from consideration *before* tax computation.
4. **Largest-Remainder Rounding Reconciliation**: Ensures that $\sum \text{Line Tax} = \text{Invoice Tax}$ and $\sum \text{Line Total} = \text{Grand Total}$ to the exact cent across every invoice.
5. **Partial Return Scaling**: Provides exact mathematical scaling for item returns with proportional tax refunds.

---

### B. Concurrency-Safe Statutory Numbering (`YYMMM_QQQQ_XXXXX`)
Under Section 20 of the VAT Act and IRD Circular SEC/2026/E/03:
- **Format**: `YYMMM_QQQQ_XXXXX` (e.g., `26OCT_MAIN_00001`).
  - `YY`: 2-digit Year in the `Asia/Colombo` time zone.
  - `MMM`: 3-letter Month abbreviation (`JAN` ... `DEC`).
  - `QQQQ`: Tax classification / branch code (1–15 alphanumeric uppercase characters, no spaces).
  - `XXXXX`: Zero-padded sequential atomic integer ($\ge 5$ digits).
- **Atomic Concurrency Safety**: Sequence allocation utilizes PostgreSQL atomic `INSERT ... ON CONFLICT (businessId, sequenceKey, periodKey) DO UPDATE ... RETURNING lastNumber`. No race conditions or `count() + 1` queries.

---

### C. Legal Document Classification & Split Invoicing (`src/lib/tax/document-types.ts`)
1. **Title Protection**: The heading **"TAX INVOICE"** is strictly reserved for VAT-registered entities whose registration is effective on the supply date, containing taxable supplies.
2. **Non-Registered Entities**: Automatically restricted to **"SALES INVOICE"** or **"COMMERCIAL INVOICE"** without charging VAT or displaying VAT columns.
3. **Split Invoicing for Mixed Supplies**: If a single checkout contains both taxable (Standard/Zero) and exempt/out-of-scope supplies, the system automatically splits the transaction into:
   - A **Tax Invoice** for the taxable items.
   - A **Sales Invoice** for the exempt items, with cross-referenced audit notices.
4. **Mandatory Dual Dates**: Every fiscal document explicitly records both **Date of Issue** and **Date of Supply**.
5. **Purchaser TIN Rules**: Buyer TIN is verified and formatted; mandatory when invoice total $\ge$ LKR 100,000 or when purchaser is VAT-registered.

---

### D. Double-Entry Accounting Integration (`src/lib/accounting.ts`)
Automated journal posting creates balanced entries ($ \sum \text{Debits} = \sum \text{Credits} $):
- **Sales Invoices**:
  - `Debit`: Cash (1010) / Accounts Receivable (1200) / Card Clearing (1030)
  - `Credit`: Sales Revenue (4000) / Service Revenue (4100)
  - `Credit`: **Output VAT Payable (2120)**
- **Credit Notes / Refunds**:
  - `Debit`: **Sales Returns & Allowances (4200)**
  - `Debit`: **Output VAT Payable (2120)** (reversal)
  - `Credit`: Cash / Accounts Receivable / Customer Refund
- **Purchases / Vendor Bills**:
  - `Debit`: Inventory Asset (1300) / Expense Account (5xxx / 6xxx)
  - `Debit`: **Input VAT Recoverable (1400)** (if marked `ELIGIBLE`)
  - `Credit`: Accounts Payable (2000) / Cash

---

### E. PostgreSQL Immutability Trigger
Applied to Neon PostgreSQL database:
- Trigger `zentravo_tax_documents_immutable` on table `tax_documents`.
- Disallows `UPDATE` and `DELETE` on finalized documents (`TAX_INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`).
- Safe bypass only permitted during authorized migrations via `SET LOCAL zentravo.allow_tax_doc_mutation = 'on'`.

---

### F. Future IRD RAMIS 3.0 E-Invoicing Layer (`src/lib/tax/ird-integration.ts`)
- **No Speculative Endpoints**: Designed for upcoming RAMIS 3.0 specifications without inventing fictitious IRD URLs.
- **AES-256-GCM Encryption**: Client credentials and private keys are encrypted with authenticated AES-256-GCM before database storage.
- **Pre-Transmission Validation Engine**: Validates all 11 IRD statutory constraints locally before queuing.
- **Queue & Audit Trail**: Full submission lifecycle (`QUEUED` $\to$ `PENDING` $\to$ `SUBMITTED` / `REJECTED`) with retry counters and timestamped payloads.

---

## 3. User Interface & Settings

Accessible at **Dashboard → Settings → Tax & Invoicing** (`/dashboard/settings/tax`):
1. **Tax Profile**: Legal name, 9-digit TIN, VAT status, classification code, pricing mode, rounding options.
2. **Tax Rates**: Rate cards with effective-dated versions timeline and overlap detection.
3. **Categories**: Product tax treatments (Standard 18%, Zero 0%, Exempt, Out of Scope) with linked rates.
4. **Invoice Templates**: Visual comparison between VAT-registered and non-registered layouts, logo toggles, payment terms, and Amount in Words preview.
5. **Serial Numbering**: Interactive format simulator, numbering rules editor, and real-time sequence counter monitor.
6. **Tax Reports**: Interactive VAT Return summary, Treatments Breakdown, Tax Invoice Register table, and instant CSV exports.
7. **IRD RAMIS E-Invoicing**: Environment switch, credential vault, validation engine testing tool, and statutory legal disclaimers.

---

## 4. Test Suite & Verification

The suite includes 64 automated tests passing 100%:
- `src/lib/tax/engine.test.ts` (27 tests) — Arbitrary precision, inclusive/exclusive pricing, discounts, and property-based random invoice reconciliation.
- `src/lib/tax/modules.test.ts` (27 tests) — Serial generation, zoned calendars, document splitting, rate overlaps, amount in words.
- `src/lib/tax/integration.test.ts` (10 tests) — End-to-end integration covering legal document planning, customer exemptions, discount distribution, AES-256-GCM encryption, and IRD validation.
