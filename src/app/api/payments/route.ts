import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    const { role } = await requireAction("finance.view_payments");
    const payments = await db.orderPayment.findMany({
      include: { order: { include: { client: true } } },
      orderBy: { paidAt: "desc" },
      take: 100,
    });

    if (role === "OPERATOR") {
      return NextResponse.json({
        payments: payments.map((p) => ({ ...p, order: { ...p.order, costAmount: undefined, grossProfit: undefined, marginPercent: undefined } })),
      });
    }
    return NextResponse.json({ payments });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("finance.record_payment");
    const body = await req.json();
    const { orderId, amount, method, note } = body as { orderId: string; amount: number; method: string; note?: string };

    if (!orderId || !amount || amount <= 0) {
      return NextResponse.json({ error: "orderId and positive amount required" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("order not found");

      const payment = await tx.orderPayment.create({
        data: { orderId, amount, method, note: note ?? null, byUserId: userId },
      });

      const newPaid = order.paidAmount + amount;
      const newOutstanding = Math.max(0, order.totalAmount - newPaid);
      const newStatus = newOutstanding === 0 ? "DELIVERED" : order.status;

      await tx.order.update({
        where: { id: orderId },
        data: { paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "payment.create",
          entityType: "Order",
          entityId: orderId,
          afterJson: JSON.stringify({ amount, method, newPaid, newOutstanding }),
        },
      });

      const existingReceipt = await tx.generatedDocument.findFirst({
        where: { entityType: "ORDER", entityId: orderId, type: "PAYMENT_RECEIPT" },
        select: { id: true },
      });
      if (!existingReceipt) {
        await tx.generatedDocument.create({
          data: {
            templateId: "template-payment_receipt",
            templateVersion: 1,
            type: "PAYMENT_RECEIPT",
            entityType: "ORDER",
            entityId: orderId,
            url: `/api/orders/${orderId}/pdf?type=PAYMENT_RECEIPT`,
            generatedById: userId,
          },
        });
      }

      return payment;
    });

    return NextResponse.json({ payment: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
