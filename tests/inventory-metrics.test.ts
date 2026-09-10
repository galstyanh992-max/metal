import { describe, expect, test } from "bun:test";
import { calculateInventoryQuantity, type InventoryQuantityInput } from "../src/lib/inventory/quantity";
import { recordMovement } from "../src/lib/inventory/ledger";

const meter = { code: "m", symbol: "մ" };
const calculate = (input: InventoryQuantityInput, code = "m") => calculateInventoryQuantity(input, { code, symbol: code });

describe("inventory measurement calculations", () => {
  test.each(["6,25", "6.25", 6.25])("accepts fractional total %s", (amount) => {
    expect(calculate({ mode: "total", unit: "m", amount }).qty).toBe(6.25);
  });
  test("calculates 10 pieces times 6.2 meters", () => {
    const result = calculateInventoryQuantity({ mode: "dimensions", unit: "m", count: "10", length: "6,2" }, meter);
    expect(result.qty).toBe(62);
    expect(result.calculation).toContain("62 մ");
    expect(result.calculation).toContain("10 հատ");
  });
  test("converts centimeters to meters", () => {
    expect(calculate({ mode: "total", unit: "cm", amount: "625" }).qty).toBe(6.25);
  });
  test("calculates sheet area from millimeters and count", () => {
    expect(calculate({ mode: "dimensions", unit: "mm", count: "3", length: "1000", width: "500" }, "m2").qty).toBe(1.5);
  });
  test("converts square centimeters to square meters", () => {
    expect(calculate({ mode: "total", unit: "cm2", amount: "15000" }, "m2").qty).toBe(1.5);
  });
  test("calculates cubic meters from three dimensions", () => {
    expect(calculate({ mode: "dimensions", unit: "cm", count: "2", length: "100", width: "50", height: "20" }, "m3").qty).toBe(0.2);
  });
  test("calculates kilograms from piece weight in grams", () => {
    expect(calculate({ mode: "dimensions", unit: "g", count: "25", amountPerPiece: "250" }, "kg").qty).toBe(6.25);
  });
  test("preserves integer product quantities", () => {
    expect(calculate({ mode: "total", unit: "piece", amount: 10 }, "piece").qty).toBe(10);
    expect(() => calculate({ mode: "total", unit: "piece", amount: "6,2" }, "piece")).toThrow();
  });
  test("does not add meters as pieces or kilograms as meters", () => {
    expect(() => calculate({ mode: "dimensions", unit: "m", count: 10, length: 6.2 }, "piece")).toThrow();
    expect(() => calculate({ mode: "total", unit: "kg", amount: 10 })).toThrow();
  });
  test.each(["", "abc", "1,2,3", "0", "-2", Infinity, NaN])("rejects invalid receipt quantity %s", (amount) => {
    expect(() => calculate({ mode: "total", unit: "m", amount })).toThrow();
  });
  test("rejects incomplete dimensions and fractional piece counts", () => {
    expect(() => calculate({ mode: "dimensions", unit: "m", count: 2, length: 1 }, "m2")).toThrow();
    expect(() => calculate({ mode: "dimensions", unit: "m", count: 1.5, length: 1 })).toThrow();
  });
  test("allows a signed correction without allowing a negative receipt", () => {
    expect(calculateInventoryQuantity({ mode: "total", unit: "m", amount: "-1,25" }, meter, true).qty).toBe(-1.25);
  });
});

function warehouse() {
  const movements: any[] = [];
  const snapshots: any[] = [];
  const tx: any = {
    $queryRaw: async () => [],
    inventoryMovement: {
      findMany: async ({ where }: any) => movements.filter((movement) => movement.productId === where.productId && movement.branchId === where.branchId),
      create: async ({ data }: any) => { movements.push(data); return data; },
    },
    inventorySnapshot: {
      findFirst: async ({ where }: any) => snapshots.find((snapshot) => snapshot.productId === where.productId && snapshot.branchId === where.branchId),
      create: async ({ data }: any) => { const snapshot = { id: String(snapshots.length), ...data }; snapshots.push(snapshot); return snapshot; },
      update: async ({ where, data }: any) => Object.assign(snapshots.find((snapshot) => snapshot.id === where.id), data),
    },
    product: { findUnique: async () => ({ id: "product", minStock: 0 }) },
    notification: { create: async () => ({}) },
  };
  return { movements, snapshots, tx };
}

describe("fractional inventory ledger", () => {
  test("persists the exact calculated quantity and updates only the chosen branch", async () => {
    const { tx, movements, snapshots } = warehouse();
    const result = calculate({ mode: "dimensions", unit: "m", count: 3, length: "2,99" });
    expect((await recordMovement({ productId: "product", branchId: "branch2", byUserId: "admin", type: "RECEIVE", qty: result.qty, note: result.calculation }, tx)).ok).toBe(true);
    expect(movements[0]).toMatchObject({ qty: 8.97, branchId: "branch2", note: result.calculation });
    expect(snapshots[0]).toMatchObject({ onHand: 8.97, reserved: 0, branchId: "branch2" });
  });
  test("does not leave floating point residue when receiving and writing off fractions", async () => {
    const { tx, snapshots } = warehouse();
    const base = { productId: "product", branchId: "branch", byUserId: "admin" };
    await recordMovement({ ...base, type: "RECEIVE", qty: 0.1 }, tx);
    await recordMovement({ ...base, type: "RECEIVE", qty: 0.2 }, tx);
    expect(snapshots[0].onHand).toBe(0.3);
    expect((await recordMovement({ ...base, type: "WRITE_OFF", qty: 0.3 }, tx)).ok).toBe(true);
    expect(snapshots[0].onHand).toBe(0);
  });
  test("supports negative fractional corrections and prevents negative stock", async () => {
    const { tx, snapshots, movements } = warehouse();
    const base = { productId: "product", byUserId: "admin" };
    await recordMovement({ ...base, type: "RECEIVE", qty: 2.5 }, tx);
    expect((await recordMovement({ ...base, type: "ADJUSTMENT", qty: -0.25 }, tx)).ok).toBe(true);
    expect(snapshots[0].onHand).toBe(2.25);
    expect((await recordMovement({ ...base, type: "ADJUSTMENT", qty: -3 }, tx)).ok).toBe(false);
    expect(movements).toHaveLength(2);
  });
  test("allows a correction exactly down to the reserved fractional quantity", async () => {
    const { tx, snapshots } = warehouse();
    const base = { productId: "product", byUserId: "admin" };
    await recordMovement({ ...base, type: "RECEIVE", qty: 0.3 }, tx);
    await recordMovement({ ...base, type: "RESERVE", qty: 0.1 }, tx);
    expect((await recordMovement({ ...base, type: "ADJUSTMENT", qty: -0.2 }, tx)).ok).toBe(true);
    expect(snapshots[0]).toMatchObject({ onHand: 0.1, reserved: 0.1 });
  });
});
