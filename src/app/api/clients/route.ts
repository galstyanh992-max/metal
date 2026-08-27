import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("client.list");
    const clients = await db.client.findMany({
      where: { active: true, archivedAt: null },
      include: {
        orders: { select: { id: true, totalAmount: true, outstandingAmount: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Compute financial profile
    const enriched = clients.map((c) => {
      const lifetimeTurnover = c.orders.reduce((s, o) => s + (o.status !== "CANCELLED" ? o.totalAmount : 0), 0);
      const currentDebt = c.orders.reduce((s, o) => s + (o.status !== "CANCELLED" ? o.outstandingAmount : 0), 0);
      const totalOrders = c.orders.length;
      const lastOrderDate = c.orders[0]?.createdAt ?? null;
      return {
        id: c.id,
        type: c.type,
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName,
        phone: c.phone,
        email: c.email,
        status: c.status,
        loyaltyDiscount: c.loyaltyDiscount,
        creditLimit: c.creditLimit,
        lifetimeTurnover,
        currentDebt,
        totalOrders,
        lastOrderDate,
      };
    });

    return NextResponse.json({ clients: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("client.create");
    const body = await req.json();
    const { type, firstName, lastName, companyName, taxId, phone, email, primaryAddress, preferredLanguage, preferredChannel } = body;

    const client = await db.client.create({
      data: {
        type: type ?? "INDIVIDUAL",
        firstName: type === "COMPANY" ? null : firstName,
        lastName: type === "COMPANY" ? null : lastName,
        companyName: type === "COMPANY" ? companyName : null,
        taxId: type === "COMPANY" ? taxId : null,
        phone,
        email: email ?? null,
        primaryAddress: primaryAddress ?? null,
        preferredLanguage: preferredLanguage ?? "hy",
        preferredChannel: preferredChannel ?? "whatsapp",
      },
    });

    await db.auditLog.create({
      data: { actorId: userId, action: "client.create", entityType: "Client", entityId: client.id, afterJson: JSON.stringify({ type: client.type, phone }) },
    });

    return NextResponse.json({ client });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
