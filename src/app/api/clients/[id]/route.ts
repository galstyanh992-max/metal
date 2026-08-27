import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role } = await requireAction("client.list");
    const { id } = await params;

    const client = await db.client.findUnique({
      where: { id },
      include: {
        orders: {
          include: { items: { select: { id: true, productName: true, qty: true } } },
          orderBy: { createdAt: "desc" },
        },
        contacts: true,
        addresses: true,
        comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
        photos: true,
        documents: true,
        loyaltyTier: true,
        loyaltyOverrides: { include: { byUser: { select: { name: true } } } },
      },
    });

    if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Compute financial profile
    const lifetimeTurnover = client.orders.reduce((s, o) => s + (o.status !== "CANCELLED" ? o.totalAmount : 0), 0);
    const totalPaid = client.orders.reduce((s, o) => s + o.paidAmount, 0);
    const currentDebt = client.orders.reduce((s, o) => s + (o.status !== "CANCELLED" ? o.outstandingAmount : 0), 0);
    const totalCost = client.orders.reduce((s, o) => s + (o.status !== "CANCELLED" ? o.costAmount : 0), 0);
    const grossProfit = lifetimeTurnover - totalCost;
    const avgOrderValue = client.orders.length > 0 ? Math.round(lifetimeTurnover / client.orders.length) : 0;

    // Determine status
    let status = client.status;
    if (client.creditLimit > 0 && currentDebt > client.creditLimit) status = "CRITICAL";
    else if (client.orders.some((o) => o.outstandingAmount > 0 && o.dueDate && o.dueDate < new Date())) status = "RED";
    else if (currentDebt > 0) status = "YELLOW";

    const enriched = {
      ...client,
      financialProfile: {
        lifetimeTurnover,
        totalPaid,
        currentDebt,
        totalCost: role === "OPERATOR" ? undefined : totalCost,
        grossProfit: role === "OPERATOR" ? undefined : grossProfit,
        avgOrderValue,
        totalOrders: client.orders.length,
        creditLimit: client.creditLimit,
        creditUtilization: client.creditLimit > 0 ? Math.round((currentDebt / client.creditLimit) * 100) : 0,
      },
      status,
    };

    // Strip financials for warehouse
    if (role === "WAREHOUSE") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    return NextResponse.json({ client: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
