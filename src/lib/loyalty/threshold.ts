export const MAX_LOYALTY_THRESHOLD = 2_000_000_000;

export function parseLoyaltyThreshold(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  if (value < 0 || value > MAX_LOYALTY_THRESHOLD) return null;
  return value;
}
