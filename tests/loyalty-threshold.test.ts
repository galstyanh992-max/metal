import { describe, expect, test } from "bun:test";
import { MAX_LOYALTY_THRESHOLD, parseLoyaltyThreshold } from "../src/lib/loyalty/threshold";

describe("loyalty threshold validation", () => {
  test("accepts zero and whole AMD amounts", () => {
    expect(parseLoyaltyThreshold(0)).toBe(0);
    expect(parseLoyaltyThreshold(500_000)).toBe(500_000);
    expect(parseLoyaltyThreshold(MAX_LOYALTY_THRESHOLD)).toBe(MAX_LOYALTY_THRESHOLD);
  });

  test("rejects fractions, negative values, unsafe values and non-numbers", () => {
    for (const invalid of [-1, 1.5, MAX_LOYALTY_THRESHOLD + 1, Number.MAX_SAFE_INTEGER + 1, "500000", null, NaN]) {
      expect(parseLoyaltyThreshold(invalid)).toBeNull();
    }
  });
});
