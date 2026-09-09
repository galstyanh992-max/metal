/**
 * Single source of truth for calculator/order line-total math.
 *
 * Used by:
 *  - src/lib/orders/calculator-order.ts (order creation from calculator)
 *  - src/app/api/orders/route.ts (server-side line total)
 *
 * Rules (mirror the RolshutterCalculator formulas):
 *  - service        → line total = flat price (qty is always 1)
 *  - meter-priced   → line total = price × meterage
 *  - piece-priced   → line total = price × qty
 *
 * All money math is integer AMD; lengths keep full float precision.
 */

/** Parse a numeric value accepting both decimal comma and dot.
 *  "2,990" → 2.99, "6.20" → 6.2. Never applied to names or color codes. */
export function parseDecimal(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const s = v.trim().replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
}

export type LineTotalInput = {
  unitCode?: string | null;
  price: number;
  qty: number;
  meters?: number | null;
  isService?: boolean;
  /** authoritative line total from the calculator (wins if > 0) */
  explicitLineTotal?: number | null;
};

/** Compute a line total in integer AMD. */
export function computeLineTotal(input: LineTotalInput): number {
  const { unitCode, price, qty, meters, isService, explicitLineTotal } = input;
  if (typeof explicitLineTotal === "number" && explicitLineTotal > 0) {
    return Math.round(explicitLineTotal);
  }
  if (isService || unitCode === "service") {
    return Math.round(price);
  }
  if (unitCode === "m" && meters != null && meters > 0) {
    return Math.round(price * meters);
  }
  return Math.round(price * qty);
}

/** Total meterage = length of one piece × piece count. */
export function totalMeterage(pieceLength: number, pieceCount: number): number {
  return pieceLength * pieceCount;
}
