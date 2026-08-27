/**
 * Money helpers — AMD integer minor units.
 * Uses decimal.js for percentage/margin math. Never binary float.
 */
import Decimal from "decimal.js";

export type AMD = number; // integer

export function toAMD(value: number | string | Decimal): AMD {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function addAMD(...vals: AMD[]): AMD {
  return vals.reduce((a, b) => a + b, 0);
}

export function subAMD(a: AMD, b: AMD): AMD {
  return a - b;
}

export function multiplyAMD(qty: number, unitPrice: AMD): AMD {
  return new Decimal(qty).times(unitPrice).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function percentOf(value: AMD, percent: number): AMD {
  return new Decimal(value).times(percent).div(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function marginPercent(cost: AMD, sale: AMD): number {
  if (sale === 0) return 0;
  // basis points (100 = 1%)
  return new Decimal(sale).minus(cost).div(sale).times(10000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function formatAMD(value: AMD): string {
  return new Intl.NumberFormat("hy-AM", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(value) + " դր";
}

export function formatAMDShort(value: AMD): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + " մլն դր";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(0) + " հզ դր";
  }
  return value + " դր";
}
