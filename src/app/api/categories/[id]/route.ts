import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

/**
 * PATCH /api/categories/[id] — rename a category (ADMIN only).
 * Body: { name? }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAction("product.manage_categories");
    const { id } = await params;
    const body = await req.json();
    const { name, sortOrder, active } = body as {
      name?: string;
      sortOrder?: number;
      active?: boolean;
    };

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "category not found" }, { status: 404 });
    }

    const patch: any = {};
    if (typeof name === "string" && name.trim() && name !== existing.name) {
      patch.name = name.trim();
    }
    if (typeof sortOrder === "number") patch.sortOrder = sortOrder;
    if (typeof active === "boolean") patch.active = active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ category: existing, changed: false });
    }

    const updated = await db.category.update({ where: { id }, data: patch });
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "category.update",
        entityType: "Category",
        entityId: id,
        beforeJson: JSON.stringify({ name: existing.name }),
        afterJson: JSON.stringify({ name: updated.name, sortOrder: updated.sortOrder, active: updated.active }),
      },
    });

    return NextResponse.json({ category: updated, changed: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/categories/[id] — soft-delete (active=false) a category.
 * Hard-delete only if no products reference it.
 * If products use this category, they will be unassigned (categoryId=null) on hard-delete.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAction("product.manage_categories");
    const { id } = await params;

    const existing = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "category not found" }, { status: 404 });
    }

    const productCount = existing._count.products;

    // Hard-delete if never used
    if (productCount === 0) {
      await db.category.delete({ where: { id } });
      await db.auditLog.create({
        data: {
          actorId: userId,
          action: "category.delete",
          entityType: "Category",
          entityId: id,
          beforeJson: JSON.stringify({ name: existing.name }),
        },
      });
      return NextResponse.json({ deleted: true, hard: true });
    }

    // Soft-delete + unassign products
    await db.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });
    await db.category.update({
      where: { id },
      data: { active: false },
    });
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "category.archive",
        entityType: "Category",
        entityId: id,
        beforeJson: JSON.stringify({ name: existing.name, productCount }),
      },
    });

    return NextResponse.json({
      deleted: true,
      hard: false,
      reason: `${productCount} ապրանք ապակապակցված են, կատեգորիան արխիվացված է`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
