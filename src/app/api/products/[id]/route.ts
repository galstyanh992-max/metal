import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

/**
 * PATCH /api/products/[id]
 * Update product fields. Currently supports salePrice / purchasePrice.
 * When prices change, also writes a ProductPriceHistory record.
 *
 * Body:
 *   { salePrice?: number, purchasePrice?: number, name?: string, minStock?: number }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, role } = await requireRole("ADMIN", "OPERATOR");
    const { id } = await params;
    const body = await req.json();
    const { salePrice, purchasePrice, name, minStock } = body as {
      salePrice?: number;
      purchasePrice?: number;
      name?: string;
      minStock?: number;
    };

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "product not found" }, { status: 404 });
    }

    // Operators cannot set purchasePrice (cost hidden)
    const patch: any = {};
    if (typeof salePrice === "number" && salePrice !== existing.salePrice) {
      patch.salePrice = Math.max(0, Math.floor(salePrice));
    }
    if (typeof purchasePrice === "number" && role === "ADMIN" && purchasePrice !== existing.purchasePrice) {
      patch.purchasePrice = Math.max(0, Math.floor(purchasePrice));
    }
    if (typeof name === "string" && name.trim() && name !== existing.name) {
      patch.name = name.trim();
    }
    if (typeof minStock === "number" && minStock !== existing.minStock) {
      patch.minStock = Math.max(0, Math.floor(minStock));
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
          changedById: userId,
          reason: body.reason ?? "Quick-Fill update",
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          actorId: userId,
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
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
