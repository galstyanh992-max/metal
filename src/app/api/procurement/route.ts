import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

// Force fresh compile
export async function GET() {
  try {
    await requireAction("procurement.view_purchase_history");
    const pos = await db.purchaseOrder.findMany({
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ purchaseOrders: pos });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    const msg = e?.message ?? "failed";
    const isForbidden = msg === "forbidden";
    return NextResponse.json({ error: msg }, { status: isForbidden ? 403 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("procurement.create_po");
    const body = await req.json();
    const { supplierId, items, expectedDate, note } = body as {
      supplierId: string;
      items: Array<{ productId: string; qty: number; unitPrice: number }>;
      expectedDate?: string;
      note?: string;
    };

    if (!supplierId || !items?.length) {
      return NextResponse.json({ error: "supplierId and items required" }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const count = await db.purchaseOrder.count({ where: { number: { startsWith: `PO-${year}-` } } });
    const number = `PO-${year}-${String(count + 1).padStart(4, "0")}`;

    // Fetch products to get unitId
    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, unitId: true } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const totalAmount = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

    const po = await db.purchaseOrder.create({
      data: {
        number,
        supplierId,
        status: "ORDERED",
        totalAmount,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        note: note ?? null,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            unitId: productMap.get(i.productId)?.unitId ?? "",
            qty: i.qty,
            unitPrice: i.unitPrice,
            total: i.qty * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "procurement.create_po",
        entityType: "PurchaseOrder",
        entityId: po.id,
        afterJson: JSON.stringify({ number, supplierId, totalAmount }),
      },
    });

    return NextResponse.json({ purchaseOrder: po });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
