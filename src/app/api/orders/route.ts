import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { computeInventoryState } from "@/lib/inventory/ledger";
import { addAMD, subAMD } from "@/lib/finance/money";

export async function GET() {
  try {
    const { role } = await requireAction("order.list");

    const orders = await db.order.findMany({
      include: {
        client: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Strip financial fields for warehouse
    const sanitized = orders.map((o) => {
      if (role === "WAREHOUSE") {
        const { baseAmount, discountAmount, taxAmount, totalAmount, paidAmount, outstandingAmount, costAmount, grossProfit, marginPercent, ...rest } = o;
        return {
          ...rest,
          items: o.items.map((it) => {
            const { unitPriceSnapshot, lineTotal, ...itemRest } = it;
            return itemRest;
          }),
        };
      }
      if (role === "OPERATOR") {
        const { costAmount, grossProfit, marginPercent, ...rest } = o;
        return rest;
      }
      return o;
    });

    return NextResponse.json({ orders: sanitized });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const { role, userId } = await requireAction("order.create");
    const body = await req.json();
    const { clientId, items, note, dueDate, savePrices } = body as {
      clientId: string;
      items: Array<{
        productId: string;
        qty: number;
        parameters: Record<string, string>;
        unitPrice?: number;       // optional override (Quick-Fill)
        savePriceToProduct?: boolean; // persist override back to product
      }>;
      note?: string;
      dueDate?: string;
      savePrices?: boolean; // global flag — apply all per-item overrides to catalog
    };

    if (!clientId || !items?.length) {
      return NextResponse.json({ error: "clientId and items required" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

    // Fetch products with prices (admin captures cost too)
    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let baseAmount = 0;
    let costAmount = 0;
    const orderItemsData: any[] = [];
    const priceUpdates: Array<{ productId: string; salePrice: number }> = [];

    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) return NextResponse.json({ error: `product ${it.productId} not found` }, { status: 400 });
      // Use override if provided, else fall back to product salePrice
      const unitPrice = typeof it.unitPrice === "number" && it.unitPrice > 0
        ? Math.floor(it.unitPrice)
        : p.salePrice;
      const lineTotal = unitPrice * it.qty;
      baseAmount += lineTotal;
      costAmount += p.purchasePrice * it.qty;
      orderItemsData.push({
        productId: p.id,
        productName: p.name,
        qty: it.qty,
        unitId: p.unitId,
        unitPriceSnapshot: unitPrice,
        lineTotal,
        sortOrder: orderItemsData.length,
        parameters: {
          create: Object.entries(it.parameters ?? {}).map(([key, value]) => ({
            fieldKey: key,
            value: String(value),
            label: key, // simplified — would normally lookup from FormTemplate
          })),
        },
      });
      // Collect price updates if requested
      if ((savePrices || it.savePriceToProduct) && unitPrice !== p.salePrice) {
        priceUpdates.push({ productId: p.id, salePrice: unitPrice });
      }
    }

    // Loyalty discount
    const discountPercent = client.loyaltyDiscount ?? 0;
    const discountAmount = Math.round((baseAmount * discountPercent) / 100);
    const totalAmount = baseAmount - discountAmount;
    const outstandingAmount = totalAmount;
    const grossProfit = totalAmount - costAmount;
    const marginPercent = totalAmount > 0 ? Math.round((grossProfit / totalAmount) * 10000) : 0;

    const year = new Date().getFullYear();
    const count = await db.order.count({ where: { number: { startsWith: `ORD-${year}-` } } });
    const number = `ORD-${year}-${String(count + 1).padStart(4, "0")}`;

    const order = await db.order.create({
      data: {
        number,
        clientId,
        status: "DRAFT",
        baseAmount,
        discountAmount,
        taxAmount: 0, // computed by tax engine separately
        totalAmount,
        paidAmount: 0,
        outstandingAmount,
        costAmount: role === "OPERATOR" ? 0 : costAmount, // operator doesn't persist cost visibly
        grossProfit: role === "OPERATOR" ? 0 : grossProfit,
        marginPercent: role === "OPERATOR" ? 0 : marginPercent,
        dueDate: dueDate ? new Date(dueDate) : null,
        note: note ?? null,
        createdById: userId,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "order.create",
        entityType: "Order",
        entityId: order.id,
        afterJson: JSON.stringify({ number, clientId, totalAmount }),
      },
    });

    // Apply price updates back to catalog (Quick-Fill feature)
    if (priceUpdates.length > 0) {
      for (const pu of priceUpdates) {
        const prev = await db.productPriceHistory.findFirst({
          where: { productId: pu.productId, effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
        });
        if (prev) {
          await db.productPriceHistory.update({
            where: { id: prev.id },
            data: { effectiveTo: new Date() },
          });
        }
        await db.product.update({
          where: { id: pu.productId },
          data: { salePrice: pu.salePrice },
        });
        await db.productPriceHistory.create({
          data: {
            productId: pu.productId,
            salePrice: pu.salePrice,
            purchasePrice: productMap.get(pu.productId)?.purchasePrice ?? 0,
            changedById: userId,
            reason: `Quick-Fill update (order ${number})`,
          },
        });
        await db.auditLog.create({
          data: {
            actorId: userId,
            action: "price.update",
            entityType: "Product",
            entityId: pu.productId,
            beforeJson: JSON.stringify({ salePrice: productMap.get(pu.productId)?.salePrice ?? 0 }),
            afterJson: JSON.stringify({ salePrice: pu.salePrice }),
          },
        });
      }
    }

    return NextResponse.json({ order, priceUpdates: priceUpdates.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
