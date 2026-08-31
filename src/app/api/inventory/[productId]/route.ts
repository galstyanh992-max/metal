import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { computeInventoryState, recordMovement } from "@/lib/inventory/ledger";

export async function GET(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    await requireAction("inventory.view_history");
    const { productId } = await params;

    const [product, movements, state] = await Promise.all([
      db.product.findUnique({ where: { id: productId }, include: { unit: true, category: true } }),
      db.inventoryMovement.findMany({
        where: { productId },
        include: { byUser: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      computeInventoryState(productId),
    ]);

    if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json({ product, movements, state });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/**
 * POST /api/inventory/[productId] — record inventory movement (ADMIN only).
 * Body: { type: "RECEIVE" | "WRITE_OFF" | "ADJUSTMENT", qty, note? }
 *
 * - RECEIVE   → adds to on-hand (qty > 0)
 * - WRITE_OFF → subtracts from on-hand (qty > 0, will be subtracted)
 * - ADJUSTMENT→ signed correction (qty can be negative)
 */
export async function POST(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { userId } = await requireAction("inventory.adjust");
    const { productId } = await params;
    const body = await req.json();
    const { type, qty, note } = body as {
      type: "RECEIVE" | "WRITE_OFF" | "ADJUSTMENT";
      qty: number;
      note?: string;
    };

    if (!type || !["RECEIVE", "WRITE_OFF", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json({ error: "type must be RECEIVE, WRITE_OFF, or ADJUSTMENT" }, { status: 400 });
    }
    if (typeof qty !== "number" || (type !== "ADJUSTMENT" && qty <= 0)) {
      return NextResponse.json({ error: "qty must be positive" }, { status: 400 });
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });

    const result = await recordMovement({
      productId,
      type,
      qty,
      byUserId: userId,
      refType: "MANUAL",
      note: note ?? `${type} via Պահեստ module`,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "movement failed" }, { status: 409 });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: `inventory.${type.toLowerCase()}`,
        entityType: "Product",
        entityId: productId,
        afterJson: JSON.stringify({ type, qty, note }),
      },
    });

    const state = await computeInventoryState(productId);
    return NextResponse.json({ ok: true, state });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
