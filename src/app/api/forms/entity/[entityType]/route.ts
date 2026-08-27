import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

/**
 * Get the active form template for a given entity type.
 * Used by the order dialog to render dynamic fields.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ entityType: string }> }) {
  try {
    await requireRole("ADMIN", "OPERATOR");
    const { entityType } = await params;
    const normalized = entityType.toUpperCase() as "PRODUCT" | "ORDER_ITEM" | "CLIENT";

    const template = await db.formTemplate.findFirst({
      where: { entityType: normalized, active: true },
      include: {
        groups: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: {
            fields: {
              where: { archivedAt: null },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!template) return NextResponse.json({ template: null });
    return NextResponse.json({ template });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
