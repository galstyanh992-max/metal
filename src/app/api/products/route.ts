import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    const { role } = await requireAction("product.list");
    const [products, snapshots] = await Promise.all([
      db.product.findMany({
      where: { active: true, archivedAt: null },
      include: { unit: true, category: true },
      orderBy: [
        { isFavorite: "desc" }, // նախ հիմնականները
        { name: "asc" },
      ],
      }),
      db.inventorySnapshot.findMany({
        select: { productId: true, onHand: true, reserved: true },
      }),
    ]);

    // Bulk compute available stock (onHand - reserved) for all products
    const stockMap = new Map<string, { onHand: number; reserved: number }>();
    for (const snapshot of snapshots) {
      const st = stockMap.get(snapshot.productId) ?? { onHand: 0, reserved: 0 };
      st.onHand += snapshot.onHand;
      st.reserved += snapshot.reserved;
      stockMap.set(snapshot.productId, st);
    }

    const withStock = products.map((p) => {
      const st = stockMap.get(p.id) ?? { onHand: 0, reserved: 0 };
      const onHand = Math.max(0, st.onHand);
      const reserved = Math.max(0, st.reserved);
      return {
        ...p,
        stock: {
          onHand,
          reserved,
          available: Math.max(0, onHand - reserved),
        },
      };
    });

    if (role === "WAREHOUSE") {
      return NextResponse.json({
        products: withStock.map((p) => {
          const { salePrice, purchasePrice, ...rest } = p as any;
          return rest;
        }),
      });
    }
    if (role === "OPERATOR") {
      return NextResponse.json({
        products: withStock.map((p) => {
          const { purchasePrice, ...rest } = p as any;
          return rest;
        }),
      });
    }
    return NextResponse.json({ products: withStock });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/**
 * POST /api/products — create a new product (ADMIN only).
 * Body: { sku, name, unitId, categoryId?, color?, description?, salePrice?, purchasePrice?, minStock?, barcode? }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("product.create");
    const body = await req.json();
    const {
      sku, name, unitId, unitCode, categoryId, color, description,
      salePrice, purchasePrice, minStock, barcode,
    } = body as {
      sku: string;
      name: string;
      unitId?: string;
      unitCode?: string;
      categoryId?: string;
      color?: string;
      description?: string;
      salePrice?: number;
      purchasePrice?: number;
      minStock?: number;
      barcode?: string;
    };

    // Resolve unit by id or code (code is used by the calculator auto-create path)
    let resolvedUnitId = unitId;
    if (!resolvedUnitId && unitCode) {
      const unit = await db.unit.findUnique({ where: { code: unitCode } });
      resolvedUnitId = unit?.id;
    }

    if (!sku || !name || !resolvedUnitId) {
      return NextResponse.json({ error: "sku, name, unitId required" }, { status: 400 });
    }

    // Check SKU uniqueness
    const existing = await db.product.findUnique({ where: { sku } });
    if (existing) {
      return NextResponse.json({ error: `SKU «${sku}»-ն արդեն օգտագործվում է` }, { status: 409 });
    }

    const product = await db.product.create({
      data: {
        sku: sku.trim(),
        name: name.trim(),
        unitId: resolvedUnitId,
        categoryId: categoryId || null,
        color: color?.trim() || null,
        description: description?.trim() || null,
        barcode: barcode?.trim() || null,
        salePrice: Math.max(0, Math.floor(Number(salePrice) || 0)),
        purchasePrice: Math.max(0, Math.floor(Number(purchasePrice) || 0)),
        minStock: Math.max(0, Math.floor(Number(minStock) || 0)),
      },
      include: { unit: true, category: true },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "product.create",
        entityType: "Product",
        entityId: product.id,
        afterJson: JSON.stringify({ sku, name, salePrice: product.salePrice }),
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
