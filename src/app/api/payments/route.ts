import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, scopePaymentsForUser, type AuthContext } from "@/lib/authz";

export async function GET() {
  try {
    const ctx = await requirePermission("finance.view_payments");
    const payments = await db.orderPayment.findMany({
      where: scopePaymentsForUser(ctx),
      include: { order: { include: { client: true } } },
      orderBy: { paidAt: "desc" },
      take: 100,
    });

    if (ctx.role === "OPERATOR") {
      return NextResponse.json({
        payments: payments.map((p) => ({ ...p, order: { ...p.order, costAmount: undefined, grossProfit: undefined, marginPercent: undefined } })),
      });
    }
    return NextResponse.json({ payments });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: e?.status ?? 403 });
  }
}

export async function POST(req: Request) {
  let ctx: AuthContext | undefined;
  try {
    ctx = await requirePermission("finance.record_payment");
    const body = await req.json();
    const { orderId, amount, method, note } = body as { orderId: string; amount: number; method: string; note?: string };

    if (!orderId || !amount || amount <= 0) {
      return NextResponse.json({ error: "orderId and positive amount required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount > 1_000_000_000) {
      return NextResponse.json({ error: "amount out of range" }, { status: 400 });
    }
    // Round to integer currency units (AMD) to avoid floating-point money.
    const amountInt = Math.round(amount);
    if (amountInt <= 0) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    }
    if (!["cash", "bank", "transfer", "card"].includes(method)) {
      return NextResponse.json({ error: "invalid payment method" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // Lock the order row by reading it inside the transaction.
      // Prisma serializable transactions on Postgres use snapshot isolation;
      // we additionally guard with a conditional updateMany.
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw Object.assign(new Error("order not found"), { status: 404 });
      if (order.status === "DRAFT") {
        throw Object.assign(new Error("Նախ հաստատեք սևագիրը"), { status: 409 });
      }
      if (order.status === "CANCELLED") {
        throw Object.assign(new Error("Չեղարկված պատվերի վրա վճարում գրանցել չի կարելի"), { status: 409 });
      }

      const newPaid = order.paidAmount + amountInt;
      // Prevent overpayment: a single payment must not exceed outstanding.
      if (newPaid > order.totalAmount) {
        throw Object.assign(new Error("Վճարման գումարը գերազանցում է մնացորդը"), { status: 409 });
      }

      const payment = await tx.orderPayment.create({
        data: { orderId, amount: amountInt, method, note: note ?? null, byUserId: ctx!.userId },
      });

      const newOutstanding = Math.max(0, order.totalAmount - newPaid);
      const newStatus = newOutstanding === 0 ? "DELIVERED" : order.status;

      // Conditional update — only succeeds if outstanding is still consistent.
      const updated = await tx.order.updateMany({
        where: { id: orderId, paidAmount: order.paidAmount },
        data: { paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus },
      });
      if (updated.count === 0) {
        // Concurrent payment raced us; roll back.
        throw Object.assign(new Error("Պատվերի վճարման վիճակը փոխվել է, փորձեք կրկին"), { status: 409 });
      }

      await tx.auditLog.create({
        data: {
          actorId: ctx!.userId,
          action: "payment.create",
          entityType: "Order",
          entityId: orderId,
          afterJson: JSON.stringify({ amount: amountInt, method, newPaid, newOutstanding }),
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
            generatedById: ctx!.userId,
          },
        });
      }

      return payment;
    });

    return NextResponse.json({ payment: result });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status });
  }
}
