import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

/**
 * PATCH /api/products/[id]
 * Update product fields. Currently supports salePrice / purchasePrice.
 * When prices change, also writes a ProductPriceHistory record.
 *
 * Authorization:
 *   - salePrice change requires `product.edit` (ADMIN) OR `order.override_price`.
 *   - purchasePrice change requires `product.edit` (ADMIN) — operators never see cost.
 *   - name/minStock/categoryId change requires `product.edit` (ADMIN).
 *
 * Body:
 *   { salePrice?: number, purchasePrice?: number, name?: string, minStock?: number }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("product.edit");
    const { id } = await params;
    const body = await req.json();
    const { salePrice, purchasePrice, name, minStock, categoryId } = body as {
      salePrice?: number;
      purchasePrice?: number;
      name?: string;
      minStock?: number;
      categoryId?: string | null;
    };

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "product not found" }, { status: 404 });
    }

    // Operators cannot set purchasePrice (cost hidden). Only ADMIN (product.edit) can.
    const patch: any = {};
    if (typeof salePrice === "number" && salePrice !== existing.salePrice) {
      // salePrice change requires product.edit (already checked above) — allowed.
      patch.salePrice = Math.max(0, Math.floor(salePrice));
    }
    if (typeof purchasePrice === "number" && ctx.role === "ADMIN" && purchasePrice !== existing.purchasePrice) {
      patch.purchasePrice = Math.max(0, Math.floor(purchasePrice));
    }
    if (typeof name === "string" && name.trim() && name !== existing.name) {
      patch.name = name.trim();
    }
    if (typeof minStock === "number" && minStock !== existing.minStock) {
      patch.minStock = Math.max(0, Math.floor(minStock));
    }
    // Allow setting categoryId (including null to remove from category)
    if (categoryId !== undefined && categoryId !== existing.categoryId) {
      patch.categoryId = categoryId || null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ product: existing, changed: false });
    }

    const updated = await db.product.update({
      where: { id },
      data: patch,
      include: { unit: true, category: true },
    });

    // Record price history if either price changed
    if (patch.salePrice !== undefined || patch.purchasePrice !== undefined) {
      const newSale = patch.salePrice ?? existing.salePrice;
      const newPur = patch.purchasePrice ?? existing.purchasePrice;

      // Close previous effective record
      const prev = await db.productPriceHistory.findFirst({
        where: { productId: id, effectiveTo: null },
        orderBy: { effectiveFrom: "desc" },
      });
      if (prev) {
        await db.productPriceHistory.update({
          where: { id: prev.id },
          data: { effectiveTo: new Date() },
        });
      }

      await db.productPriceHistory.create({
        data: {
          productId: id,
          salePrice: newSale,
          purchasePrice: newPur,
          changedById: ctx.userId,
          reason: body.reason ?? "Quick-Fill update",
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          actorId: ctx.userId,
          action: "price.update",
          entityType: "Product",
          entityId: id,
          beforeJson: JSON.stringify({
            salePrice: existing.salePrice,
            purchasePrice: existing.purchasePrice,
          }),
          afterJson: JSON.stringify({ salePrice: newSale, purchasePrice: newPur }),
        },
      });
    }

    return NextResponse.json({ product: updated, changed: true });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: e?.status ?? 500 });
  }
}

/**
 * DELETE /api/products/[id] — soft-delete (archive) a product.
 * Sets active=false + archivedAt=now(). Hard-delete only allowed if product has
 * never been referenced (no orderItems, no inventoryMovements).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("product.archive");
    const { id } = await params;

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "product not found" }, { status: 404 });
    }

    // Check if product has been used in orders or inventory
    const [orderItemCount, movementCount] = await Promise.all([
      db.orderItem.count({ where: { productId: id } }),
      db.inventoryMovement.count({ where: { productId: id } }),
    ]);

    if (orderItemCount === 0 && movementCount === 0) {
      // Hard delete — never used
      await db.product.delete({ where: { id } });
      await db.auditLog.create({
        data: {
          actorId: ctx.userId,
          action: "product.delete",
          entityType: "Product",
          entityId: id,
          beforeJson: JSON.stringify({ sku: existing.sku, name: existing.name }),
        },
      });
      return NextResponse.json({ deleted: true, hard: true });
    }

    // Soft delete — archive
    await db.product.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        actorId: ctx.userId,
        action: "product.archive",
        entityType: "Product",
        entityId: id,
        beforeJson: JSON.stringify({ sku: existing.sku, name: existing.name }),
      },
    });
    return NextResponse.json({ deleted: true, hard: false, reason: "Փոխկապակցված գրառումներ կան — արխիվացված է" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
