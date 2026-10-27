import { Prisma } from "@prisma/client";
import {
  formatSimpleNumber,
  formatTaxInvoiceSerial,
  sequencePeriodKey,
} from "./numbering";
import type { SequenceResetPeriod, TaxDocumentType } from "./constants";

export interface AllocateTaxInvoiceSerialOptions {
  businessId: string;
  classificationCode: string;
  issueDate: Date;
  resetPeriod?: SequenceResetPeriod;
  minDigits?: number;
  timeZone?: string;
}

export interface AllocateSimpleNumberOptions {
  businessId: string;
  documentType: TaxDocumentType | string;
  prefix: string;
  issueDate?: Date;
  resetPeriod?: SequenceResetPeriod;
  minDigits?: number;
}

/**
 * Concurrency-safe counter allocator using atomic row-locked UPSERT in PostgreSQL.
 * NEVER uses count() + 1.
 */
export async function allocateNextSequence(
  tx: Prisma.TransactionClient,
  businessId: string,
  sequenceKey: string,
  periodKey: string = "ALL"
): Promise<number> {
  // Use raw PostgreSQL atomic UPSERT with RETURNING to guarantee serialisation even under high concurrency
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>(
    Prisma.sql`
      INSERT INTO "document_sequences" ("id", "businessId", "sequenceKey", "periodKey", "lastNumber", "updatedAt")
      VALUES (
        concat('seq_', md5(random()::text || clock_timestamp()::text)),
        ${businessId},
        ${sequenceKey},
        ${periodKey},
        1,
        NOW()
      )
      ON CONFLICT ("businessId", "sequenceKey", "periodKey")
      DO UPDATE SET
        "lastNumber" = "document_sequences"."lastNumber" + 1,
        "updatedAt" = NOW()
      RETURNING "lastNumber";
    `
  );

  if (!rows || rows.length === 0) {
    throw new Error(`Failed to allocate sequence for key "${sequenceKey}"`);
  }

  return Number(rows[0].lastNumber);
}

/**
 * Allocates a format-compliant Tax Invoice Serial: YYMMM_QQQQ_XXXXX
 */
export async function allocateTaxInvoiceSerial(
  tx: Prisma.TransactionClient,
  opts: AllocateTaxInvoiceSerialOptions
): Promise<{ serial: string; sequenceNumber: number; periodKey: string; sequenceKey: string }> {
  const resetPeriod = opts.resetPeriod ?? "NEVER";
  const periodKey = sequencePeriodKey(resetPeriod, opts.issueDate, opts.timeZone);
  const sequenceKey = `TAX_INVOICE:${opts.classificationCode.trim().toUpperCase()}`;

  const sequenceNumber = await allocateNextSequence(tx, opts.businessId, sequenceKey, periodKey);

  const serial = formatTaxInvoiceSerial({
    issueDate: opts.issueDate,
    classificationCode: opts.classificationCode,
    sequence: sequenceNumber,
    minDigits: opts.minDigits ?? 5,
    timeZone: opts.timeZone,
  });

  return { serial, sequenceNumber, periodKey, sequenceKey };
}

/**
 * Allocates a format-compliant number for non-tax documents (Credit Note, Debit Note, Sales Invoice, etc.)
 */
export async function allocateDocumentNumber(
  tx: Prisma.TransactionClient,
  opts: AllocateSimpleNumberOptions
): Promise<{ documentNumber: string; sequenceNumber: number; periodKey: string; sequenceKey: string }> {
  const resetPeriod = opts.resetPeriod ?? "NEVER";
  const date = opts.issueDate ?? new Date();
  const periodKey = sequencePeriodKey(resetPeriod, date);
  const sequenceKey = `DOC:${opts.documentType}`;

  const sequenceNumber = await allocateNextSequence(tx, opts.businessId, sequenceKey, periodKey);
  const documentNumber = formatSimpleNumber(opts.prefix, sequenceNumber, opts.minDigits ?? 6);

  return { documentNumber, sequenceNumber, periodKey, sequenceKey };
}

import { formatBusinessDate } from "./dates";

/**
 * Concurrency-safe Journal Entry number allocation.
 */
export async function allocateJournalEntryNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  prefix: string = "JE",
  date: Date = new Date()
): Promise<string> {
  const year = formatBusinessDate(date).slice(0, 4);
  const sequenceKey = `JOURNAL:${prefix}`;
  const seq = await allocateNextSequence(tx, businessId, sequenceKey, year);
  return `${prefix}-${year}-${seq.toString().padStart(5, "0")}`;
}
