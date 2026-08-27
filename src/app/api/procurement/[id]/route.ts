import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { recordMovement } from "@/lib/inventory/ledger";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAction("procurement.receive_po");
    const { id } = await params;
    const body = await req.json();
    const { action } = body as { action: "receive" };

    if (action !== "receive") return NextResponse.json({ error: "invalid action" }, { status: 400 });

    const po = await db.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (po.status === "RECEIVED" || po.status === "CLOSED") return NextResponse.json({ error: "already received" }, { status: 400 });

    // Receive all items: create RECEIVE movements
    for (const item of po.items) {
      if (item.receivedQty >= item.qty) continue;
      const remaining = item.qty - item.receivedQty;
      const r = await recordMovement({
        productId: item.productId,
        type: "RECEIVE",
        qty: remaining,
        byUserId: userId,
        refType: "PURCHASE_ORDER",
        refId: po.id,
        note: `Ստացում PO ${po.number}`,
      });
      if (!r.ok) return NextResponse.json({ error: `Receive failed: ${r.error}` }, { status: 400 });

      await db.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.qty } });
    }

    const allReceived = po.items.every((it) => it.receivedQty >= it.qty);
    await db.purchaseOrder.update({
      where: { id },
      data: { status: "RECEIVED", actualDate: new Date() },
    });

    await db.auditLog.create({
      data: { actorId: userId, action: "procurement.receive_po", entityType: "PurchaseOrder", entityId: id, afterJson: JSON.stringify({ status: "RECEIVED" }) },
    });

    return NextResponse.json({ ok: true, status: "RECEIVED" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
