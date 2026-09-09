/**
 * Standalone tests for the calculator/order math (no DB, no framework).
 *
 * Run:  bun tests/calc-math.test.ts   (or: node --experimental-strip-types)
 */
import { computeLineTotal, parseDecimal, totalMeterage } from "../src/lib/orders/calc-math";

let passed = 0;
let failed = 0;

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual: number, expected: number, label: string, eps = 1e-9) {
  if (Math.abs(actual - expected) <= eps) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`);
  }
}

console.log("\n[1] Decimal parsing (comma / dot)");
assertClose(parseDecimal("6,20"), 6.2, "6,20 → 6.2");
assertClose(parseDecimal("2,990"), 2.99, "2,990 → 2.99 (not 2990)");
assertClose(parseDecimal("6.20"), 6.2, "6.20 → 6.2");
assertClose(parseDecimal("2.990"), 2.99, "2.990 → 2.99");
assertEq(Number.isNaN(parseDecimal("")), true, "empty → NaN");
assertEq(Number.isNaN(parseDecimal("abc")), true, "non-numeric → NaN");

console.log("\n[2] Total meterage = piece length × count");
assertClose(totalMeterage(6.2, 1000), 6200, "1000 × 6.20 m = 6200 m");
assertClose(totalMeterage(5.5, 300), 1650, "300 × 5.50 m = 1650 m");
assertClose(totalMeterage(2.89, 30), 86.7, "30 × 2.890 m = 86.7 m");

console.log("\n[3] Line totals by pricing unit");
// meter-priced: price per meter × meterage
assertEq(computeLineTotal({ unitCode: "m", price: 1450, qty: 30, meters: 2.89 }), Math.round(1450 * 2.89), "meter-priced: 1450 × 2.89");
// piece-priced: price per piece × qty
assertEq(computeLineTotal({ unitCode: "piece", price: 200, qty: 8 }), 1600, "piece-priced: 200 × 8");
// service: flat price, qty ignored
assertEq(computeLineTotal({ unitCode: "service", price: 15000, qty: 1, isService: true }), 15000, "service: flat 15000");
// explicit line total wins
assertEq(computeLineTotal({ unitCode: "m", price: 1450, qty: 30, meters: 2.89, explicitLineTotal: 125715 }), 125715, "explicit line total wins");

console.log("\n[4] Service is never double-counted");
const serviceLine = computeLineTotal({ unitCode: "service", price: 15000, qty: 1, isService: true });
assertEq(serviceLine, 15000, "service counted exactly once");

console.log("\n[5] Meter-priced line total uses meterage, not qty");
// 2.89 m × 30 pieces at 1450/m → 125,715 (NOT 1450 × 30 = 43,500)
const lamil = computeLineTotal({ unitCode: "m", price: 1450, qty: 30, meters: 2.89 });
assertEq(lamil, Math.round(1450 * 2.89), "lamil line total = price × meterage");

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
