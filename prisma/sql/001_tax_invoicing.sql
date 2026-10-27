-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('STANDARD_RATED', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "TaxPricingMode" AS ENUM ('TAX_INCLUSIVE', 'TAX_EXCLUSIVE');

-- CreateEnum
CREATE TYPE "VatRegistrationStatus" AS ENUM ('NOT_REGISTERED', 'PENDING_REGISTRATION', 'REGISTERED');

-- CreateEnum
CREATE TYPE "TaxDocumentType" AS ENUM ('TAX_INVOICE', 'COMMERCIAL_INVOICE', 'SALES_INVOICE', 'RECEIPT', 'QUOTATION', 'PROFORMA_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "TaxDocumentStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxDirection" AS ENUM ('OUTPUT', 'INPUT');

-- CreateEnum
CREATE TYPE "TaxRoundingLevel" AS ENUM ('LINE', 'INVOICE');

-- CreateEnum
CREATE TYPE "SequenceResetPeriod" AS ENUM ('NEVER', 'YEARLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "InputVatEligibility" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "IrdSubmissionStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'VALIDATION_FAILED', 'READY', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "taxClassificationCode" TEXT;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "taxInvoicingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "exemptionCertificate" TEXT,
ADD COLUMN     "exemptionReason" TEXT,
ADD COLUMN     "exemptionValidUntil" TIMESTAMP(3),
ADD COLUMN     "isVatRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxExemptionTreatment" "TaxTreatment",
ADD COLUMN     "tin" TEXT,
ADD COLUMN     "vatRegistrationNumber" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "inputVatEligibility" "InputVatEligibility",
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRatePercent" DECIMAL(7,4),
ADD COLUMN     "taxableAmount" DECIMAL(12,2),
ADD COLUMN     "vendorInvoiceNo" TEXT,
ADD COLUMN     "vendorName" TEXT,
ADD COLUMN     "vendorTin" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "taxCategoryId" TEXT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "inputVatEligibility" "InputVatEligibility",
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierInvoiceDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tax_rates" ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "legalReference" TEXT,
ADD COLUMN     "treatment" "TaxTreatment" NOT NULL DEFAULT 'STANDARD_RATED';

-- CreateTable
CREATE TABLE "tax_rate_versions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "ratePercent" DECIMAL(7,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rate_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_categories" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "treatment" "TaxTreatment" NOT NULL DEFAULT 'STANDARD_RATED',
    "taxRateId" TEXT,
    "description" TEXT,
    "legalReference" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_tax_profiles" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "legalName" TEXT,
    "registeredAddress" TEXT,
    "registeredPhone" TEXT,
    "tin" TEXT,
    "vatStatus" "VatRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "vatRegistrationNumber" TEXT,
    "vatRegistrationDetails" TEXT,
    "registrationEffectiveDate" TIMESTAMP(3),
    "classificationCode" TEXT NOT NULL DEFAULT 'MAIN',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'LKR',
    "pricingMode" "TaxPricingMode" NOT NULL DEFAULT 'TAX_INCLUSIVE',
    "roundingLevel" "TaxRoundingLevel" NOT NULL DEFAULT 'LINE',
    "roundingMode" TEXT NOT NULL DEFAULT 'HALF_UP',
    "defaultTaxCategoryId" TEXT,
    "defaultTreatment" "TaxTreatment" NOT NULL DEFAULT 'STANDARD_RATED',
    "defaultNonTaxDocument" "TaxDocumentType" NOT NULL DEFAULT 'SALES_INVOICE',
    "showAmountInWords" BOOLEAN NOT NULL DEFAULT true,
    "showPaymentMethod" BOOLEAN NOT NULL DEFAULT true,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showUnitOfMeasure" BOOLEAN NOT NULL DEFAULT true,
    "invoiceNotes" TEXT,
    "paymentTerms" TEXT,
    "receiptFooter" TEXT,
    "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT false,
    "templateConfig" JSONB,
    "serialResetPeriod" "SequenceResetPeriod" NOT NULL DEFAULT 'NEVER',
    "serialMinDigits" INTEGER NOT NULL DEFAULT 5,
    "inputVatDefaultEligibility" "InputVatEligibility" NOT NULL DEFAULT 'UNDER_REVIEW',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_documents" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "direction" "TaxDirection" NOT NULL DEFAULT 'OUTPUT',
    "documentType" "TaxDocumentType" NOT NULL,
    "status" "TaxDocumentStatus" NOT NULL DEFAULT 'FINALIZED',
    "documentNumber" TEXT NOT NULL,
    "sequenceKey" TEXT,
    "sequenceNumber" INTEGER,
    "classificationCode" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "supplyDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "sellerName" TEXT NOT NULL,
    "sellerTin" TEXT,
    "sellerVatNumber" TEXT,
    "sellerAddress" TEXT,
    "sellerPhone" TEXT,
    "sellerVatStatus" "VatRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
    "buyerName" TEXT,
    "buyerTin" TEXT,
    "buyerVatNumber" TEXT,
    "buyerAddress" TEXT,
    "buyerPhone" TEXT,
    "customerId" TEXT,
    "supplierId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "pricingMode" "TaxPricingMode" NOT NULL,
    "roundingLevel" "TaxRoundingLevel" NOT NULL DEFAULT 'LINE',
    "grossTotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netValue" DECIMAL(14,2) NOT NULL,
    "standardRatedValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "zeroRatedValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "exemptValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outOfScopeValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "breakdown" JSONB,
    "amountInWords" TEXT,
    "paymentMethod" TEXT,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "notices" JSONB,
    "templateKey" TEXT NOT NULL,
    "complianceVersion" TEXT,
    "parentDocumentId" TEXT,
    "adjustmentReason" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "refundId" TEXT,
    "onlineOrderId" TEXT,
    "expenseId" TEXT,
    "externalDocumentNo" TEXT,
    "inputVatEligibility" "InputVatEligibility",
    "inputVatReviewedById" TEXT,
    "inputVatReviewedAt" TIMESTAMP(3),
    "inputVatReviewNote" TEXT,
    "irdStatus" "IrdSubmissionStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "externalReference" TEXT,
    "contentHash" TEXT,
    "createdById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_document_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "saleItemId" TEXT,
    "purchaseItemId" TEXT,
    "parentLineId" TEXT,
    "description" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "priceIncludesTax" BOOLEAN NOT NULL DEFAULT false,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxableValue" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "treatment" "TaxTreatment" NOT NULL,
    "ratePercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "taxRateId" TEXT,
    "taxRateVersionId" TEXT,
    "taxCategoryId" TEXT,
    "taxCategoryName" TEXT,
    "exemptionReason" TEXT,
    "meta" JSONB,

    CONSTRAINT "tax_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sequenceKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL DEFAULT 'ALL',
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_rules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "documentType" "TaxDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "minDigits" INTEGER NOT NULL DEFAULT 6,
    "resetPeriod" "SequenceResetPeriod" NOT NULL DEFAULT 'NEVER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "numbering_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_account_mappings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_integration_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'IRD_RAMIS',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "endpointUrl" TEXT,
    "clientIdEnc" TEXT,
    "clientSecretEnc" TEXT,
    "credentialsUpdatedAt" TIMESTAMP(3),
    "autoSubmit" BOOLEAN NOT NULL DEFAULT false,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "lastValidatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ird_submissions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "IrdSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "validationErrors" JSONB,
    "lastError" TEXT,
    "externalReference" TEXT,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ird_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_rate_versions_businessId_idx" ON "tax_rate_versions"("businessId");

-- CreateIndex
CREATE INDEX "tax_rate_versions_taxRateId_effectiveFrom_idx" ON "tax_rate_versions"("taxRateId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "tax_categories_businessId_idx" ON "tax_categories"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_categories_businessId_code_key" ON "tax_categories"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "business_tax_profiles_businessId_key" ON "business_tax_profiles"("businessId");

-- CreateIndex
CREATE INDEX "tax_documents_businessId_issueDate_idx" ON "tax_documents"("businessId", "issueDate");

-- CreateIndex
CREATE INDEX "tax_documents_businessId_documentType_idx" ON "tax_documents"("businessId", "documentType");

-- CreateIndex
CREATE INDEX "tax_documents_businessId_direction_supplyDate_idx" ON "tax_documents"("businessId", "direction", "supplyDate");

-- CreateIndex
CREATE INDEX "tax_documents_saleId_idx" ON "tax_documents"("saleId");

-- CreateIndex
CREATE INDEX "tax_documents_purchaseId_idx" ON "tax_documents"("purchaseId");

-- CreateIndex
CREATE INDEX "tax_documents_refundId_idx" ON "tax_documents"("refundId");

-- CreateIndex
CREATE INDEX "tax_documents_onlineOrderId_idx" ON "tax_documents"("onlineOrderId");

-- CreateIndex
CREATE INDEX "tax_documents_expenseId_idx" ON "tax_documents"("expenseId");

-- CreateIndex
CREATE INDEX "tax_documents_parentDocumentId_idx" ON "tax_documents"("parentDocumentId");

-- CreateIndex
CREATE INDEX "tax_documents_branchId_idx" ON "tax_documents"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_documents_businessId_direction_documentNumber_key" ON "tax_documents"("businessId", "direction", "documentNumber");

-- CreateIndex
CREATE INDEX "tax_document_lines_documentId_idx" ON "tax_document_lines"("documentId");

-- CreateIndex
CREATE INDEX "tax_document_lines_saleItemId_idx" ON "tax_document_lines"("saleItemId");

-- CreateIndex
CREATE INDEX "tax_document_lines_productId_idx" ON "tax_document_lines"("productId");

-- CreateIndex
CREATE INDEX "document_sequences_businessId_idx" ON "document_sequences"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_businessId_sequenceKey_periodKey_key" ON "document_sequences"("businessId", "sequenceKey", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_rules_businessId_documentType_key" ON "numbering_rules"("businessId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "tax_account_mappings_businessId_key_key" ON "tax_account_mappings"("businessId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tax_integration_settings_businessId_key" ON "tax_integration_settings"("businessId");

-- CreateIndex
CREATE INDEX "ird_submissions_businessId_status_idx" ON "ird_submissions"("businessId", "status");

-- CreateIndex
CREATE INDEX "ird_submissions_documentId_idx" ON "ird_submissions"("documentId");

-- AddForeignKey
ALTER TABLE "tax_rate_versions" ADD CONSTRAINT "tax_rate_versions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate_versions" ADD CONSTRAINT "tax_rate_versions_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_categories" ADD CONSTRAINT "tax_categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_categories" ADD CONSTRAINT "tax_categories_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_tax_profiles" ADD CONSTRAINT "business_tax_profiles_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_parentDocumentId_fkey" FOREIGN KEY ("parentDocumentId") REFERENCES "tax_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_onlineOrderId_fkey" FOREIGN KEY ("onlineOrderId") REFERENCES "online_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_document_lines" ADD CONSTRAINT "tax_document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "tax_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_rules" ADD CONSTRAINT "numbering_rules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_account_mappings" ADD CONSTRAINT "tax_account_mappings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_integration_settings" ADD CONSTRAINT "tax_integration_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ird_submissions" ADD CONSTRAINT "ird_submissions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ird_submissions" ADD CONSTRAINT "ird_submissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "tax_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

