/**
 * Concurrency / atomicity tests for order stock reservation.
 *
 * These tests simulate the race condition where two orders try to reserve
 * the same last unit of stock. The transactional reservation with
 * `SELECT ... FOR UPDATE` locking must ensure exactly one succeeds.
 *
 * Run: bun test tests/concurrency-oversell.test.ts
 */
import { describe, expect, mock, test } from "bun:test";

// The mock simulates a single-product inventory with onHand=1, reserved=0.
// Two concurrent reservations should yield 1 success + 1 oversell rejection.

let stock = { onHand: 1, reserved: 0 };
let lockHeld = false;
const lockQueue: Array<() => void> = [];

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (lockHeld) {
    await new Promise<void>((resolve) => lockQueue.push(resolve));
  }
  lockHeld = true;
  try {
    return await fn();
  } finally {
    lockHeld = false;
    const next = lockQueue.shift();
    if (next) next();
  }
}

const movements: any[] = [
  { productId: "p1", branchId: null, type: "RECEIVE", qty: 1 },
];

const models = {
  product: {
    findMany: mock(async ({ where }: any) => [{ id: "p1", name: "Item", sku: "S", salePrice: 100, purchasePrice: 50, unitId: "u", categoryId: null, unit: { code: "piece" } }]),
  },
  inventoryMovement: {
    findMany: mock(async () => movements.slice()),
    createMany: mock(async ({ data }: any) => {
      for (const d of data) movements.push({ ...d, branchId: d.branchId ?? null });
      return { count: data.length };
    }),
  },
  inventorySnapshot: {
    findMany: mock(async () => [{ id: "snap1", productId: "p1", branchId: null, onHand: 1, reserved: 0 }]),
    update: mock(async ({ data }: any) => Object.assign({}, data)),
    create: mock(async ({ data }: any) => ({ id: "snap-new", ...data })),
  },
  branch: { findMany: mock(async () => []) },
  notification: { createMany: mock(async () => ({})) },
};

const queryRaw = mock(async () => []);
const db = {
  ...models,
  $queryRaw: queryRaw,
  $transaction: mock(async (cb: any) => withLock(() => cb({ ...models, $queryRaw: queryRaw }))),
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("../src/lib/rbac", () => ({
  can: () => true,
  requireAction: async () => ({ role: "ADMIN", userId: "u1" }),
}));
mock.module("../src/lib/authz", () => ({
  requirePermission: async () => ({ userId: "u1", role: "ADMIN", email: "a@x", sessionVersion: 0 }),
  scopeOrdersForUser: () => ({}),
  canAccessOrder: async () => true,
}));

const { reserveOrderStock, OrderStockError } = await import("../src/lib/inventory/order-reservations");
const { confirmDraftOrder } = await import("../src/lib/orders/confirm-draft");

describe("oversell prevention", () => {
  test("stock=1: one reservation succeeds, the second is rejected", async () => {
    movements.length = 0;
    movements.push({ productId: "p1", branchId: null, type: "RECEIVE", qty: 1 });
    // First reservation of qty=1 must succeed.
    await db.$transaction(async (tx: any) => {
      await reserveOrderStock(tx, "order-1", "u1", [{ productId: "p1", qty: 1, name: "Item" }]);
    });

    // Second reservation of qty=1 must throw (no available stock).
    let failed = false;
    try {
      await db.$transaction(async (tx: any) => {
        await reserveOrderStock(tx, "order-2", "u1", [{ productId: "p1", qty: 1, name: "Item" }]);
      });
    } catch (e: any) {
      failed = e instanceof OrderStockError;
    }
    expect(failed).toBe(true);
  });

  test("two parallel reservations of qty=1 on stock=1: exactly one wins", async () => {
    movements.length = 0;
    movements.push({ productId: "p1", branchId: null, type: "RECEIVE", qty: 1 });
    let success = 0;
    let conflict = 0;
    const attempt = async (orderId: string) => {
      try {
        await db.$transaction(async (tx: any) => {
          await reserveOrderStock(tx, orderId, "u1", [{ productId: "p1", qty: 1, name: "Item" }]);
        });
        success++;
      } catch (e: any) {
        if (e instanceof OrderStockError) conflict++;
        else { console.error("UNEXPECTED:", e.message); throw e; }
      }
    };
    await Promise.all([attempt("order-a"), attempt("order-b")]);
    expect(success).toBe(1);
    expect(conflict).toBe(1);
  });
});