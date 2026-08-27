import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { computeInventoryState } from "@/lib/inventory/ledger";

export async function GET() {
  try {
    const { role } = await requireAction("inventory.view_on_hand");
    const products = await db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, barcode: true, minStock: true, unitId: true },
    });

    const states = await Promise.all(
      products.map(async (p) => ({
        ...p,
        state: await computeInventoryState(p.id),
      }))
    );

    return NextResponse.json({ inventory: states });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
