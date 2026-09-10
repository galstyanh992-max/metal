import { describe, expect, test } from "bun:test";
import { reconcileQuickFillRows, quickFillRowsToOrderItems } from "../src/lib/orders/quick-fill";
import { buildItemsFromCalculatorRows, type CalculatorRow } from "../src/lib/orders/calculator-order";

const product = { id: "p1", name: "Panel", sku: "P-1", salePrice: 100, stock: { available: 0 } };
const calcRow: CalculatorRow = { productId: "p1", name: "Old panel name", qty: 2, meters: 2.5, price: 100, sum: 250, unitCode: "m" };

describe("order entry survives catalog refreshes", () => {
  test("keeps entered quantities and prices when favorites or stock change", () => {
    const initial = reconcileQuickFillRows([product], []);
    const edited = [{ ...initial[0], selected: true, qty: 3, meterage: 2.5, unitPrice: 120 }];
    const refreshed = reconcileQuickFillRows([{ ...product, isFavorite: true, salePrice: 150, stock: { available: 20 } }], edited);
    expect(refreshed[0]).toMatchObject({ selected: true, qty: 3, meterage: 2.5, unitPrice: 120, salePriceOriginal: 150, stock: 20, isFavorite: true });
    expect(quickFillRowsToOrderItems(refreshed)[0]).toMatchObject({ productId: "p1", qty: 3, unitPrice: 120, parameters: { quantity: "2.5", meterage: "2.5" } });
  });

  test("preserves the quoted price for selected rows, updates untouched rows", () => {
    const initial = reconcileQuickFillRows([product, { ...product, id: "p2" }], []);
    initial[0].selected = true;
    const refreshed = reconcileQuickFillRows([ { ...product, salePrice: 200 }, { ...product, id: "p2", salePrice: 200 } ], initial);
    expect(refreshed.find((row) => row.productId === "p1")?.unitPrice).toBe(100);
    expect(refreshed.find((row) => row.productId === "p2")?.unitPrice).toBe(200);
  });

  test("keeps values attached to product IDs when favorites reorder rows", () => {
    const initial = reconcileQuickFillRows([product, { ...product, id: "p2", name: "Tube" }], []);
    initial[0] = { ...initial[0], qty: 4, selected: true };
    const refreshed = reconcileQuickFillRows([product, { ...product, id: "p2", name: "Tube", isFavorite: true }], initial);
    expect(refreshed[0].productId).toBe("p2");
    expect(quickFillRowsToOrderItems(refreshed)).toHaveLength(1);
    expect(quickFillRowsToOrderItems(refreshed)[0]).toMatchObject({ productId: "p1", qty: 4 });
  });

  test("includes selected products without stock in a draft payload", () => {
    const rows = reconcileQuickFillRows([product], []);
    rows[0] = { ...rows[0], selected: true, qty: 2 };
    expect(quickFillRowsToOrderItems(rows)[0]).toMatchObject({ productId: "p1", qty: 2 });
  });
});

describe("calculator product mapping", () => {
  test("uses the selected ID even when the catalog name has changed", async () => {
    const items = await buildItemsFromCalculatorRows([calcRow], [product, { ...product, id: "p2", name: calcRow.name }]);
    expect(items[0]).toMatchObject({ productId: "p1", qty: 2, unitPrice: 100, lineTotal: 250, parameters: { meterage: "2.5" } });
  });

  test("supports a unique normalized name for legacy calculator variants", async () => {
    const items = await buildItemsFromCalculatorRows([{ ...calcRow, productId: "legacy-variant", name: " PANEL " }], [product]);
    expect(items[0].productId).toBe("p1");
  });

  test("reports a missing product before posting an order", async () => {
    await expect(buildItemsFromCalculatorRows([calcRow], [])).rejects.toThrow(calcRow.name);
  });

  test("does not silently select the first of multiple partial matches", async () => {
    await expect(buildItemsFromCalculatorRows([{ ...calcRow, productId: null, name: "Panel" }], [
      { ...product, name: "Panel 50" }, { ...product, id: "p2", name: "Panel 70" },
    ])).rejects.toThrow("Panel");
  });
});
