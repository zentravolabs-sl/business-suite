import { z } from "zod";

// Sri Lankan phone number validation
const sriLankanPhone = z
  .string()
  .min(9, "Phone number is too short")
  .max(15, "Phone number is too long")
  .regex(
    /^(\+94|0094|0)?[1-9][0-9]{8}$/,
    "Enter a valid Sri Lankan phone number"
  );

// =============================================================================
// Auth Schemas
// =============================================================================

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    phone: sriLankanPhone.optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and a number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const otpRequestSchema = z.object({
  phone: sriLankanPhone,
  purpose: z.enum(["LOGIN", "REGISTRATION", "CUSTOMER_LOGIN"]),
});

export const otpVerifySchema = z.object({
  phone: sriLankanPhone,
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must be numeric"),
  purpose: z.enum(["LOGIN", "REGISTRATION", "CUSTOMER_LOGIN"]),
});

// =============================================================================
// Business Schemas
// =============================================================================

export const businessInfoSchema = z.object({
  name: z.string().min(2, "Business name is required").max(200),
  legalName: z.string().optional(),
  category: z.enum([
    "GROCERY",
    "SUPERMARKET",
    "ELECTRONICS",
    "MOBILE_PHONES",
    "COMPUTERS",
    "APPLIANCES",
    "HARDWARE",
    "FASHION",
    "PHARMACY",
    "COSMETICS",
    "SPARE_PARTS",
    "DISTRIBUTOR",
    "SERVICE_REPAIR",
    "GENERAL_RETAIL",
    "OTHER",
  ]),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: sriLankanPhone.optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  businessRegNo: z.string().optional(),
  taxNumber: z.string().optional(),
  vatNumber: z.string().optional(),
});

export const branchSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: sriLankanPhone.optional(),
  openingCash: z.coerce.number().min(0).default(0),
});

export const taxSettingsSchema = z.object({
  taxEnabled: z.boolean(),
  taxName: z.string().default("VAT"),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().default(false),
});

export const invoiceSettingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(10).default("INV"),
  receiptPrefix: z.string().min(1).max(10).default("RCP"),
  quotationPrefix: z.string().min(1).max(10).default("QT"),
  purchaseOrderPrefix: z.string().min(1).max(10).default("PO"),
  invoiceFooter: z.string().optional(),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
  thankYouMessage: z.string().optional(),
});

// =============================================================================
// Product Schemas
// =============================================================================

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(300),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  taxRateId: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.coerce.number().min(0, "Cost price must be positive"),
  retailPrice: z.coerce.number().min(0, "Retail price must be positive"),
  wholesalePrice: z.coerce.number().min(0).optional(),
  vipPrice: z.coerce.number().min(0).optional(),
  minSellingPrice: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  isSerialTracked: z.boolean().default(false),
  isBatchTracked: z.boolean().default(false),
  hasVariants: z.boolean().default(false),
  warrantyMonths: z.coerce.number().int().min(0).optional(),
  warrantyType: z.enum(["MANUFACTURER", "SELLER", "SERVICE", "EXTENDED"]).optional(),
  warrantyTerms: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  onlineVisible: z.boolean().default(true),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  parentId: z.string().optional(),
  description: z.string().optional(),
});

// =============================================================================
// Customer Schemas
// =============================================================================

export const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(200),
  phone: sriLankanPhone.optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  notes: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  isVip: z.boolean().default(false),
});

// =============================================================================
// Sale / POS Schemas
// =============================================================================

export const saleItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  batchId: z.string().optional(),
  serialNumber: z.string().optional(),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  unitPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  discountType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
  discountValue: z.coerce.number().min(0).default(0),
  warrantyMonths: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "QR_CODE", "CREDIT", "CHEQUE", "ONLINE", "LOYALTY_POINTS", "SPLIT"]),
  amount: z.coerce.number().positive(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const createSaleSchema = z.object({
  branchId: z.string(),
  customerId: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "At least one item required"),
  payments: z.array(paymentSchema).min(1, "At least one payment required"),
  discountType: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  discountValue: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  offlineId: z.string().optional(), // Idempotency key
});

// =============================================================================
// Purchase Schemas
// =============================================================================

export const purchaseOrderItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string(),
  branchId: z.string(),
  items: z.array(purchaseOrderItemSchema).min(1),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
});

export const purchaseItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  serialNumbers: z.array(z.string()).default([]),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string(),
  branchId: z.string(),
  purchaseOrderId: z.string().optional(),
  supplierInvoice: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1),
  receivedDate: z.string().optional(),
  notes: z.string().optional(),
});

// =============================================================================
// Warranty Schemas
// =============================================================================

export const warrantyClaimSchema = z.object({
  warrantyId: z.string(),
  problem: z.string().min(5, "Please describe the problem"),
  description: z.string().optional(),
  preferredDate: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: sriLankanPhone.optional(),
});

// =============================================================================
// Service Ticket Schemas
// =============================================================================

export const serviceTicketSchema = z.object({
  customerId: z.string().optional(),
  productId: z.string().optional(),
  technicianId: z.string().optional(),
  deviceName: z.string().optional(),
  serialNumber: z.string().optional(),
  issue: z.string().min(5, "Please describe the issue"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  estimatedCost: z.coerce.number().min(0).optional(),
  isWarranty: z.boolean().default(false),
  warrantyId: z.string().optional(),
  notes: z.string().optional(),
});

// =============================================================================
// Expense Schemas
// =============================================================================

export const expenseSchema = z.object({
  categoryId: z.string().optional(),
  branchId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "QR_CODE", "CREDIT", "CHEQUE", "ONLINE", "LOYALTY_POINTS", "SPLIT"]).default("CASH"),
  reference: z.string().optional(),
  notes: z.string().optional(),
  expenseDate: z.string().optional(),
});

// =============================================================================
// Supplier Schemas
// =============================================================================

export const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  contactPerson: z.string().optional(),
  phone: sriLankanPhone.optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  taxNumber: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  paymentTermDays: z.coerce.number().int().min(0).default(30),
  notes: z.string().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type WarrantyClaimInput = z.infer<typeof warrantyClaimSchema>;
export type ServiceTicketInput = z.infer<typeof serviceTicketSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
