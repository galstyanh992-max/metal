import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { recordMovement } from "@/lib/inventory/ledger";
import { confirmDraftOrder, OrderConfirmationError } from "@/lib/orders/confirm-draft";

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
      await confirmDraftOrder(id, userId, paymentMethod);
      return NextResponse.json({ ok: true });
    } else if (action === "cancel") {
      if (order.status === "DELIVERED") return NextResponse.json({ error: "cannot cancel delivered" }, { status: 400 });
      if (order.status === "DRAFT") {
        await db.$transaction(async (tx) => {
          const cancelled = await tx.order.updateMany({
            where: { id, status: "DRAFT" },
            data: { status: "CANCELLED", outstandingAmount: 0 },
          });
          if (cancelled.count !== 1) throw new OrderConfirmationError("Պատվերի կարգավիճակը փոխվել է։ Թարմացրեք էջը։");
          await tx.orderStatusHistory.create({
            data: { orderId: id, status: "CANCELLED", byUserId: userId, note: "Սևագիրը չեղարկված է" },
          });
          await tx.auditLog.create({
            data: { actorId: userId, action: "order.cancel", entityType: "Order", entityId: id, afterJson: JSON.stringify({ action }) },
          });
        });
        return NextResponse.json({ ok: true });
      }
      // Release main product reservations
      for (const item of order.items) {
        await recordMovement({
          productId: item.productId,
          type: "RELEASE_RESERVATION",
          qty: item.qty,
          byUserId: userId,
          refType: "ORDER",
          refId: order.id,
          note: `Չեղարկում ${order.number}`,
        }).catch(() => null);
      }

      // Release BOM component reservations
      for (const item of order.items) {
        const product = await db.product.findUnique({ where: { id: item.productId }, select: { categoryId: true } });
        if (!product?.categoryId) continue;

        const bomRules = await db.bomRule.findMany({
          where: { productTypeId: product.categoryId, active: true, archivedAt: null },
          include: { componentProduct: true },
        });

        const params = await db.orderItemParameter.findMany({ where: { orderItemId: item.id } });
        const ctx: Record<string, number> = {};
        for (const p of params) {
          const num = parseFloat(p.value);
          if (!isNaN(num)) ctx[p.fieldKey] = num;
        }
        if (ctx.quantity !== undefined && ctx.qty === undefined) ctx.qty = ctx.quantity;
        if (ctx.qty !== undefined && ctx.quantity === undefined) ctx.quantity = ctx.qty;

        const { evaluateFormula } = await import("@/lib/bom/dsl");

        for (const rule of bomRules) {
          try {
            const ruleCtx = { ...ctx, coefficient: rule.coefficient, waste: rule.waste };
            const rawQty = evaluateFormula(rule.formulaExpr, ruleCtx);
            const wasteQty = Math.round(rawQty * rule.waste);
            const totalQty = rawQty + wasteQty;
            const roundedQty = rule.rounding > 0 ? Math.ceil(totalQty / rule.rounding) * rule.rounding : Math.ceil(totalQty);
            const finalQty = Math.max(rule.minimum, roundedQty);

            await recordMovement({
              productId: rule.componentProductId,
              type: "RELEASE_RESERVATION",
              qty: finalQty,
              byUserId: userId,
              refType: "ORDER",
              refId: order.id,
              note: `BOM չեղարկում: ${order.number}`,
            }).catch(() => null);
          } catch (e: any) {
            // Continue releasing even if one fails
          }
        }
      }

      await db.order.update({ where: { id }, data: { status: "CANCELLED", outstandingAmount: 0 } });
      await db.orderStatusHistory.create({ data: { orderId: id, status: "CANCELLED", byUserId: userId, note: "Պաշարները ազատված են" } });
    } else if (action === "mark_ready") {
      if (order.status !== "CONFIRMED") return NextResponse.json({ error: "only confirmed can be marked ready" }, { status: 400 });
      await db.order.update({ where: { id }, data: { status: "READY" } });
      await db.orderStatusHistory.create({ data: { orderId: id, status: "READY", byUserId: userId } });
    }

    await db.auditLog.create({
      data: { actorId: userId, action: `order.${action}`, entityType: "Order", entityId: id, afterJson: JSON.stringify({ action }) },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    if (e instanceof OrderConfirmationError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
