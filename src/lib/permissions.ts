// =============================================================================
// All granular permissions for Zentravo BMS
// Format: module.action
// =============================================================================

export const PERMISSIONS = {
  // POS
  POS_VIEW: "pos.view",
  POS_CREATE_SALE: "pos.create_sale",
  POS_EDIT_SALE: "pos.edit_sale",
  POS_CANCEL_SALE: "pos.cancel_sale",
  POS_REFUND_SALE: "pos.refund_sale",
  POS_APPLY_DISCOUNT: "pos.apply_discount",
  POS_HOLD_BILL: "pos.hold_bill",
  POS_OPEN_SHIFT: "pos.open_shift",
  POS_CLOSE_SHIFT: "pos.close_shift",

  // Products
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_EDIT: "products.edit",
  PRODUCTS_DELETE: "products.delete",
  PRODUCTS_IMPORT: "products.import",
  PRODUCTS_EXPORT: "products.export",

  // Inventory
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_TRANSFER: "inventory.transfer",
  INVENTORY_COUNT: "inventory.count",

  // Customers
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_EDIT: "customers.edit",
  CUSTOMERS_DELETE: "customers.delete",
  CUSTOMERS_CREDIT: "customers.credit",

  // Suppliers
  SUPPLIERS_VIEW: "suppliers.view",
  SUPPLIERS_CREATE: "suppliers.create",
  SUPPLIERS_EDIT: "suppliers.edit",
  SUPPLIERS_DELETE: "suppliers.delete",

  // Purchases
  PURCHASES_VIEW: "purchases.view",
  PURCHASES_CREATE: "purchases.create",
  PURCHASES_EDIT: "purchases.edit",
  PURCHASES_APPROVE: "purchases.approve",
  PURCHASES_PAYMENT: "purchases.payment",

  // Accounting
  ACCOUNTING_VIEW: "accounting.view",
  ACCOUNTING_CREATE_JOURNAL: "accounting.create_journal",
  ACCOUNTING_EDIT_JOURNAL: "accounting.edit_journal",
  ACCOUNTING_VIEW_REPORTS: "accounting.view_reports",

  // Expenses
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_EDIT: "expenses.edit",
  EXPENSES_APPROVE: "expenses.approve",
  EXPENSES_DELETE: "expenses.delete",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_FINANCIAL: "reports.financial",
  REPORTS_EXPORT: "reports.export",

  // Warranty
  WARRANTY_VIEW: "warranty.view",
  WARRANTY_CREATE: "warranty.create",
  WARRANTY_EDIT: "warranty.edit",
  WARRANTY_VOID: "warranty.void",
  WARRANTY_PROCESS_CLAIM: "warranty.process_claim",

  // Service
  SERVICE_VIEW: "service.view",
  SERVICE_CREATE: "service.create",
  SERVICE_EDIT: "service.edit",
  SERVICE_DELETE: "service.delete",
  SERVICE_UPDATE_STATUS: "service.update_status",
  SERVICE_ADD_PARTS: "service.add_parts",

  // Orders
  ORDERS_VIEW: "orders.view",
  ORDERS_MANAGE: "orders.manage",
  ORDERS_CANCEL: "orders.cancel",

  // Online Store
  STORE_VIEW: "store.view",
  STORE_MANAGE: "store.manage",

  // Loyalty
  LOYALTY_VIEW: "loyalty.view",
  LOYALTY_MANAGE: "loyalty.manage",

  // Marketing
  MARKETING_VIEW: "marketing.view",
  MARKETING_CREATE: "marketing.create",
  MARKETING_SEND: "marketing.send",

  // Users
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",
  USERS_MANAGE_ROLES: "users.manage_roles",

  // Branches
  BRANCHES_VIEW: "branches.view",
  BRANCHES_CREATE: "branches.create",
  BRANCHES_EDIT: "branches.edit",

  // Settings
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",

  // AI
  AI_VIEW: "ai.view",
  AI_QUERY: "ai.query",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Default permissions per system role
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: Object.values(PERMISSIONS), // All permissions

  MANAGER: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE_SALE,
    PERMISSIONS.POS_EDIT_SALE,
    PERMISSIONS.POS_CANCEL_SALE,
    PERMISSIONS.POS_REFUND_SALE,
    PERMISSIONS.POS_APPLY_DISCOUNT,
    PERMISSIONS.POS_HOLD_BILL,
    PERMISSIONS.POS_OPEN_SHIFT,
    PERMISSIONS.POS_CLOSE_SHIFT,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_EDIT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.CUSTOMERS_CREDIT,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_APPROVE,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.WARRANTY_VIEW,
    PERMISSIONS.WARRANTY_CREATE,
    PERMISSIONS.SERVICE_VIEW,
    PERMISSIONS.SERVICE_CREATE,
    PERMISSIONS.SERVICE_EDIT,
    PERMISSIONS.SERVICE_UPDATE_STATUS,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.BRANCHES_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.AI_VIEW,
    PERMISSIONS.AI_QUERY,
    PERMISSIONS.LOYALTY_VIEW,
    PERMISSIONS.LOYALTY_MANAGE,
    PERMISSIONS.MARKETING_VIEW,
  ],

  ACCOUNTANT: [
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.ACCOUNTING_CREATE_JOURNAL,
    PERMISSIONS.ACCOUNTING_EDIT_JOURNAL,
    PERMISSIONS.ACCOUNTING_VIEW_REPORTS,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
  ],

  CASHIER: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE_SALE,
    PERMISSIONS.POS_HOLD_BILL,
    PERMISSIONS.POS_OPEN_SHIFT,
    PERMISSIONS.POS_CLOSE_SHIFT,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.WARRANTY_VIEW,
  ],

  STOCK_MANAGER: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_EDIT,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_COUNT,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.SUPPLIERS_VIEW,
  ],

  TECHNICIAN: [
    PERMISSIONS.SERVICE_VIEW,
    PERMISSIONS.SERVICE_EDIT,
    PERMISSIONS.SERVICE_UPDATE_STATUS,
    PERMISSIONS.SERVICE_ADD_PARTS,
    PERMISSIONS.WARRANTY_VIEW,
    PERMISSIONS.WARRANTY_PROCESS_CLAIM,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
  ],

  SALES_STAFF: [
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE_SALE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.ORDERS_VIEW,
  ],

  DELIVERY_STAFF: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.CUSTOMERS_VIEW,
  ],
};

export const SYSTEM_ROLES = Object.keys(ROLE_PERMISSIONS);

export function hasPermission(
  userPermissions: string[] | undefined | null,
  requiredPermission: Permission | string
): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  // If user has all permissions or matches exact permission
  return userPermissions.includes("*") || userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
  userPermissions: string[] | undefined | null,
  requiredPermissions: (Permission | string)[]
): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes("*")) return true;
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: string[] | undefined | null,
  requiredPermissions: (Permission | string)[]
): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes("*")) return true;
  return requiredPermissions.every((p) => userPermissions.includes(p));
}
