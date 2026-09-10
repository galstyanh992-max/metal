import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { computeInventoryState } from "@/lib/inventory/ledger";
import { addAMD, subAMD } from "@/lib/finance/money";
import { computeLineTotal, parseDecimal } from "@/lib/orders/calc-math";

export async function GET() {
  try {
    const { role } = await requireAction("order.list");

    // OPTIMIZED: Use select instead of include to fetch only needed fields
    const orders = await db.order.findMany({
      select: {
        id: true,
        number: true,
        status: true,
        baseAmount: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        costAmount: true,
        grossProfit: true,
        marginPercent: true,
        note: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true, email: true },
        },
        items: {
          select: { id: true, productId: true, productName: true, qty: true, unitId: true, unitPriceSnapshot: true, lineTotal: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        },
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
    const { clientId, items, note, dueDate, savePrices, paymentMethod, discountPercent } = body as {
      clientId: string;
      items: Array<{
        productId: string;
        qty: number;
        parameters: Record<string, string>;
        unitPrice?: number;       // optional override (Quick-Fill)
        lineTotal?: number;       // optional authoritative line total (calculator)
        savePriceToProduct?: boolean; // persist override back to product
      }>;
      note?: string;
      dueDate?: string;
      savePrices?: boolean; // global flag — apply all per-item overrides to catalog
      paymentMethod?: "debt" | "cash" | "transfer";
      discountPercent?: number;
    };

    if (!clientId || !items?.length) {
      return NextResponse.json({ error: "clientId and items required" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

    // Fetch products with prices (admin captures cost too)
    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      include: { unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // ====== INVENTORY CHECK (OPTIMIZED — bulk query) ======
    // Verify each item has enough available stock. If not, return error with product name.
    // Before: N queries (one per item) — After: 1 bulk query for all movements
    const allMovements = await db.inventoryMovement.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, type: true, qty: true },
    });
    // Compute stock per product in memory
    const stockMap = new Map<string, number>();
    for (const m of allMovements) {
      if (!stockMap.has(m.productId)) stockMap.set(m.productId, 0);
      const cur = stockMap.get(m.productId)!;
      if (["RECEIVE", "RETURN"].includes(m.type)) stockMap.set(m.productId, cur + m.qty);
      else if (["ISSUE", "WRITE_OFF"].includes(m.type)) stockMap.set(m.productId, cur - m.qty);
      else if (m.type === "ADJUSTMENT") stockMap.set(m.productId, cur + m.qty);
    }

    const stockErrors: string[] = [];
    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) {
        stockErrors.push(`Ապրանքը չի գտնվել (ID: ${it.productId})`);
        continue;
      }
      // Services (Հավաքում / Առաքում) are not stock items — skip stock check.
      const isService = it.parameters?.isService === "true" || p.unit?.code === "service";
      if (isService) continue;
      const requestedPrice = typeof it.unitPrice === "number" && it.unitPrice > 0
        ? it.unitPrice
        : p.salePrice;
      if (requestedPrice <= 0) {
        stockErrors.push(`«${p.sku}» ապրանքի վաճառքի գինը նշված չէ`);
        continue;
      }
      const available = Math.max(0, stockMap.get(p.id) ?? 0);
      if (available < it.qty) {
        stockErrors.push(
          `«${p.name}» (${p.sku}) — պահեստում մատչելի է ${available} հատ, պատվերում՝ ${it.qty} հատ`
        );
      }
    }
    if (stockErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Պատվերը հնարավոր չէ ընդունել",
          details: stockErrors,
          stockError: true,
        },
        { status: 409 }
      );
    }

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
      const unitCode = p.unit?.code;
      const isService = it.parameters?.isService === "true" || unitCode === "service";
      const meterage = it.parameters?.meterage != null ? parseDecimal(it.parameters.meterage) : null;

      // Line total — single source of truth (shared with calculator-order.ts)
      const lineTotal = computeLineTotal({
        unitCode,
        price: unitPrice,
        qty: it.qty,
        meters: meterage,
        isService,
        explicitLineTotal: it.lineTotal,
      });

      baseAmount += lineTotal;
      costAmount += isService ? 0 : p.purchasePrice * it.qty;
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
      // Collect price updates if requested (never for services)
      if (!isService && (savePrices || it.savePriceToProduct) && unitPrice !== p.salePrice) {
        priceUpdates.push({ productId: p.id, salePrice: unitPrice });
      }
    }

    // Loyalty discount + manual discount (from UI input) — combined
    const loyaltyDiscount = client.loyaltyDiscount ?? 0;
    const manualDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    // Apply manual discount first, then loyalty on the remaining amount
    const manualDiscountAmount = Math.round((baseAmount * manualDiscount) / 100);
    const afterManualDiscount = baseAmount - manualDiscountAmount;
    const loyaltyDiscountAmount = Math.round((afterManualDiscount * loyaltyDiscount) / 100);
    const totalDiscountPercent = manualDiscount + loyaltyDiscount;
    const totalDiscountAmount = manualDiscountAmount + loyaltyDiscountAmount;
    const totalAmount = Math.max(0, baseAmount - totalDiscountAmount);

    // Order status:
    // - cash/transfer → CONFIRMED (paid)
    // - debt → CONFIRMED (sent to warehouse for picking, no prices visible to warehouse)
    // (Previously debt was DRAFT — now all orders go to CONFIRMED so warehouse sees them)
    const isPaidNow = paymentMethod === "cash" || paymentMethod === "transfer";
    const paidAmount = isPaidNow ? totalAmount : 0;
    const outstandingAmount = totalAmount - paidAmount;
    const grossProfit = totalAmount - costAmount;
    const marginPercent = totalAmount > 0 ? Math.round((grossProfit / totalAmount) * 10000) : 0;

    const year = new Date().getFullYear();
    const count = await db.order.count({ where: { number: { startsWith: `ORD-${year}-` } } });
    const number = `ORD-${year}-${String(count + 1).padStart(4, "0")}`;

    const order = await db.order.create({
      data: {
        number,
        clientId,
        status: "CONFIRMED",
        baseAmount,
        discountAmount: totalDiscountAmount,
        taxAmount: 0,
        totalAmount,
        paidAmount,
        outstandingAmount,
        costAmount: role === "OPERATOR" ? 0 : costAmount,
        grossProfit: role === "OPERATOR" ? 0 : grossProfit,
        marginPercent: role === "OPERATOR" ? 0 : marginPercent,
        dueDate: dueDate ? new Date(dueDate) : null,
        note: note ?? (paymentMethod ? `Վճարման եղանակ՝ ${paymentMethod === "cash" ? "Առձեռն" : paymentMethod === "transfer" ? "Փոխանցում" : "Պարտք"}` : null),
        createdById: userId,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // If paid now, record a payment entry
    if (isPaidNow) {
      await db.orderPayment.create({
        data: {
          orderId: order.id,
          amount: paidAmount,
          method: paymentMethod === "cash" ? "cash" : "bank",
          paidAt: new Date(),
          note: `Արագ վճարում (${paymentMethod === "cash" ? "Առձեռն" : "Փոխանցում"})`,
          byUserId: userId,
        },
      });
    }

    // Create the complete document package immediately. Each record points to a
    // stable PDF endpoint, so the document is ready to download for both admins
    // and operators as soon as the order is created.
    const documentTypes: Array<"CUSTOMER_ORDER" | "WAREHOUSE_ORDER" | "INVOICE" | "PROCUREMENT_DOCUMENT" | "DELIVERY_NOTE" | "PAYMENT_RECEIPT"> = ["CUSTOMER_ORDER", "WAREHOUSE_ORDER", "INVOICE", "PROCUREMENT_DOCUMENT", "DELIVERY_NOTE"];
    if (isPaidNow) documentTypes.push("PAYMENT_RECEIPT");
    await db.generatedDocument.createMany({
      data: documentTypes.map((type) => ({
        templateId: `template-${type.toLowerCase()}`,
        templateVersion: 1,
        type,
        entityType: "ORDER",
        entityId: order.id,
        url: `/api/orders/${order.id}/pdf?type=${type}`,
        generatedById: userId,
      })),
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
