import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { computeInventoryState } from "@/lib/inventory/ledger";

export async function GET() {
  try {
    const { role } = await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 7);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [ordersToday, ordersWeek, ordersMonth, totalOrders, totalClients, lowStockProducts, overdueOrders, movements] = await Promise.all([
      db.order.count({ where: { createdAt: { gte: startToday } } }),
      db.order.count({ where: { createdAt: { gte: startWeek } } }),
      db.order.count({ where: { createdAt: { gte: startMonth } } }),
      db.order.count(),
      db.client.count(),
      db.product.findMany({ where: { active: true }, select: { id: true, name: true, sku: true, minStock: true } }),
      db.order.count({ where: { dueDate: { lt: now }, outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } } }),
      db.inventoryMovement.count(),
    ]);

    // Sales sums (admin only sees money)
    let salesToday = 0, salesWeek = 0, salesMonth = 0, collectedToday = 0, outstandingDebt = 0, overdueDebt = 0;

    if (role !== "WAREHOUSE") {
      const [todayAgg, weekAgg, monthAgg, collectedAgg, debtAgg, overdueAgg] = await Promise.all([
        db.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startToday }, status: { not: "CANCELLED" } } }),
        db.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startWeek }, status: { not: "CANCELLED" } } }),
        db.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startMonth }, status: { not: "CANCELLED" } } }),
        db.orderPayment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startToday } } }),
        db.order.aggregate({ _sum: { outstandingAmount: true }, where: { status: { not: "CANCELLED" } } }),
        db.order.aggregate({ _sum: { outstandingAmount: true }, where: { dueDate: { lt: now }, outstandingAmount: { gt: 0 }, status: { not: "CANCELLED" } } }),
      ]);
      salesToday = todayAgg._sum.totalAmount ?? 0;
      salesWeek = weekAgg._sum.totalAmount ?? 0;
      salesMonth = monthAgg._sum.totalAmount ?? 0;
      collectedToday = collectedAgg._sum.amount ?? 0;
      outstandingDebt = debtAgg._sum.outstandingAmount ?? 0;
      overdueDebt = overdueAgg._sum.outstandingAmount ?? 0;
    }

    // Low stock detection
    const lowStock = [] as any[];
    for (const p of lowStockProducts) {
      const st = await computeInventoryState(p.id);
      if (st.available < p.minStock) {
        lowStock.push({ ...p, ...st });
      }
    }

    // Role-specific dashboard payload
    const data: any = {
      role,
      counts: {
        ordersToday, ordersWeek, ordersMonth, totalOrders, totalClients, overdueOrders, lowStockCount: lowStock.length, movements,
      },
      lowStock,
    };

    if (role !== "WAREHOUSE") {
      data.finance = {
        salesToday, salesWeek, salesMonth, collectedToday, outstandingDebt, overdueDebt,
      };
    }

    if (role === "WAREHOUSE") {
      // Pending picks
      const pendingPicks = await db.order.findMany({
        where: { status: "CONFIRMED" },
        select: { id: true, number: true, clientId: true, createdAt: true, items: { select: { id: true, productName: true, qty: true } } },
        take: 20,
      });
      data.picks = pendingPicks;
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
