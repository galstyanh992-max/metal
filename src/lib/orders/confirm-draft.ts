import { db } from "@/lib/db";
import { evaluateFormula } from "@/lib/bom/dsl";
import { recordMovement } from "@/lib/inventory/ledger";
import { createOrderDocuments } from "./documents";

export class OrderConfirmationError extends Error {}

export async function confirmDraftOrder(
  id: string,
  userId: string,
  paymentMethod: "debt" | "cash" | "transfer" = "debt",
) {
  return db.$transaction(async (tx) => {
    // Claim the draft first. Concurrent confirmations cannot reserve or charge twice.
    const claimed = await tx.order.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "CONFIRMED" },
    });
    if (claimed.count !== 1) throw new OrderConfirmationError("Միայն սևագիրը կարող է հաստատվել");

    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { parameters: true, product: { include: { unit: true } } } } },
    });
    if (!order.items.length) throw new OrderConfirmationError("Ավելացրեք ապրանքներ պատվերին");

    for (const item of order.items) {
      const isService = item.product.unit.code === "service" || item.parameters.some((p) => p.fieldKey === "isService" && p.value === "true");
      if (!Number.isSafeInteger(item.qty) || item.qty <= 0 || item.unitPriceSnapshot <= 0) {
        throw new OrderConfirmationError(`Ստուգեք «${item.productName}» ապրանքի քանակը և գինը`);
      }
      if (isService) continue;

      const reserve = async (productId: string, qty: number, name: string, note: string) => {
        const result = await recordMovement({
          productId, qty, type: "RESERVE", byUserId: userId,
          refType: "ORDER", refId: id, note,
        }, tx);
        if (!result.ok) throw new OrderConfirmationError(`«${name}» — ${result.error}`);
      };
      await reserve(item.productId, item.qty, item.productName, `Պատվեր ${order.number}`);

      if (!item.product.categoryId) continue;
      const rules = await tx.bomRule.findMany({
        where: { productTypeId: item.product.categoryId, active: true, archivedAt: null },
        include: { componentProduct: true },
      });
      const ctx: Record<string, number> = {};
      for (const parameter of item.parameters) {
        const value = Number(parameter.value);
        if (Number.isFinite(value)) ctx[parameter.fieldKey] = value;
      }
      ctx.quantity ??= ctx.qty ?? item.qty;
      ctx.qty ??= ctx.quantity;

      for (const rule of rules) {
        let rawQty: number;
        try {
          rawQty = evaluateFormula(rule.formulaExpr, { ...ctx, coefficient: rule.coefficient, waste: rule.waste });
        } catch {
          throw new OrderConfirmationError(`Չհաջողվեց հաշվարկել «${rule.componentProduct.name}» բաղադրիչը`);
        }
        const totalQty = rawQty + Math.round(rawQty * rule.waste);
        const roundedQty = rule.rounding > 0 ? Math.ceil(totalQty / rule.rounding) * rule.rounding : Math.ceil(totalQty);
        const qty = Math.max(rule.minimum, roundedQty);
        if (!Number.isFinite(qty) || qty < 0) throw new OrderConfirmationError("Բաղադրիչի քանակը սխալ է");
        if (qty === 0) continue;
        await reserve(rule.componentProductId, qty, rule.componentProduct.name, `BOM: ${order.number} → ${rule.componentProduct.name}`);
      }
    }

    const paidNow = paymentMethod === "cash" || paymentMethod === "transfer";
    const paidAmount = paidNow ? order.totalAmount : order.paidAmount;
    await tx.order.update({
      where: { id },
      data: { paidAmount, outstandingAmount: Math.max(0, order.totalAmount - paidAmount) },
    });
    if (paidNow && paidAmount > 0) {
      await tx.orderPayment.create({
        data: {
          orderId: id, amount: paidAmount, method: paymentMethod === "cash" ? "cash" : "bank",
          byUserId: userId, note: "Սևագրի հաստատում",
        },
      });
    }
    await createOrderDocuments(tx, id, userId, paidNow && paidAmount > 0);
    await tx.orderStatusHistory.create({
      data: { orderId: id, status: "CONFIRMED", byUserId: userId, note: "Սևագիրը հաստատված է, պաշարները՝ ամրագրված" },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId, action: "order.confirm", entityType: "Order", entityId: id,
        afterJson: JSON.stringify({ status: "CONFIRMED", paymentMethod }),
      },
    });
  }, { timeout: 30000 });
}
