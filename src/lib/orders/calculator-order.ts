/**
 * Shared order-creation logic for the Rolshutter calculator.
 *
 * Used by:
 *  - RolshutterCalculatorWithOrder (standalone tab)
 *  - ClientCreateDialog (embedded calculator mode — order created after client)
 *
 * Strategy for product matching:
 *  - Use the selected catalog ID, or a unique name match for legacy rows.
 *  - Report missing or ambiguous catalog mappings before submitting the order.
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

function productMappingError(name: string) {
  return `«${name}» ապրանքը միանշանակ չի գտնվել կատալոգում։ Ընտրեք համապատասխան ապրանքը կամ ավելացրեք այն կատալոգում և կրկին պահպանեք պատվերը։`;
}

/**
 * Build order items from calculator rows using existing catalog products.
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

    const normalize = (name: string) => name.trim().toLowerCase();
    const name = normalize(r.name);
    let product = r.productId ? products.find((p) => p.id === r.productId) : undefined;
    if (!product) {
      const exact = products.filter((p) => normalize(p.name) === name);
      if (exact.length === 1) product = exact[0];
      else if (exact.length > 1) throw new Error(productMappingError(r.name));
    }
    if (!product) {
      const partial = products.filter((p) => normalize(p.name).includes(name) || name.includes(normalize(p.name)));
      if (partial.length === 1) product = partial[0];
    }
    if (!product) throw new Error(productMappingError(r.name));
    const productId = product.id;

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
  status?: "DRAFT" | "CONFIRMED";
  clientId: string;
  rows: CalculatorRow[];
  total: number;
  paymentMethod: "debt" | "cash" | "transfer";
  discountPercent: number;
  products: any[];
}): Promise<any> {
  const { clientId, rows, total, paymentMethod, discountPercent, products, status = "CONFIRMED" } = opts;

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
      status,
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
