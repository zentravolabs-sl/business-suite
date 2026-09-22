import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Load .env for DATABASE_URL
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log("🌱 Starting Zentravo BMS seed...");

  // ============================================================
  // 1. PLANS
  // ============================================================
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { type: "STARTER" },
      update: {},
      create: {
        name: "Starter",
        type: "STARTER",
        description: "Perfect for small retail shops",
        monthlyPrice: 2990,
        annualPrice: 29900,
        trialDays: 14,
        maxBranches: 1,
        maxUsers: 3,
        maxProducts: 500,
        maxMonthlySales: 500,
        aiAssistant: false,
        ecommerce: false,
        loyalty: true,
        sortOrder: 1,
      },
    }),
    prisma.plan.upsert({
      where: { type: "BUSINESS" },
      update: {},
      create: {
        name: "Business",
        type: "BUSINESS",
        description: "For growing retail businesses",
        monthlyPrice: 5990,
        annualPrice: 59900,
        trialDays: 14,
        maxBranches: 3,
        maxUsers: 10,
        maxProducts: 2000,
        maxMonthlySales: 2000,
        aiAssistant: false,
        ecommerce: true,
        loyalty: true,
        marketing: true,
        sortOrder: 2,
      },
    }),
    prisma.plan.upsert({
      where: { type: "PROFESSIONAL" },
      update: {},
      create: {
        name: "Professional",
        type: "PROFESSIONAL",
        description: "Advanced features for serious retailers",
        monthlyPrice: 9990,
        annualPrice: 99900,
        trialDays: 14,
        maxBranches: 10,
        maxUsers: 25,
        maxProducts: 10000,
        maxMonthlySales: 10000,
        aiAssistant: true,
        ecommerce: true,
        loyalty: true,
        marketing: true,
        advancedReports: true,
        sortOrder: 3,
      },
    }),
    prisma.plan.upsert({
      where: { type: "ENTERPRISE" },
      update: {},
      create: {
        name: "Enterprise",
        type: "ENTERPRISE",
        description: "Unlimited scale for large operations",
        monthlyPrice: 24990,
        annualPrice: 249900,
        trialDays: 30,
        maxBranches: 999,
        maxUsers: 999,
        maxProducts: 999999,
        maxMonthlySales: 999999,
        aiAssistant: true,
        ecommerce: true,
        loyalty: true,
        marketing: true,
        advancedReports: true,
        apiAccess: true,
        sortOrder: 4,
      },
    }),
  ]);

  console.log(`✅ Created ${plans.length} plans`);

  // ============================================================
  // 2. PERMISSIONS
  // ============================================================
  const permissionDefs = [
    // POS
    { module: "pos", action: "view", key: "pos.view", description: "View POS" },
    { module: "pos", action: "create_sale", key: "pos.create_sale", description: "Create sales" },
    { module: "pos", action: "edit_sale", key: "pos.edit_sale", description: "Edit sales" },
    { module: "pos", action: "cancel_sale", key: "pos.cancel_sale", description: "Cancel sales" },
    { module: "pos", action: "refund_sale", key: "pos.refund_sale", description: "Refund sales" },
    { module: "pos", action: "apply_discount", key: "pos.apply_discount", description: "Apply discounts" },
    { module: "pos", action: "hold_bill", key: "pos.hold_bill", description: "Hold/resume bills" },
    { module: "pos", action: "open_shift", key: "pos.open_shift", description: "Open cashier shift" },
    { module: "pos", action: "close_shift", key: "pos.close_shift", description: "Close cashier shift" },
    // Products
    { module: "products", action: "view", key: "products.view", description: "View products" },
    { module: "products", action: "create", key: "products.create", description: "Create products" },
    { module: "products", action: "edit", key: "products.edit", description: "Edit products" },
    { module: "products", action: "delete", key: "products.delete", description: "Delete products" },
    { module: "products", action: "import", key: "products.import", description: "Import products" },
    { module: "products", action: "export", key: "products.export", description: "Export products" },
    // Inventory
    { module: "inventory", action: "view", key: "inventory.view", description: "View inventory" },
    { module: "inventory", action: "adjust", key: "inventory.adjust", description: "Adjust stock" },
    { module: "inventory", action: "transfer", key: "inventory.transfer", description: "Transfer stock" },
    { module: "inventory", action: "count", key: "inventory.count", description: "Count stock" },
    // Customers
    { module: "customers", action: "view", key: "customers.view", description: "View customers" },
    { module: "customers", action: "create", key: "customers.create", description: "Create customers" },
    { module: "customers", action: "edit", key: "customers.edit", description: "Edit customers" },
    { module: "customers", action: "delete", key: "customers.delete", description: "Delete customers" },
    { module: "customers", action: "credit", key: "customers.credit", description: "Manage credit" },
    // Suppliers
    { module: "suppliers", action: "view", key: "suppliers.view", description: "View suppliers" },
    { module: "suppliers", action: "create", key: "suppliers.create", description: "Create suppliers" },
    { module: "suppliers", action: "edit", key: "suppliers.edit", description: "Edit suppliers" },
    { module: "suppliers", action: "delete", key: "suppliers.delete", description: "Delete suppliers" },
    // Purchases
    { module: "purchases", action: "view", key: "purchases.view", description: "View purchases" },
    { module: "purchases", action: "create", key: "purchases.create", description: "Create purchases" },
    { module: "purchases", action: "edit", key: "purchases.edit", description: "Edit purchases" },
    { module: "purchases", action: "approve", key: "purchases.approve", description: "Approve purchases" },
    { module: "purchases", action: "payment", key: "purchases.payment", description: "Manage supplier payments" },
    // Accounting
    { module: "accounting", action: "view", key: "accounting.view", description: "View accounting" },
    { module: "accounting", action: "create_journal", key: "accounting.create_journal", description: "Create journal entries" },
    { module: "accounting", action: "edit_journal", key: "accounting.edit_journal", description: "Edit journal entries" },
    { module: "accounting", action: "view_reports", key: "accounting.view_reports", description: "View financial reports" },
    // Expenses
    { module: "expenses", action: "view", key: "expenses.view", description: "View expenses" },
    { module: "expenses", action: "create", key: "expenses.create", description: "Create expenses" },
    { module: "expenses", action: "edit", key: "expenses.edit", description: "Edit expenses" },
    { module: "expenses", action: "approve", key: "expenses.approve", description: "Approve expenses" },
    { module: "expenses", action: "delete", key: "expenses.delete", description: "Delete expenses" },
    // Reports
    { module: "reports", action: "view", key: "reports.view", description: "View reports" },
    { module: "reports", action: "financial", key: "reports.financial", description: "Financial reports" },
    { module: "reports", action: "export", key: "reports.export", description: "Export reports" },
    // Warranty
    { module: "warranty", action: "view", key: "warranty.view", description: "View warranties" },
    { module: "warranty", action: "create", key: "warranty.create", description: "Create warranties" },
    { module: "warranty", action: "edit", key: "warranty.edit", description: "Edit warranties" },
    { module: "warranty", action: "void", key: "warranty.void", description: "Void warranties" },
    { module: "warranty", action: "process_claim", key: "warranty.process_claim", description: "Process warranty claims" },
    // Service
    { module: "service", action: "view", key: "service.view", description: "View service tickets" },
    { module: "service", action: "create", key: "service.create", description: "Create service tickets" },
    { module: "service", action: "edit", key: "service.edit", description: "Edit service tickets" },
    { module: "service", action: "delete", key: "service.delete", description: "Delete service tickets" },
    { module: "service", action: "update_status", key: "service.update_status", description: "Update ticket status" },
    { module: "service", action: "add_parts", key: "service.add_parts", description: "Add parts to tickets" },
    // Orders
    { module: "orders", action: "view", key: "orders.view", description: "View orders" },
    { module: "orders", action: "manage", key: "orders.manage", description: "Manage orders" },
    { module: "orders", action: "cancel", key: "orders.cancel", description: "Cancel orders" },
    // Store
    { module: "store", action: "view", key: "store.view", description: "View online store" },
    { module: "store", action: "manage", key: "store.manage", description: "Manage online store" },
    // Loyalty
    { module: "loyalty", action: "view", key: "loyalty.view", description: "View loyalty" },
    { module: "loyalty", action: "manage", key: "loyalty.manage", description: "Manage loyalty" },
    // Marketing
    { module: "marketing", action: "view", key: "marketing.view", description: "View marketing" },
    { module: "marketing", action: "create", key: "marketing.create", description: "Create campaigns" },
    { module: "marketing", action: "send", key: "marketing.send", description: "Send campaigns" },
    // Users
    { module: "users", action: "view", key: "users.view", description: "View users" },
    { module: "users", action: "create", key: "users.create", description: "Create users" },
    { module: "users", action: "edit", key: "users.edit", description: "Edit users" },
    { module: "users", action: "delete", key: "users.delete", description: "Delete users" },
    { module: "users", action: "manage_roles", key: "users.manage_roles", description: "Manage roles" },
    // Branches
    { module: "branches", action: "view", key: "branches.view", description: "View branches" },
    { module: "branches", action: "create", key: "branches.create", description: "Create branches" },
    { module: "branches", action: "edit", key: "branches.edit", description: "Edit branches" },
    // Settings
    { module: "settings", action: "view", key: "settings.view", description: "View settings" },
    { module: "settings", action: "edit", key: "settings.edit", description: "Edit settings" },
    // AI
    { module: "ai", action: "view", key: "ai.view", description: "View AI assistant" },
    { module: "ai", action: "query", key: "ai.query", description: "Query AI assistant" },
  ];

  for (const perm of permissionDefs) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ Created ${permissionDefs.length} permissions`);

  // ============================================================
  // 3. DEMO BUSINESS — ABC Electronics
  // ============================================================
  const business = await prisma.business.upsert({
    where: { slug: "abc-electronics" },
    update: {},
    create: {
      slug: "abc-electronics",
      name: "ABC Electronics",
      legalName: "ABC Electronics (Pvt) Ltd",
      category: "ELECTRONICS",
      status: "ACTIVE",
      email: "info@abcelectronics.lk",
      phone: "0112345678",
      website: "https://abcelectronics.lk",
      address: "123, Galle Road",
      city: "Colombo 03",
      district: "Colombo",
      province: "Western",
      country: "LK",
      postalCode: "00300",
      businessRegNo: "PV12345",
      vatNumber: "VAT123456789",
      currency: "LKR",
      currencySymbol: "Rs.",
      language: "en",
      timezone: "Asia/Colombo",
      invoicePrefix: "INV",
      receiptPrefix: "RCP",
      warrantyPrefix: "WC",
      servicePrefix: "ST",
      taxEnabled: true,
      taxRate: 18,
      taxName: "VAT",
      taxInclusive: false,
      invoiceFooter: "Thank you for your business! Goods sold are not refundable without receipt.",
      thankYouMessage: "Thank you for shopping at ABC Electronics!",
      loyaltyEnabled: true,
      loyaltyPointsPerLkr: 1,
      warrantyEnabled: true,
      ecommerceEnabled: true,
      onboardingCompleted: true,
    },
  });

  // ============================================================
  // 4. BRANCHES
  // ============================================================
  const colomboBranch = await prisma.branch.upsert({
    where: { businessId_code: { businessId: business.id, code: "COL" } },
    update: {},
    create: {
      businessId: business.id,
      name: "Colombo Branch",
      code: "COL",
      address: "123, Galle Road, Colombo 03",
      city: "Colombo",
      phone: "0112345678",
      isHeadOffice: true,
      openingCash: 25000,
      isActive: true,
    },
  });

  const kalutaraBranch = await prisma.branch.upsert({
    where: { businessId_code: { businessId: business.id, code: "KAL" } },
    update: {},
    create: {
      businessId: business.id,
      name: "Kalutara Branch",
      code: "KAL",
      address: "45, Main Street, Kalutara",
      city: "Kalutara",
      phone: "0342234567",
      isHeadOffice: false,
      openingCash: 15000,
      isActive: true,
    },
  });

  console.log(`✅ Created 2 branches: Colombo, Kalutara`);

  // ============================================================
  // 5. ROLES
  // ============================================================
  const roleNames = ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER", "STOCK_MANAGER", "TECHNICIAN", "SALES_STAFF", "DELIVERY_STAFF"];
  const roles: Record<string, { id: string }> = {};

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { businessId_name: { businessId: business.id, name: roleName } },
      update: {},
      create: {
        businessId: business.id,
        name: roleName,
        description: `${roleName} role`,
        isSystem: true,
      },
    });
    roles[roleName] = role;
  }

  console.log(`✅ Created ${roleNames.length} roles`);

  // ============================================================
  // 6. DEMO USERS
  // ============================================================
  const passwordHash = await bcrypt.hash("Demo@2026", 12);

  const usersData = [
    { name: "Admin Owner", email: "owner@example.com", roleName: "OWNER", isOwner: true },
    { name: "Cashier Demo", email: "cashier@example.com", roleName: "CASHIER", isOwner: false },
    { name: "Accountant Demo", email: "accountant@example.com", roleName: "ACCOUNTANT", isOwner: false },
    { name: "Technician Demo", email: "technician@example.com", roleName: "TECHNICIAN", isOwner: false },
    { name: "Manager Demo", email: "manager@example.com", roleName: "MANAGER", isOwner: false },
  ];

  for (const ud of usersData) {
    const user = await prisma.user.upsert({
      where: { email: ud.email },
      update: {},
      create: {
        name: ud.name,
        email: ud.email,
        passwordHash,
        status: "ACTIVE",
      },
    });

    await prisma.userBusiness.upsert({
      where: { userId_businessId: { userId: user.id, businessId: business.id } },
      update: {},
      create: {
        userId: user.id,
        businessId: business.id,
        branchId: colomboBranch.id,
        roleId: roles[ud.roleName].id,
        isOwner: ud.isOwner,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${usersData.length} demo users`);

  // ============================================================
  // 7. CATEGORIES
  // ============================================================
  const categoriesData = [
    { name: "Televisions", slug: "televisions" },
    { name: "Mobile Phones", slug: "mobile-phones" },
    { name: "Laptops", slug: "laptops" },
    { name: "Desktop Computers", slug: "desktop-computers" },
    { name: "UPS & Power", slug: "ups-power" },
    { name: "Accessories", slug: "accessories" },
    { name: "Printers", slug: "printers" },
    { name: "Audio & Video", slug: "audio-video" },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const cat of categoriesData) {
    const c = await prisma.category.upsert({
      where: { businessId_slug: { businessId: business.id, slug: cat.slug } },
      update: {},
      create: { ...cat, businessId: business.id, isActive: true, sortOrder: 0 },
    });
    categories[cat.slug] = c;
  }

  console.log(`✅ Created ${categoriesData.length} categories`);

  // ============================================================
  // 8. BRANDS
  // ============================================================
  const brandsData = ["Samsung", "Apple", "Dell", "HP", "Lenovo", "Sony", "APC", "Logitech", "LG", "Panasonic"];
  const brands: Record<string, { id: string }> = {};
  for (const brandName of brandsData) {
    const b = await prisma.brand.upsert({
      where: { businessId_name: { businessId: business.id, name: brandName } },
      update: {},
      create: { businessId: business.id, name: brandName, isActive: true },
    });
    brands[brandName] = b;
  }

  console.log(`✅ Created ${brandsData.length} brands`);

  // ============================================================
  // 9. UNITS
  // ============================================================
  const unit = await prisma.unit.upsert({
    where: { businessId_name: { businessId: business.id, name: "Piece" } },
    update: {},
    create: { businessId: business.id, name: "Piece", abbreviation: "pcs" },
  });

  // ============================================================
  // 10. TAX RATE
  // ============================================================
  const taxRate = await prisma.taxRate.upsert({
    where: { id: "default-vat-tax" },
    update: {},
    create: {
      id: "default-vat-tax",
      businessId: business.id,
      name: "VAT 18%",
      rate: 18,
      isDefault: true,
      isActive: true,
    },
  });

  // ============================================================
  // 11. PRODUCTS
  // ============================================================
  const productsData = [
    {
      name: "Samsung 55\" Crystal 4K TV",
      sku: "SAM-TV-55-4K",
      barcode: "8806090034855",
      categoryId: categories["televisions"].id,
      brandId: brands["Samsung"].id,
      costPrice: 68000,
      retailPrice: 89900,
      wholesalePrice: 82000,
      reorderLevel: 3,
      warrantyMonths: 24,
      isSerialTracked: true,
    },
    {
      name: "Apple iPhone 15 Pro 256GB",
      sku: "APP-IP15P-256",
      barcode: "194253713807",
      categoryId: categories["mobile-phones"].id,
      brandId: brands["Apple"].id,
      costPrice: 145000,
      retailPrice: 185000,
      wholesalePrice: 172000,
      reorderLevel: 5,
      warrantyMonths: 12,
      isSerialTracked: true,
    },
    {
      name: "Dell Inspiron 15 Laptop",
      sku: "DEL-INS15-2024",
      barcode: "5397184125008",
      categoryId: categories["laptops"].id,
      brandId: brands["Dell"].id,
      costPrice: 55000,
      retailPrice: 72000,
      wholesalePrice: 66000,
      reorderLevel: 4,
      warrantyMonths: 12,
      isSerialTracked: true,
    },
    {
      name: "APC UPS 1000VA",
      sku: "APC-UPS-1000",
      barcode: "731304229926",
      categoryId: categories["ups-power"].id,
      brandId: brands["APC"].id,
      costPrice: 7500,
      retailPrice: 9900,
      wholesalePrice: 9000,
      reorderLevel: 10,
      warrantyMonths: 24,
      isSerialTracked: false,
    },
    {
      name: "Logitech MK295 Wireless Combo",
      sku: "LOG-MK295-WL",
      barcode: "5099206084414",
      categoryId: categories["accessories"].id,
      brandId: brands["Logitech"].id,
      costPrice: 2800,
      retailPrice: 3950,
      wholesalePrice: 3500,
      reorderLevel: 15,
      warrantyMonths: 12,
      isSerialTracked: false,
    },
    {
      name: "Samsung Galaxy S24 Ultra 256GB",
      sku: "SAM-GS24U-256",
      barcode: "8806095269344",
      categoryId: categories["mobile-phones"].id,
      brandId: brands["Samsung"].id,
      costPrice: 125000,
      retailPrice: 165000,
      wholesalePrice: 153000,
      reorderLevel: 5,
      warrantyMonths: 24,
      isSerialTracked: true,
    },
    {
      name: "LG 65\" OLED evo TV",
      sku: "LG-OLED65-2024",
      barcode: "8806031693316",
      categoryId: categories["televisions"].id,
      brandId: brands["LG"].id,
      costPrice: 180000,
      retailPrice: 249900,
      wholesalePrice: 230000,
      reorderLevel: 2,
      warrantyMonths: 24,
      isSerialTracked: true,
    },
    {
      name: "HP LaserJet Pro M404dn",
      sku: "HP-LJ404-DN",
      barcode: "194441219742",
      categoryId: categories["printers"].id,
      brandId: brands["HP"].id,
      costPrice: 32000,
      retailPrice: 42000,
      wholesalePrice: 38000,
      reorderLevel: 3,
      warrantyMonths: 12,
      isSerialTracked: true,
    },
  ];

  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: prod.sku } },
      update: {},
      create: {
        ...prod,
        businessId: business.id,
        unitId: unit.id,
        taxRateId: taxRate.id,
        warrantyType: "SELLER",
        isActive: true,
        onlineVisible: true,
      },
    });
  }

  console.log(`✅ Created ${productsData.length} products`);

  // ============================================================
  // 12. CUSTOMERS
  // ============================================================
  const customersData = [
    { name: "Kasun Perera", phone: "0771234567", email: "kasun@email.com", city: "Colombo", creditLimit: 50000 },
    { name: "Nimal Silva", phone: "0762345678", email: "nimal@email.com", city: "Gampaha", creditLimit: 100000 },
    { name: "Chamari Fernando", phone: "0753456789", city: "Kalutara" },
    { name: "Ashan Dias", phone: "0714567890", city: "Colombo" },
    { name: "Sanduni Wickramasinghe", phone: "0775678901", email: "sanduni@email.com", city: "Negombo", isVip: true },
    { name: "Ravindra Jayawardena", phone: "0786789012", city: "Galle" },
    { name: "Malsha Rajapaksha", phone: "0797890123", email: "malsha@email.com", city: "Matara" },
    { name: "Thilini Dissanayake", phone: "0708901234", city: "Kandy" },
  ];

  for (const cust of customersData) {
    await prisma.customer.upsert({
      where: { businessId_phone: { businessId: business.id, phone: cust.phone } },
      update: {},
      create: {
        ...cust,
        businessId: business.id,
        isActive: true,
        isVip: cust.isVip ?? false,
        creditBalance: 0,
      },
    });
  }

  console.log(`✅ Created ${customersData.length} customers`);

  // ============================================================
  // 13. SUPPLIERS
  // ============================================================
  const suppliersData = [
    { name: "Samsung Lanka (Pvt) Ltd", phone: "0112233445", email: "orders@samsung.lk", city: "Colombo", creditLimit: 500000 },
    { name: "Apple Authorized Distributor", phone: "0112345678", email: "orders@appledist.lk", city: "Colombo", creditLimit: 1000000 },
    { name: "Dell Technologies Lanka", phone: "0113456789", email: "orders@dell.lk", city: "Colombo", creditLimit: 300000 },
    { name: "APC Sri Lanka", phone: "0114567890", city: "Colombo", creditLimit: 200000 },
    { name: "Logitech Distributor Lanka", phone: "0115678901", city: "Colombo", creditLimit: 150000 },
  ];

  for (const supp of suppliersData) {
    await prisma.supplier.upsert({
      where: { businessId_phone: { businessId: business.id, phone: supp.phone } },
      update: {},
      create: {
        ...supp,
        businessId: business.id,
        creditBalance: 0,
        paymentTermDays: 30,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${suppliersData.length} suppliers`);

  // ============================================================
  // 14. EXPENSE CATEGORIES
  // ============================================================
  const expCatsData = [
    { name: "Rent", color: "#6366f1" },
    { name: "Electricity", color: "#f59e0b" },
    { name: "Water", color: "#06b6d4" },
    { name: "Internet", color: "#8b5cf6" },
    { name: "Salaries", color: "#10b981" },
    { name: "Transport", color: "#f97316" },
    { name: "Marketing", color: "#ec4899" },
    { name: "Maintenance", color: "#64748b" },
    { name: "Other", color: "#94a3b8" },
  ];

  for (const cat of expCatsData) {
    await prisma.expenseCategory.upsert({
      where: { businessId_name: { businessId: business.id, name: cat.name } },
      update: {},
      create: { ...cat, businessId: business.id, isSystem: true },
    });
  }

  console.log(`✅ Created ${expCatsData.length} expense categories`);

  // ============================================================
  // 15. CHART OF ACCOUNTS
  // ============================================================
  const accountsData = [
    // Assets
    { code: "1000", name: "Cash in Hand", type: "ASSET" as const, isBankAccount: false },
    { code: "1010", name: "Cash - Colombo Branch", type: "ASSET" as const, isBankAccount: false },
    { code: "1020", name: "Cash - Kalutara Branch", type: "ASSET" as const, isBankAccount: false },
    { code: "1100", name: "Bank - Sampath Bank", type: "ASSET" as const, isBankAccount: true, bankName: "Sampath Bank" },
    { code: "1200", name: "Accounts Receivable", type: "ASSET" as const },
    { code: "1300", name: "Inventory", type: "ASSET" as const },
    // Liabilities
    { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const },
    { code: "2100", name: "VAT Payable", type: "LIABILITY" as const },
    // Equity
    { code: "3000", name: "Owner's Equity", type: "EQUITY" as const },
    { code: "3100", name: "Retained Earnings", type: "EQUITY" as const },
    // Revenue
    { code: "4000", name: "Sales Revenue", type: "REVENUE" as const },
    { code: "4100", name: "Service Revenue", type: "REVENUE" as const },
    // COGS
    { code: "5000", name: "Cost of Goods Sold", type: "COGS" as const },
    // Expenses
    { code: "6000", name: "Operating Expenses", type: "EXPENSE" as const },
    { code: "6100", name: "Rent Expense", type: "EXPENSE" as const },
    { code: "6200", name: "Salary Expense", type: "EXPENSE" as const },
    { code: "6300", name: "Utility Expense", type: "EXPENSE" as const },
    { code: "6400", name: "Marketing Expense", type: "EXPENSE" as const },
  ];

  for (const acc of accountsData) {
    await prisma.account.upsert({
      where: { businessId_code: { businessId: business.id, code: acc.code } },
      update: {},
      create: { ...acc, businessId: business.id, isSystem: true, isActive: true },
    });
  }

  console.log(`✅ Created ${accountsData.length} chart of accounts`);

  // ============================================================
  // 16. SUBSCRIPTION
  // ============================================================
  const proPlan = plans.find((p) => p.type === "PROFESSIONAL")!;
  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      planId: proPlan.id,
      status: "ACTIVE",
      billingPeriod: "MONTHLY",
      amount: proPlan.monthlyPrice,
      currency: "LKR",
      currentPeriodStart: new Date("2026-09-01"),
      currentPeriodEnd: new Date("2026-10-01"),
    },
  });

  console.log("✅ Created subscription (Professional plan)");

  // ============================================================
  // 17. ONLINE STORE
  // ============================================================
  await prisma.onlineStore.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      slug: "abc-electronics",
      name: "ABC Electronics Online",
      tagline: "Sri Lanka's trusted electronics store",
      description: "Quality electronics at unbeatable prices",
      primaryColor: "#6366f1",
      accentColor: "#8b5cf6",
      isPublished: true,
      allowCOD: true,
      allowCard: true,
      deliveryEnabled: true,
      pickupEnabled: true,
      minimumOrder: 1000,
    },
  });

  console.log("✅ Created online store");

  // ============================================================
  // 18. LOYALTY TIERS
  // ============================================================
  const tiersData = [
    { tier: "SILVER" as const, name: "Silver", minPoints: 0, pointsMultiplier: 1 },
    { tier: "GOLD" as const, name: "Gold", minPoints: 5000, pointsMultiplier: 1.5 },
    { tier: "PLATINUM" as const, name: "Platinum", minPoints: 20000, pointsMultiplier: 2 },
  ];

  for (const t of tiersData) {
    await prisma.loyaltyTier.upsert({
      where: { businessId_tier: { businessId: business.id, tier: t.tier } },
      update: {},
      create: { ...t, businessId: business.id },
    });
  }

  console.log("✅ Created 3 loyalty tiers");

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📧 Demo credentials:");
  console.log("  Owner:       owner@example.com / Demo@2026");
  console.log("  Cashier:     cashier@example.com / Demo@2026");
  console.log("  Accountant:  accountant@example.com / Demo@2026");
  console.log("  Technician:  technician@example.com / Demo@2026");
  console.log("  Manager:     manager@example.com / Demo@2026");
  console.log("\n🏢 Demo Business: ABC Electronics (Colombo + Kalutara branches)");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
