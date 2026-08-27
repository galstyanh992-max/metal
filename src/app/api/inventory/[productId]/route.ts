import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { computeInventoryState } from "@/lib/inventory/ledger";

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
