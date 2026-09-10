export type QuickFillRow = {
  productId: string;
  name: string;
  sku: string;
  unitCode: string;
  unitSymbol: string;
  qty: number;
  meterage: number;
  unitPrice: number;
  useMeterage: boolean;
  selected: boolean;
  salePriceOriginal: number;
  isFavorite: boolean;
  stock: number;
};

export type QuickFillTotals = {
  totalQty: number;
  totalMeterage: number;
  totalAmount: number;
  selectedCount: number;
  priceChanges: number;
};

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  unit?: { code: string; symbol: string } | null;
  salePrice?: number | null;
  isFavorite?: boolean;
  stock?: { available: number };
};

/** Refresh catalog metadata without discarding an order being entered. */
export function reconcileQuickFillRows(products: CatalogProduct[], previous: QuickFillRow[]): QuickFillRow[] {
  const previousById = new Map(previous.map((row) => [row.productId, row]));
  return [...products].sort((a, b) => {
    if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
    const aQuick = a.sku?.startsWith("QF-") ? 0 : 1;
    const bQuick = b.sku?.startsWith("QF-") ? 0 : 1;
    return aQuick - bQuick || a.name.localeCompare(b.name);
  }).map((product) => {
    const previousRow = previousById.get(product.id);
    const hasInput = previousRow && (previousRow.selected || previousRow.qty > 0 || previousRow.meterage > 0 || previousRow.unitPrice !== previousRow.salePriceOriginal);
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unitCode: product.unit?.code ?? "piece",
      unitSymbol: product.unit?.symbol ?? "հատ",
      qty: previousRow?.qty ?? 0,
      meterage: previousRow?.meterage ?? 0,
      selected: previousRow?.selected ?? false,
      unitPrice: hasInput ? previousRow.unitPrice : product.salePrice ?? 0,
      useMeterage: ["m", "m2", "kg"].includes(product.unit?.code ?? ""),
      salePriceOriginal: product.salePrice ?? 0,
      isFavorite: !!product.isFavorite,
      stock: product.stock?.available ?? 0,
    };
  });
}

export function quickFillRowsToOrderItems(rows: QuickFillRow[]) {
  return rows.filter((row) => row.selected && (row.qty > 0 || row.meterage > 0)).map((row) => {
    const useMeterage = row.meterage > 0;
    return {
      productId: row.productId,
      qty: useMeterage ? Math.max(1, Math.ceil(row.meterage)) : row.qty,
      parameters: {
        quantity: String(useMeterage ? row.meterage : row.qty),
        ...(useMeterage ? { meterage: String(row.meterage), measurement: String(row.meterage), measurementUnit: row.unitSymbol } : {}),
        unitPrice: String(row.unitPrice),
      },
      unitPrice: row.unitPrice,
      savePriceToProduct: row.unitPrice !== row.salePriceOriginal,
    };
  });
}
