import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30"; // days

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Sales over time
    const orders = await db.order.findMany({
      where: { createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
      select: { totalAmount: true, costAmount: true, createdAt: true, clientId: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const dailyMap = new Map<string, { sales: number; cost: number; profit: number; orders: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (!dailyMap.has(key)) dailyMap.set(key, { sales: 0, cost: 0, profit: 0, orders: 0 });
      const entry = dailyMap.get(key)!;
      entry.sales += o.totalAmount;
      entry.cost += o.costAmount;
      entry.profit += o.totalAmount - o.costAmount;
      entry.orders += 1;
    }

    const dailyData = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      label: new Date(date).toLocaleDateString("hy-AM", { day: "2-digit", month: "2-digit" }),
      ...v,
    }));

    // Top products by revenue
    const orderItems = await db.orderItem.findMany({
      where: { order: { createdAt: { gte: startDate }, status: { not: "CANCELLED" } } },
      select: { productName: true, qty: true, lineTotal: true, productId: true },
    });

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of orderItems) {
      if (!productMap.has(item.productId)) {
        productMap.set(item.productId, { name: item.productName, qty: 0, revenue: 0 });
      }
      const entry = productMap.get(item.productId)!;
      entry.qty += item.qty;
      entry.revenue += item.lineTotal;
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Summary
    const totalSales = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalCost = orders.reduce((s, o) => s + o.costAmount, 0);
    const totalProfit = totalSales - totalCost;
    const avgOrderValue = orders.length > 0 ? Math.round(totalSales / orders.length) : 0;
    const marginPercent = totalSales > 0 ? Math.round((totalProfit / totalSales) * 10000) / 100 : 0;

    // Payments
    const payments = await db.orderPayment.findMany({
      where: { paidAt: { gte: startDate } },
      select: { amount: true, method: true },
    });
    const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
    const paymentByMethod = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      period: days,
      summary: {
        totalSales,
        totalCost,
        totalProfit,
        marginPercent,
        avgOrderValue,
        totalOrders: orders.length,
        totalCollected,
      },
      dailyData,
      topProducts,
      paymentByMethod,
    });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
