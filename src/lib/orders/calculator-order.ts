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
  name: string;
  qty: number;
  meters: number | null;
  price: number;
  sum: number;
};

/**
 * Build order items from calculator rows (find or auto-create products).
 * Does NOT post the order — used by both the standalone calculator and the
 * unified "Ընդունել պատվեր" module.
 */
export async function buildItemsFromCalculatorRows(
  rows: CalculatorRow[],
  products: any[]
): Promise<any[]> {
  const items: any[] = [];
  for (const r of rows) {
    if (!r.name || (r.sum || 0) <= 0) continue;

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

    let productId: string;
    if (product) {
      productId = product.id;
    } else {
      // Auto-create new product
      const sku = `CALC-${Date.now().toString(36).toUpperCase()}-${r.name.replace(/\s/g, "").slice(0, 8).toUpperCase()}`;
      const createRes = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku,
          name: r.name,
          unitId: "1", // հատ (piece) — fallback ID
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

    const qty = r.meters ? Math.max(1, Math.round(r.meters)) : Math.max(1, Math.round(r.qty || 1));
    items.push({
      productId,
      qty,
      unitPrice: Math.round(r.price || 0),
      parameters: {
        quantity: String(r.qty ?? 1),
        ...(r.meters ? { meterage: String(r.meters) } : {}),
        unitPrice: String(Math.round(r.price || 0)),
        fromCalculator: "rolshutter",
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
