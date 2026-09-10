import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { releaseOrderStock, OrderStockError } from "@/lib/inventory/order-reservations";
import { confirmDraftOrder, OrderConfirmationError } from "@/lib/orders/confirm-draft";
import type { Order } from "@prisma/client";

async function cancelOrder(order: Order, userId: string) {
  if (order.status === "CANCELLED") throw new OrderConfirmationError("Պատվերն արդեն չեղարկված է");
  await db.$transaction(async (tx) => {
    const cancelled = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: "CANCELLED", outstandingAmount: 0 },
    });
    if (cancelled.count !== 1) throw new OrderConfirmationError("Պատվերի կարգավիճակը փոխվել է։ Թարմացրեք էջը։");
    if (order.status !== "DRAFT") await releaseOrderStock(tx, order.id, userId);
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: "CANCELLED", byUserId: userId, note: "Պատվերը չեղարկված է, ամրագրումները՝ ազատված" },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: "order.cancel", entityType: "Order", entityId: order.id, afterJson: JSON.stringify({ action: "cancel" }) },
    });
  }, { timeout: 30000 });
  return NextResponse.json({ ok: true, order: { id: order.id, status: "CANCELLED", paidAmount: order.paidAmount, outstandingAmount: 0 } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role } = await requireAction("order.list");
    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      include: {
        client: true,
        items: { orderBy: { sortOrder: "asc" }, include: { parameters: true, product: { include: { unit: true } } } },
        payments: { orderBy: { paidAt: "desc" } },
        statusHistory: { orderBy: { at: "asc" } },
        documents: true,
        communications: true,
      },
    });

    if (!order || (role === "WAREHOUSE" && order.status === "DRAFT")) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Strip financial fields based on role
    if (role === "WAREHOUSE") {
      const { baseAmount, discountAmount, taxAmount, totalAmount, paidAmount, outstandingAmount, costAmount, grossProfit, marginPercent, ...rest } = order as any;
      return NextResponse.json({
        order: {
          ...rest,
          items: rest.items.map((it: any) => {
            const { unitPriceSnapshot, lineTotal, ...itemRest } = it;
            return itemRest;
          }),
          payments: [],
        },
      });
    }
    if (role === "OPERATOR") {
      const { costAmount, grossProfit, marginPercent, ...rest } = order as any;
      return NextResponse.json({ order: rest });
    }
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, role } = await requireAction("order.confirm");
    const { id } = await params;
    const body = await req.json();
    const { action, paymentMethod = "debt" } = body as { action: "confirm" | "cancel" | "mark_ready"; paymentMethod?: "debt" | "cash" | "transfer" };
    if (!["confirm", "cancel", "mark_ready"].includes(action) || !["debt", "cash", "transfer"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid order action or payment method" }, { status: 400 });
    }

    const order = await db.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (action === "confirm") {
      const confirmed = await confirmDraftOrder(id, userId, paymentMethod);
      return NextResponse.json({ ok: true, order: confirmed });
    } else if (action === "cancel") {
      if (order.status === "DELIVERED") return NextResponse.json({ error: "cannot cancel delivered" }, { status: 400 });
      return await cancelOrder(order, userId);
    } else if (action === "mark_ready") {
      if (order.status !== "CONFIRMED") return NextResponse.json({ error: "only confirmed can be marked ready" }, { status: 400 });
      await db.order.update({ where: { id }, data: { status: "READY" } });
      await db.orderStatusHistory.create({ data: { orderId: id, status: "READY", byUserId: userId } });
    }

    await db.auditLog.create({
      data: { actorId: userId, action: `order.${action}`, entityType: "Order", entityId: id, afterJson: JSON.stringify({ action }) },
    });

    return NextResponse.json({ ok: true, order: { id, status: "READY", paidAmount: order.paidAmount, outstandingAmount: order.outstandingAmount } });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    if (e instanceof OrderConfirmationError || e instanceof OrderStockError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
