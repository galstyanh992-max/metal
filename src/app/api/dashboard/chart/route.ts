import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  try {
    await requireRole("ADMIN");

    const now = new Date();
    const last30 = new Date(now);
    last30.setDate(last30.getDate() - 30);

    // Daily sales for last 14 days
    const orders = await db.order.findMany({
      where: { createdAt: { gte: last30 }, status: { not: "CANCELLED" } },
      select: { totalAmount: true, createdAt: true, costAmount: true, clientId: true },
    });

    const dailyMap = new Map<string, { sales: number; cost: number; orders: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { sales: 0, cost: 0, orders: 0 });
    }
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.sales += o.totalAmount;
        entry.cost += o.costAmount;
        entry.orders += 1;
      }
    }
    const dailySales = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      label: new Date(date).toLocaleDateString("hy-AM", { day: "2-digit", month: "2-digit" }),
      sales: v.sales,
      profit: v.sales - v.cost,
      orders: v.orders,
    }));

    // Top clients by turnover
    const clients = await db.client.findMany({
      include: { orders: { where: { status: { not: "CANCELLED" } }, select: { totalAmount: true } } },
    });
    const topClients = clients
      .map((c) => ({
        id: c.id,
        name: c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`,
        type: c.type,
        turnover: c.orders.reduce((s, o) => s + o.totalAmount, 0),
        orders: c.orders.length,
      }))
      .filter((c) => c.turnover > 0)
      .sort((a, b) => b.turnover - a.turnover)
      .slice(0, 5);

    // Order status distribution
    const statusCounts = await db.order.groupBy({ by: ["status"], _count: true });
    const statusDistribution = statusCounts.map((s) => ({ status: s.status, count: s._count }));

    // Payment method distribution
    const payments = await db.orderPayment.groupBy({ by: ["method"], _sum: { amount: true }, _count: true });
    const paymentMethods = payments.map((p) => ({ method: p.method, amount: p._sum.amount ?? 0, count: p._count }));

    return NextResponse.json({
      dailySales,
      topClients,
      statusDistribution,
      paymentMethods,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
