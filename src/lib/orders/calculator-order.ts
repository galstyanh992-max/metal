/**
 * Shared order-creation logic for the Rolshutter calculator.
 *
 * Used by:
 *  - RolshutterCalculatorWithOrder (standalone tab)
 *  - ClientCreateDialog (embedded calculator mode — order created after client)
 *
 * Strategy for product matching:
 *  - Search products by name (case-insensitive contains)
 *  - If found — use that product's ID and current salePrice
 *  - If not found — auto-create a new product with the calculator's name/price
 */

export type CalculatorRow = {
  productId?: string | null;
  name: string;
  qty: number;
  meters: number | null;
  price: number;
  sum: number;
  color?: string | null;
  unitCode?: string;
  isService?: boolean;
};

/**
 * Build order items from calculator rows (find or auto-create products).
 * Does NOT post the order — used by both the standalone calculator and the
 * unified "Ընդունել պատվեր" module.
 *
 * Pricing unit rules (mirror the calculator's own formulas):
 *  - unitCode "m"  → line total = meters × price (per meter)
 *  - unitCode "piece" → line total = qty × price (per piece)
 *  - unitCode "service" → line total = price (flat service fee, qty = 1)
 * The `sum` field is the authoritative line total from the calculator and is
 * used to derive the per-unit price so the saved order matches the calculator.
 */
export async function buildItemsFromCalculatorRows(
  rows: CalculatorRow[],
  products: any[]
): Promise<any[]> {
  const items: any[] = [];
  for (const r of rows) {
    if (!r.name || (r.sum || 0) <= 0) continue;

    const isService = !!r.isService || r.unitCode === "service";
    const unitCode = r.unitCode ?? (r.meters != null ? "m" : "piece");

    // Find by exact name (case-insensitive)
    let product = products.find((p: any) => p.name.toLowerCase() === r.name.toLowerCase());
    if (!product) {
      // Find by partial name
      product = products.find(
        (p: any) =>
          p.name.toLowerCase().includes(r.name.toLowerCase()) ||
          r.name.toLowerCase().includes(p.name.toLowerCase())
      );
    }

    if (!product) {
      throw new Error(`Product "${r.name}" is not mapped to the warehouse. Create or map it before creating an order.`);
    }

    let productId: string;
    if (product) {
      productId = product.id;
    } else {
      // Auto-create new product (services get the "service" unit)
      const sku = `CALC-${Date.now().toString(36).toUpperCase()}-${r.name.replace(/\s/g, "").slice(0, 8).toUpperCase()}`;
      const createRes = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku,
          name: r.name,
          unitCode: isService ? "service" : unitCode,
          salePrice: Math.round(r.price || 0),
          categoryId: null,
        }),
      });
      if (!createRes.ok) {
        const e = await createRes.json();
        throw new Error(`Չհաջողվեց ստեղծել «${r.name}» ապրանքը: ${e.error ?? "սխալ"}`);
      }
      const created = await createRes.json();
      productId = created.product.id;
    }

    // qty: for meter-priced rows the order item qty is the piece count (or 1);
    // for piece-priced rows it is the piece count; services are always 1.
    let qty: number;
    if (isService) {
      qty = 1;
    } else if (unitCode === "m") {
      qty = Math.max(1, Math.round(r.qty || 1));
    } else {
      qty = Math.max(1, Math.round(r.qty || 1));
    }

    // unitPrice: the calculator's per-unit price (per meter / per piece / flat
    // service fee). The authoritative line total is passed separately as
    // `lineTotal` so the saved order always matches the calculator total.
    const unitPrice = Math.round(r.price || 0);

    items.push({
      productId,
      qty,
      unitPrice,
      lineTotal: Math.round(r.sum || 0),
      parameters: {
        quantity: String(r.qty ?? 1),
        ...(r.meters != null ? { meterage: String(r.meters) } : {}),
        ...(r.color ? { color: String(r.color) } : {}),
        unitPrice: String(unitPrice),
        fromCalculator: "rolshutter",
        ...(isService ? { isService: "true" } : {}),
      },
    });
  }
  return items;
}

export async function createOrderFromCalculatorRows(opts: {
  clientId: string;
  rows: CalculatorRow[];
  total: number;
  paymentMethod: "debt" | "cash" | "transfer";
  discountPercent: number;
  products: any[];
}): Promise<any> {
  const { clientId, rows, total, paymentMethod, discountPercent, products } = opts;

  if (!clientId) throw new Error("Ընտրեք հաճախորդ");
  if (rows.length === 0) throw new Error("Լցրեք ապրանքները");
  if (total === 0) throw new Error("Ընդհանուրը 0 է");

  const items = await buildItemsFromCalculatorRows(rows, products);
  if (items.length === 0) throw new Error("Չկան ապրանքներ պատվերի համար");

  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const finalTotal = Math.max(0, total - Math.round((total * pct) / 100));

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId,
      items,
      savePrices: false,
      paymentMethod,
      discountPercent: pct,
      note: `Ստեղծված է Դարպասի Հաշվարկից · Ընդհանուր՝ ${Math.round(finalTotal).toLocaleString("hy-AM")} դր${pct > 0 ? ` · զեղչ ${pct}%` : ""}`,
    }),
  });
  if (!res.ok) {
    const e = await res.json();
    throw Object.assign(new Error(e.error ?? "failed"), {
      stockError: e.stockError,
      details: e.details,
    });
  }
  return res.json();
}
