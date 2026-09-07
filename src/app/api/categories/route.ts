import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("product.list");
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ categories });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/**
 * POST /api/categories — create a new category (ADMIN only).
 * Body: { name, parentId? }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("product.manage_categories");
    const body = await req.json();
    const { name, parentId, sortOrder } = body as {
      name: string;
      parentId?: string;
      sortOrder?: number;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        sortOrder: Number(sortOrder) || 0,
        active: true,
      },
    });

    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "category.create",
        entityType: "Category",
        entityId: category.id,
        afterJson: JSON.stringify({ name: category.name }),
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
