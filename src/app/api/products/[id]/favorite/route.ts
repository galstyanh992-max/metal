import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

/**
 * POST /api/products/[id]/favorite — toggle isFavorite flag (ADMIN only).
 *
 * Body: { isFavorite?: boolean } — if omitted, toggles current value.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { isFavorite } = body as { isFavorite?: boolean };

    const existing = await db.product.findUnique({ where: { id }, select: { isFavorite: true, name: true, sku: true } });
    if (!existing) {
      return NextResponse.json({ error: "product not found" }, { status: 404 });
    }

    const newValue = typeof isFavorite === "boolean" ? isFavorite : !existing.isFavorite;

    await db.product.update({
      where: { id },
      data: { isFavorite: newValue },
    });

    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "product.toggle_favorite",
        entityType: "Product",
        entityId: id,
        beforeJson: JSON.stringify({ isFavorite: existing.isFavorite }),
        afterJson: JSON.stringify({ isFavorite: newValue }),
      },
    });

    return NextResponse.json({ id, isFavorite: newValue });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
