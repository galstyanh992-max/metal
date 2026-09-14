import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { recordMovement } from "@/lib/inventory/ledger";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("procurement.receive_po");
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: "receive" };

    if (action !== "receive") return NextResponse.json({ error: "invalid action" }, { status: 400 });

    // Idempotent + atomic receiving. The PO status transition is guarded by
    // a conditional updateMany — if the row is already RECEIVED/CLOSED, the
    // affected count is 0 and we return early without creating duplicate
    // movements. All movements + status change happen in one transaction.
    const result = await db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
      if (!po) throw Object.assign(new Error("not found"), { status: 404 });
      if (po.status === "RECEIVED" || po.status === "CLOSED") {
        throw Object.assign(new Error("already received"), { status: 400 });
      }

      // Receive all items: create RECEIVE movements for the remaining qty.
      for (const item of po.items) {
        if (item.receivedQty >= item.qty) continue;
        const remaining = item.qty - item.receivedQty;
        const r = await recordMovement({
          productId: item.productId,
          type: "RECEIVE",
          qty: remaining,
          byUserId: ctx.userId,
          refType: "PURCHASE_ORDER",
          refId: po.id,
          note: `Ստացում PO ${po.number}`,
        });
        if (!r.ok) throw new Error(`Receive failed: ${r.error}`);

        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.qty } });
      }

      // Conditional status transition — only one request can flip PENDING -> RECEIVED.
      const updated = await tx.purchaseOrder.updateMany({
        where: { id: po.id, status: { in: ["REQUESTED", "ORDERED", "IN_TRANSIT", "PARTIALLY_RECEIVED"] } },
        data: { status: "RECEIVED", actualDate: new Date() },
      });
      if (updated.count === 0) {
        // Someone else already transitioned; the transaction rolls back the movements.
        throw Object.assign(new Error("already received"), { status: 400 });
      }

      await tx.auditLog.create({
        data: { actorId: ctx.userId, action: "procurement.receive_po", entityType: "PurchaseOrder", entityId: id, afterJson: JSON.stringify({ status: "RECEIVED" }) },
      });

      return { status: "RECEIVED" as const };
    }, { timeout: 30000 });

    return NextResponse.json({ ok: true, status: result.status });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status });
  }
}
