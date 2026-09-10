import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { computeInventoryState, recordMovement } from "@/lib/inventory/ledger";
import { calculateInventoryQuantity, roundInventoryQuantity, type InventoryQuantityInput } from "@/lib/inventory/quantity";

export async function GET(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    await requireAction("inventory.view_history");
    const { productId } = await params;

    const [product, movements, stock] = await Promise.all([
      db.product.findUnique({ where: { id: productId }, include: { unit: true, category: true } }),
      db.inventoryMovement.findMany({
        where: { productId },
        include: { byUser: { select: { name: true } }, branch: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.inventorySnapshot.aggregate({ where: { productId }, _sum: { onHand: true, reserved: true } }),
    ]);

    if (!product) return NextResponse.json({ error: "not found" }, { status: 404 });

    const onHand = roundInventoryQuantity(stock._sum.onHand ?? 0);
    const reserved = roundInventoryQuantity(stock._sum.reserved ?? 0);
    return NextResponse.json({ product, movements, state: { onHand, reserved, available: Math.max(0, roundInventoryQuantity(onHand - reserved)) } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/**
 * POST /api/inventory/[productId] — record inventory movement (ADMIN only).
 * Body: { type, measurement?: InventoryQuantityInput, qty?: number, branchId?, note? }
 * Measurements are converted to the product's stock unit on the server.
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
    const { type, note, branchId, measurement } = body as {
      type: "RECEIVE" | "WRITE_OFF" | "ADJUSTMENT";
      qty: number;
      note?: string;
      branchId?: string;
      measurement?: InventoryQuantityInput;
    };

    if (!type || !["RECEIVE", "WRITE_OFF", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json({ error: "type must be RECEIVE, WRITE_OFF, or ADJUSTMENT" }, { status: 400 });
    }
    const product = await db.product.findUnique({ where: { id: productId }, include: { unit: true } });
    if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });
    if (branchId) {
      const branch = await db.branch.findUnique({ where: { id: branchId } });
      if (!branch?.active) return NextResponse.json({ error: "Ընտրեք գործող մասնաճյուղը" }, { status: 400 });
    }

    let quantity;
    try {
      quantity = calculateInventoryQuantity(measurement ?? { mode: "total", amount: body.qty, unit: product.unit.code }, product.unit, type === "ADJUSTMENT");
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Սխալ քանակ" }, { status: 400 });
    }
    const { qty, calculation } = quantity;
    const movementNote = [measurement ? calculation : null, note?.trim()].filter(Boolean).join(" · ") || `${type} via Պահեստ module`;

    const result = await db.$transaction(async (tx) => {
      const movement = await recordMovement({
        productId,
        type,
        qty,
        byUserId: userId,
        refType: "MANUAL",
        note: movementNote,
        branchId,
      }, tx);
      if (!movement.ok) return movement;
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: `inventory.${type.toLowerCase()}`,
          entityType: "Product",
          entityId: productId,
          afterJson: JSON.stringify({ type, qty, note: movementNote, branchId, measurement }),
        },
      });
      return movement;
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "movement failed" }, { status: 409 });
    }

    const state = await computeInventoryState(productId, branchId);
    return NextResponse.json({ ok: true, qty, calculation, state });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
