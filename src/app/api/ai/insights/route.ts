import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

// Database-driven AI insights — no external API required
// Generates intelligent business insights from real data patterns

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      // Sales trend — last 30 days vs previous 30 days
      recentSales, prevSales,
      // Today vs yesterday
      todaySales, yesterdaySales,
      // Low stock alerts
      criticalStock,
      // Expiring warranties
      expiringWarranties,
      // Overdue service tickets
      overdueTickets,
      // Dormant customers
      dormantCustomers,
      // Pending online orders
      pendingOrders,
      // Top selling product this week
      topProduct,
      // Credit overdue
      overdueCredit,
      // Business info
      business,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), lt: thirtyDaysAgo } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
        _sum: { total: true }, _count: { id: true },
      }),
      prisma.stock.findMany({
        where: { product: { businessId: tenant.businessId, isActive: true, deletedAt: null }, quantity: { lte: 3 } },
        include: { product: { select: { name: true, reorderLevel: true, retailPrice: true } }, branch: { select: { name: true } } },
        orderBy: { quantity: "asc" },
        take: 5,
      }),
      prisma.warranty.count({
        where: { businessId: tenant.businessId, status: "ACTIVE", endDate: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.serviceTicket.findMany({
        where: { businessId: tenant.businessId, status: { notIn: ["DELIVERED", "CANCELLED"] }, createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
        select: { ticketNumber: true, deviceName: true, status: true },
        take: 3,
      }),
      prisma.customer.count({
        where: { businessId: tenant.businessId, isActive: true, sales: { none: { createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } } } },
      }),
      prisma.onlineOrder.count({ where: { businessId: tenant.businessId, status: "PENDING" } }),
      prisma.saleItem.groupBy({
        by: ["name", "productId"],
        where: { sale: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: sevenDaysAgo } } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 1,
      }),
      prisma.customer.aggregate({
        where: { businessId: tenant.businessId, creditBalance: { gt: 0 } },
        _sum: { creditBalance: true }, _count: { id: true },
      }),
      prisma.business.findUnique({ where: { id: tenant.businessId }, select: { name: true, category: true } }),
    ]);

    // Generate insights
    const insights: any[] = [];

    // 1. Revenue trend insight
    const currentRevenue = Number(recentSales._sum.total || 0);
    const prevRevenue = Number(prevSales._sum.total || 0);
    const growthPct = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    if (growthPct > 15) {
      insights.push({
        id: "insight-revenue-growth",
        type: "REVENUE_TREND",
        category: "Revenue",
        priority: "HIGH",
        priorityScore: 1,
        title: `Revenue up ${growthPct.toFixed(1)}% vs last month`,
        message: `Your business is on a strong growth trajectory. Revenue grew from Rs. ${(prevRevenue / 1000).toFixed(0)}K to Rs. ${(currentRevenue / 1000).toFixed(0)}K this month.`,
        recommendation: "Keep up the momentum by running promotions on top-selling categories.",
        value: currentRevenue,
        trend: "UP",
        action: "View Reports",
        actionUrl: "/dashboard/reports",
      });
    } else if (growthPct < -10) {
      insights.push({
        id: "insight-revenue-decline",
        type: "REVENUE_TREND",
        category: "Revenue",
        priority: "HIGH",
        priorityScore: 1,
        title: `Revenue down ${Math.abs(growthPct).toFixed(1)}% vs last month`,
        message: `Revenue has declined from Rs. ${(prevRevenue / 1000).toFixed(0)}K to Rs. ${(currentRevenue / 1000).toFixed(0)}K.`,
        recommendation: "Consider running a targeted WhatsApp promotion campaign to re-engage past customers.",
        value: currentRevenue,
        trend: "DOWN",
        action: "Create Campaign",
        actionUrl: "/dashboard/marketing",
      });
    }

    // 2. Today vs yesterday
    const todayRev = Number(todaySales._sum.total || 0);
    const yestRev = Number(yesterdaySales._sum.total || 0);
    if (yestRev > 0 && todayRev > yestRev * 1.3) {
      insights.push({
        id: "insight-today-sales",
        type: "REVENUE_TREND",
        category: "Today",
        priority: "MEDIUM",
        priorityScore: 2,
        title: `Today is a strong day — ${((todayRev / yestRev - 1) * 100).toFixed(0)}% above yesterday`,
        message: `Today's sales (Rs. ${(todayRev / 1000).toFixed(0)}K, ${todaySales._count.id} transactions) are significantly ahead of yesterday (Rs. ${(yestRev / 1000).toFixed(0)}K).`,
        recommendation: "Ensure front-counter stock is replenished for peak afternoon hours.",
        value: todayRev,
        trend: "UP",
        action: "Open POS",
        actionUrl: "/dashboard/pos",
      });
    }

    // 3. Critical stock alerts
    if (criticalStock.length > 0) {
      const item = criticalStock[0];
      insights.push({
        id: "insight-critical-stock",
        type: "STOCK_ALERT",
        category: "Inventory",
        priority: "CRITICAL",
        priorityScore: 1,
        title: `${criticalStock.length} product${criticalStock.length > 1 ? "s" : ""} critically low on stock`,
        message: `"${item.product.name}" at ${item.branch.name} has only ${item.quantity} unit${item.quantity !== 1 ? "s" : ""} remaining.${criticalStock.length > 1 ? ` Plus ${criticalStock.length - 1} more products need urgent restocking.` : ""}`,
        recommendation: "Create a purchase order immediately to avoid out-of-stock lost sales.",
        value: criticalStock.length,
        action: "Create PO",
        actionUrl: "/dashboard/purchases/orders/new",
        data: criticalStock.map((s) => ({ name: s.product.name, qty: s.quantity, branch: s.branch.name })),
      });
    }

    // 4. Expiring warranties
    if (expiringWarranties > 0) {
      insights.push({
        id: "insight-expiring-warranties",
        type: "WARRANTY_EXPIRY",
        category: "Warranties",
        priority: "MEDIUM",
        priorityScore: 2,
        title: `${expiringWarranties} warranty${expiringWarranties > 1 ? "ies" : ""} expiring within 30 days`,
        message: `${expiringWarranties} customer warrant${expiringWarranties > 1 ? "ies are" : "y is"} expiring soon.`,
        recommendation: "Send proactive service reminders or warranty extension offers to generate after-sales revenue.",
        value: expiringWarranties,
        action: "View Warranties",
        actionUrl: "/dashboard/warranties",
      });
    }

    // 5. Overdue service tickets
    if (overdueTickets.length > 0) {
      insights.push({
        id: "insight-overdue-tickets",
        type: "SERVICE_PENDING",
        category: "Service",
        priority: "HIGH",
        priorityScore: 2,
        title: `${overdueTickets.length} service ticket${overdueTickets.length > 1 ? "s" : ""} overdue (>7 days)`,
        message: `${overdueTickets.length} repair job${overdueTickets.length > 1 ? "s have" : " has"} been open for more than 7 days. Ticket: ${overdueTickets[0].ticketNumber}${overdueTickets.length > 1 ? ` (+${overdueTickets.length - 1} more)` : ""}.`,
        recommendation: "Follow up with technicians and send SMS/WhatsApp status updates to waiting customers.",
        value: overdueTickets.length,
        action: "Service Center",
        actionUrl: "/dashboard/service",
      });
    }

    // 6. Dormant customers
    if (dormantCustomers > 0) {
      insights.push({
        id: "insight-dormant-customers",
        type: "CUSTOMER_INSIGHT",
        category: "CRM",
        priority: "MEDIUM",
        priorityScore: 3,
        title: `${dormantCustomers} customer${dormantCustomers > 1 ? "s have" : " has"} not purchased in 90+ days`,
        message: `Win back ${dormantCustomers} dormant customer${dormantCustomers > 1 ? "s" : ""} with a re-engagement campaign.`,
        recommendation: "Send a targeted WhatsApp message with an exclusive discount code.",
        value: dormantCustomers,
        action: "Create Campaign",
        actionUrl: "/dashboard/marketing",
      });
    }

    // 7. Pending online orders
    if (pendingOrders > 0) {
      insights.push({
        id: "insight-pending-orders",
        type: "ORDER_ALERT",
        category: "Orders",
        priority: "HIGH",
        priorityScore: 1,
        title: `${pendingOrders} online order${pendingOrders > 1 ? "s" : ""} awaiting confirmation`,
        message: `You have ${pendingOrders} unprocessed online order${pendingOrders > 1 ? "s" : ""}.`,
        recommendation: "Confirm and prepare dispatch within 2 hours to improve customer satisfaction.",
        value: pendingOrders,
        action: "Process Orders",
        actionUrl: "/dashboard/orders",
      });
    }

    // 8. Top product spotlight
    if (topProduct.length > 0) {
      const tp = topProduct[0];
      insights.push({
        id: "insight-top-product",
        type: "PERFORMANCE",
        category: "Products",
        priority: "LOW",
        priorityScore: 3,
        title: `"${tp.name}" is your top seller this week`,
        message: `"${tp.name}" generated Rs. ${((Number(tp._sum.total || 0)) / 1000).toFixed(0)}K in revenue with ${tp._sum.quantity} units sold this week.`,
        recommendation: "Ensure adequate stock levels and feature it in promotional banners.",
        value: Number(tp._sum.total || 0),
        trend: "UP",
        action: "View Inventory",
        actionUrl: "/dashboard/inventory",
      });
    }

    // 9. Credit overdue alert
    const overdueAmount = Number(overdueCredit._sum.creditBalance || 0);
    if (overdueAmount > 50000) {
      insights.push({
        id: "insight-overdue-credit",
        type: "CREDIT_ALERT",
        category: "Finance",
        priority: "CRITICAL",
        priorityScore: 1,
        title: `Rs. ${(overdueAmount / 1000).toFixed(0)}K in outstanding customer credit`,
        message: `${overdueCredit._count.id} customer${overdueCredit._count.id > 1 ? "s have" : " has"} outstanding credit balances totaling Rs. ${(overdueAmount / 1000).toFixed(0)}K.`,
        recommendation: "Follow up with collections or send WhatsApp statements to improve cash flow.",
        value: overdueAmount,
        action: "View Customers",
        actionUrl: "/dashboard/customers",
      });
    }

    // Default insight if none triggered
    if (insights.length === 0) {
      insights.push({
        id: "insight-store-healthy",
        type: "PERFORMANCE",
        category: "Health",
        priority: "LOW",
        priorityScore: 4,
        title: "All Retail Operations Running Smoothly",
        message: "No critical stockouts or overdue invoices detected. Inventory levels and sales are operating normally.",
        recommendation: "Check today's POS registers or explore product promotions.",
        action: "Open POS",
        actionUrl: "/dashboard/pos",
      });
    }

    // Sort by priorityScore
    insights.sort((a, b) => (a.priorityScore || 99) - (b.priorityScore || 99));

    // Business context summary for chat
    const contextSummary = {
      businessName: business?.name || "Your Business",
      businessCategory: business?.category || "GENERAL_RETAIL",
      revenue: currentRevenue,
      revenueGrowth: growthPct,
      todayRevenue: todayRev,
      todayTransactions: todaySales._count.id,
      totalCustomers: 0, // would need separate query
      dormantCustomers,
      criticalStockCount: criticalStock.length,
      pendingOrders,
      openTickets: overdueTickets.length,
      expiringWarranties,
    };

    // Build summary object expected by AI assistant client
    const summary = {
      todayRevenue: todayRev,
      weekRevenue: currentRevenue,
      monthRevenue: currentRevenue,
      revenueGrowth: growthPct,
      lowStockCount: criticalStock.length,
      expiringWarrantiesCount: expiringWarranties,
      pendingServicesCount: overdueTickets.length,
      pendingOrdersCount: pendingOrders,
    };

    return NextResponse.json({ insights, contextSummary, summary });
  } catch (error: any) {
    console.error("AI insights error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Chat Q&A handler (uses database data to answer questions)
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { question } = body;
    if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });

    const q = question.toLowerCase();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Route question to appropriate data queries
    let answer = "";

    if (q.includes("top sell") || q.includes("best sell") || q.includes("popular product")) {
      const topItems = await prisma.saleItem.groupBy({
        by: ["name"],
        where: { sale: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: monthStart } } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      });
      if (topItems.length === 0) {
        answer = "No sales data found for this month yet.";
      } else {
        answer = `🏆 **Top Selling Products This Month:**\n\n${topItems.map((p, i) => `${i + 1}. ${p.name} — ${p._sum.quantity} units sold, Rs. ${Number(p._sum.total || 0).toLocaleString()}`).join("\n")}\n\n💡 Consider restocking these high performers.`;
      }
    } else if (q.includes("low stock") || q.includes("out of stock") || q.includes("running low")) {
      const lowStock = await prisma.product.findMany({
        where: {
          businessId: tenant.businessId,
          isActive: true,
          stocks: { some: { quantity: { lte: 10 } } },
        },
        include: { stocks: true },
        take: 10,
      });
      if (lowStock.length === 0) {
        answer = "✅ Great news! All products have sufficient stock levels.";
      } else {
        answer = `⚠️ **${lowStock.length} Products with Low Stock:**\n\n${lowStock.map((p) => {
          const qty = p.stocks.reduce((s, st) => s + st.quantity, 0);
          return `• ${p.name} (${p.sku}) — Only ${qty} left`;
        }).join("\n")}\n\n💡 Recommendation: Create purchase orders for these items immediately.`;
      }
    } else if (q.includes("revenue") || q.includes("sales") || q.includes("earning")) {
      const [monthSales, lastMonthSales, todaySales] = await Promise.all([
        prisma.sale.aggregate({
          where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: monthStart } },
          _sum: { total: true }, _count: { id: true },
        }),
        prisma.sale.aggregate({
          where: {
            businessId: tenant.businessId, status: "COMPLETED",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1), lt: monthStart },
          },
          _sum: { total: true },
        }),
        prisma.sale.aggregate({
          where: {
            businessId: tenant.businessId, status: "COMPLETED",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
          _sum: { total: true }, _count: { id: true },
        }),
      ]);
      const current = Number(monthSales._sum.total || 0);
      const last = Number(lastMonthSales._sum.total || 0);
      const growth = last > 0 ? ((current - last) / last) * 100 : 0;
      answer = `📊 **Revenue Summary:**\n\n• Today: Rs. ${Number(todaySales._sum.total || 0).toLocaleString()} (${todaySales._count.id} transactions)\n• This Month: Rs. ${current.toLocaleString()} (${monthSales._count.id} sales)\n• Last Month: Rs. ${last.toLocaleString()}\n• Growth: ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%\n\n${growth >= 5 ? "✅ Revenue is growing well! Keep up the momentum." : growth >= 0 ? "📈 Slight growth. Consider promotions to boost sales." : "⚠️ Revenue declined. Review pricing and marketing strategies."}`;
    } else if (q.includes("warranty") || q.includes("warrant")) {
      const [expiring, total] = await Promise.all([
        prisma.warranty.count({
          where: { businessId: tenant.businessId, endDate: { lte: new Date(now.getTime() + 30 * 86400000), gte: now } },
        }),
        prisma.warranty.count({ where: { businessId: tenant.businessId, status: "ACTIVE" } }),
      ]);
      answer = `🛡️ **Warranty Summary:**\n\n• Total Active Warranties: ${total}\n• Expiring in 30 Days: ${expiring}\n\n${expiring > 0 ? `⚠️ ${expiring} warranties are expiring soon. Notify customers about warranty renewal or service options.` : "✅ No warranties expiring in the next 30 days."}`;
    } else if (q.includes("service") || q.includes("repair") || q.includes("ticket")) {
      const [pending, inProgress, completed] = await Promise.all([
        prisma.serviceTicket.count({ where: { businessId: tenant.businessId, status: "RECEIVED" } }),
        prisma.serviceTicket.count({ where: { businessId: tenant.businessId, status: { in: ["UNDER_INSPECTION", "REPAIRING", "WAITING_FOR_PARTS"] } } }),
        prisma.serviceTicket.count({ where: { businessId: tenant.businessId, status: "COMPLETED", completedAt: { gte: monthStart } } }),
      ]);
      answer = `🔧 **Service Center Status:**\n\n• Pending (Received): ${pending} tickets\n• In Progress: ${inProgress} tickets\n• Completed This Month: ${completed} tickets\n\n${pending + inProgress > 10 ? "⚠️ High ticket load! Consider assigning more technicians." : "✅ Service workload is manageable."}`;
    } else if (q.includes("customer") || q.includes("crm")) {
      const [total, newThisMonth, creditOwed] = await Promise.all([
        prisma.customer.count({ where: { businessId: tenant.businessId, isActive: true } }),
        prisma.customer.count({ where: { businessId: tenant.businessId, createdAt: { gte: monthStart } } }),
        prisma.customer.aggregate({
          where: { businessId: tenant.businessId, creditBalance: { gt: 0 } },
          _sum: { creditBalance: true }, _count: { id: true },
        }),
      ]);
      answer = `👥 **Customer Summary:**\n\n• Total Active Customers: ${total}\n• New This Month: ${newThisMonth}\n• Customers with Credit Balance: ${creditOwed._count.id}\n• Total Credit Owed: Rs. ${Number(creditOwed._sum.creditBalance || 0).toLocaleString()}\n\n${newThisMonth > 5 ? "✅ Good customer acquisition this month!" : "💡 Consider running a referral promotion to bring in more customers."}`;
    } else if (q.includes("profit") || q.includes("margin")) {
      const revenue = await prisma.sale.aggregate({
        where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: monthStart } },
        _sum: { total: true, discountAmount: true },
      });
      const expenses = await prisma.expense.aggregate({
        where: { businessId: tenant.businessId, expenseDate: { gte: monthStart }, status: "PAID" },
        _sum: { amount: true },
      });
      const rev = Number(revenue._sum.total || 0);
      const exp = Number(expenses._sum.amount || 0);
      const profit = rev - exp;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      answer = `💰 **Profit Analysis (This Month):**\n\n• Total Revenue: Rs. ${rev.toLocaleString()}\n• Total Expenses: Rs. ${exp.toLocaleString()}\n• Net Profit: Rs. ${profit.toLocaleString()}\n• Profit Margin: ${margin.toFixed(1)}%\n\n${margin >= 20 ? "✅ Excellent profit margin!" : margin >= 10 ? "📈 Good margin. Look for ways to reduce expenses." : "⚠️ Low profit margin. Review pricing strategy and cost control."}`;
    } else if (q.includes("health") || q.includes("summary") || q.includes("overview")) {
      const [sales, lowStock, services, orders] = await Promise.all([
        prisma.sale.aggregate({
          where: { businessId: tenant.businessId, status: "COMPLETED", createdAt: { gte: monthStart } },
          _sum: { total: true }, _count: { id: true },
        }),
        prisma.stock.count({ where: { businessId: tenant.businessId, quantity: { lte: 5 } } }),
        prisma.serviceTicket.count({ where: { businessId: tenant.businessId, status: { in: ["RECEIVED", "UNDER_INSPECTION", "REPAIRING"] } } }),
        prisma.onlineOrder.count({ where: { businessId: tenant.businessId, status: "PENDING" } }),
      ]);
      const rev = Number(sales._sum.total || 0);
      answer = `📋 **Business Health Summary:**\n\n✅ Revenue this month: Rs. ${rev.toLocaleString()} (${sales._count.id} transactions)\n${lowStock > 5 ? `⚠️ Stock: ${lowStock} products critically low` : `✅ Stock levels: ${lowStock} items need attention`}\n${services > 0 ? `🔧 Service: ${services} active tickets` : `✅ Service center clear`}\n${orders > 0 ? `📦 Online: ${orders} pending orders` : `✅ All online orders processed`}\n\n💡 Overall: ${rev > 50000 ? "Business performing well. Keep focusing on customer experience and stock levels." : "Revenue could be improved. Consider promotions and reviewing your product pricing."}`;
    } else {
      // Generic fallback response
      answer = `I can help you with insights about:\n\n• 📊 **Revenue & Sales** — "How is my revenue trending?"\n• 📦 **Inventory** — "What products are low on stock?"\n• 🏆 **Products** — "What are my top selling products?"\n• 👥 **Customers** — "Give me a customer summary"\n• 🛡️ **Warranties** — "What warranties are expiring?"\n• 🔧 **Service Center** — "Show me pending service tickets"\n• 💰 **Profitability** — "What's my profit margin?"\n• 📋 **Business Health** — "Give me a business health summary"\n\nTry asking one of these questions!`;
    }

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

