/// <reference types="bun-types" />
/** Run with: bun test tests/order-drafts.test.ts. No live database is used. */
import { beforeEach, describe, expect, mock, test } from "bun:test";

let state: any;
let role = "ADMIN";
let failDocuments = false;
const copy = (value: any) => structuredClone(value);

const findOrder = ({ where }: any) => {
  const order = state.orders.find((o: any) => o.id === where.id);
  return order ? copy({ ...order, items: order.items.map((item: any) => ({
    ...item, product: state.products.find((p: any) => p.id === item.productId),
  })) }) : null;
};

const models = {
  client: { findUnique: mock(async ({ where }: any) => where.id === "client" ? { id: "client", loyaltyDiscount: 10 } : null) },
  product: {
    findMany: mock(async ({ where }: any) => copy(state.products.filter((p: any) => where.id.in.includes(p.id)))),
    findUnique: mock(async ({ where }: any) => copy(state.products.find((p: any) => p.id === where.id))),
    update: mock(async ({ where, data }: any) => Object.assign(state.products.find((p: any) => p.id === where.id), data)),
  },
  order: {
    count: mock(async () => state.orders.length),
    create: mock(async ({ data }: any) => {
      const id = `order-${state.orders.length + 1}`;
      const order = { ...data, id, items: data.items.create.map((item: any, i: number) => ({
        ...item, id: `${id}-item-${i}`, orderId: id, parameters: item.parameters.create,
      })) };
      state.orders.push(order);
      return copy(order);
    }),
    findUnique: mock(async (args: any) => findOrder(args)),
    findUniqueOrThrow: mock(async (args: any) => {
      const result = findOrder(args);
      if (!result) throw Error("missing order");
      return result;
    }),
    findMany: mock(async ({ where }: any) => copy(state.orders.filter((o: any) => !where?.status?.not || o.status !== where.status.not))),
    updateMany: mock(async ({ where, data }: any) => {
      const order = state.orders.find((o: any) => o.id === where.id && o.status === where.status);
      if (!order) return { count: 0 };
      Object.assign(order, data);
      return { count: 1 };
    }),
    update: mock(async ({ where, data }: any) => Object.assign(state.orders.find((o: any) => o.id === where.id), data)),
  },
  inventoryMovement: {
    findMany: mock(async ({ where }: any) => copy(state.movements.filter((m: any) =>
      (!where.productId || (typeof where.productId === "string" ? m.productId === where.productId : where.productId.in.includes(m.productId))) &&
      (where.branchId === undefined || (m.branchId ?? null) === where.branchId) &&
      (!where.refType || m.refType === where.refType) && (!where.refId || m.refId === where.refId)
    ).map((m: any) => ({ ...m, branchId: m.branchId ?? null })))),
    create: mock(async ({ data }: any) => { state.movements.push(copy(data)); return data; }),
    createMany: mock(async ({ data }: any) => { state.movements.push(...copy(data)); return { count: data.length }; }),
  },
  inventorySnapshot: {
    findMany: mock(async ({ where }: any) => copy(state.snapshots.filter((snapshot: any) => where.productId.in.includes(snapshot.productId)))),
    findFirst: mock(async ({ where }: any) => copy(state.snapshots.find((snapshot: any) => snapshot.productId === where.productId && snapshot.branchId === where.branchId))),
    create: mock(async ({ data }: any) => { const snapshot = { id: `snapshot-${state.snapshots.length}`, ...copy(data) }; state.snapshots.push(snapshot); return snapshot; }),
    update: mock(async ({ where, data }: any) => Object.assign(state.snapshots.find((snapshot: any) => snapshot.id === where.id), copy(data))),
  },
  branch: { findMany: mock(async () => copy(state.branches.filter((branch: any) => branch.active))) },
  notification: { create: mock(async () => ({})), createMany: mock(async () => ({})) },
  bomRule: { findMany: mock(async () => copy(state.rules)) },
  orderPayment: { create: mock(async ({ data }: any) => { state.payments.push(copy(data)); return data; }) },
  generatedDocument: { createMany: mock(async ({ data }: any) => {
    if (failDocuments) throw Error("document write failed");
    state.documents.push(...copy(data));
    return { count: data.length };
  }) },
  orderStatusHistory: { create: mock(async ({ data }: any) => { state.history.push(copy(data)); return data; }) },
  auditLog: { create: mock(async ({ data }: any) => { state.audit.push(copy(data)); return data; }) },
  productPriceHistory: {
    findFirst: mock(async () => null),
    create: mock(async () => ({})),
  },
};

const queryRaw = mock(async () => []);

const db = {
  ...models,
  $transaction: mock(async (callback: any) => {
    const before = copy(state);
    try { return await callback({ ...models, $queryRaw: queryRaw }); }
    catch (error) { state = before; throw error; }
  }),
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("../src/lib/rbac", () => ({
  requireAction: async (action: string) => {
    if (role === "WAREHOUSE" && action !== "order.list") {
      const { NextResponse } = await import("next/server");
      throw NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return { role, userId: "user" };
  },
}));

const { POST, GET } = await import("../src/app/api/orders/route");
const { PATCH, GET: getDetail } = await import("../src/app/api/orders/[id]/route");
const { POST: pay } = await import("../src/app/api/payments/route");

const request = (body: any, method = "POST") => new Request("http://localhost/api/orders", {
  method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const item = (productId = "product", qty = 2) => ({ productId, qty, unitPrice: 150, parameters: { width: "1200", color: "white" } });
const draft = (extra: any = {}) => POST(request({
  status: "DRAFT", clientId: "client", items: [item()], savePrices: true,
  paymentMethod: "cash", discountPercent: 20, note: "Draft note", ...extra,
}));
const action = (name: string, extra: any = {}) => PATCH(request({ action: name, ...extra }, "PATCH"), { params: Promise.resolve({ id: "order-1" }) });
const receive = (productId = "product", qty = 10, branchId: string | null = null) => state.movements.push({ productId, type: "RECEIVE", qty, branchId });

beforeEach(() => {
  role = "ADMIN";
  failDocuments = false;
  for (const model of Object.values(models)) for (const method of Object.values(model)) method.mockClear();
  db.$transaction.mockClear();
  queryRaw.mockClear();
  state = {
    products: ["product", "second", "service"].map((id) => ({
      id, name: id, sku: id, salePrice: 100, purchasePrice: 40, unitId: `unit-${id}`,
      categoryId: null, minStock: 0, unit: { code: id === "service" ? "service" : "piece" },
    })),
    orders: [], movements: [], snapshots: [], documents: [], payments: [], history: [], audit: [], rules: [],
    branches: [{ id: "main", active: true }, { id: "second-branch", active: true }],
  };
});

describe("draft creation", () => {
  test("saves without stock, payments, debt, documents or catalog price changes", async () => {
    const response = await draft();
    expect(response.status).toBe(200);
    const { order, priceUpdates } = await response.json();
    expect(order.status).toBe("DRAFT");
    expect(order.baseAmount).toBe(300);
    expect(order.totalAmount).toBe(216); // 20% manual, then 10% loyalty
    expect(order.discountAmount).toBe(84);
    expect(order.note).toBe("Draft note");
    expect(order.items[0].parameters).toContainEqual({ fieldKey: "width", value: "1200", label: "width" });
    expect(order.paidAmount).toBe(0);
    expect(order.outstandingAmount).toBe(0);
    expect(priceUpdates).toBe(0);
    expect(state.movements).toHaveLength(0);
    expect(state.payments).toHaveLength(0);
    expect(state.documents).toHaveLength(0);
    expect(models.inventoryMovement.findMany).not.toHaveBeenCalled();
    expect(models.product.update).not.toHaveBeenCalled();
  });

  test("rejects invalid status, missing client, missing products and nonpositive qty", async () => {
    expect((await draft({ status: "DELIVERED" })).status).toBe(400);
    expect((await draft({ clientId: "" })).status).toBe(400);
    expect((await draft({ items: [] })).status).toBe(400);
    expect((await draft({ items: [item("product", -1)] })).status).toBe(400);
    expect((await draft({ items: [item("missing")] })).status).toBe(409);
    expect(state.orders).toHaveLength(0);
  });

  test("normal creation still defaults to confirmed and records cash payment/documents", async () => {
    receive();
    const response = await POST(request({ clientId: "client", items: [item()], paymentMethod: "cash" }));
    expect(response.status).toBe(200);
    const { order } = await response.json();
    expect(order.status).toBe("CONFIRMED");
    expect(order.paidAmount).toBe(order.totalAmount);
    expect(state.payments).toHaveLength(1);
    expect(state.documents).toHaveLength(6);
  });

  test("normal creation still checks stock", async () => {
    expect((await POST(request({ clientId: "client", items: [item()] }))).status).toBe(409);
    expect(state.orders).toHaveLength(0);
  });

  test("preserves the calculator's authoritative total and meterage", async () => {
    const response = await draft({ items: [{ ...item(), lineTotal: 77777, parameters: { meterage: "6.2", fromCalculator: "rolshutter" } }] });
    expect(response.status).toBe(200);
    const { order } = await response.json();
    expect(order.baseAmount).toBe(77777);
    expect(order.items[0].lineTotal).toBe(77777);
    expect(order.items[0].parameters).toContainEqual({ fieldKey: "meterage", value: "6.2", label: "meterage" });
  });

  test("warehouse cannot create or retrieve drafts", async () => {
    await draft();
    role = "WAREHOUSE";
    expect((await draft()).status).toBe(403);
    expect((await (await GET()).json()).orders).toHaveLength(0);
    expect((await getDetail(request({}), { params: Promise.resolve({ id: "order-1" }) })).status).toBe(404);
  });
});

describe("draft lifecycle", () => {
  test("confirms stock received into the main branch instead of looking only at unassigned stock", async () => {
    await draft();
    receive("product", 10, "main");
    const response = await action("confirm");
    expect(response.status).toBe(200);
    expect((await response.json()).order.status).toBe("CONFIRMED");
    expect(state.movements.filter((movement: any) => movement.type === "RESERVE")).toEqual([
      expect.objectContaining({ productId: "product", branchId: "main", qty: 2, refId: "order-1" }),
    ]);
    expect(state.snapshots).toEqual([expect.objectContaining({ productId: "product", branchId: "main", onHand: 10, reserved: 2 })]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  test("splits reservations across branches and legacy stock without using another order's reserve", async () => {
    await draft({ items: [item("product", 7)] });
    receive("product", 4, "main");
    receive("product", 3, "second-branch");
    receive("product", 5);
    state.movements.push({ productId: "product", branchId: "main", type: "RESERVE", qty: 2, refType: "ORDER", refId: "other" });
    expect((await action("confirm")).status).toBe(200);
    expect(state.movements.filter((movement: any) => movement.refId === "order-1")).toEqual([
      expect.objectContaining({ branchId: "main", qty: 2 }),
      expect.objectContaining({ branchId: "second-branch", qty: 3 }),
      expect.objectContaining({ branchId: null, qty: 2 }),
    ]);
    expect((await action("cancel")).status).toBe(200);
    expect(state.snapshots).toEqual([
      expect.objectContaining({ branchId: "main", onHand: 4, reserved: 2 }),
      expect.objectContaining({ branchId: "second-branch", onHand: 3, reserved: 0 }),
      expect.objectContaining({ branchId: null, onHand: 5, reserved: 0 }),
    ]);
    expect((await action("cancel")).status).toBe(409);
    expect(state.movements.filter((movement: any) => movement.type === "RELEASE_RESERVATION")).toHaveLength(3);
  });

  test("keeps the draft, payments and every snapshot unchanged when stock is actually insufficient", async () => {
    await draft({ items: [item("product", 4)] });
    receive("product", 3, "main");
    receive("product", 1, "second-branch");
    state.movements.push({ productId: "product", branchId: "main", type: "RESERVE", qty: 2, refType: "ORDER", refId: "other" });
    const before = copy(state);
    const response = await action("confirm", { paymentMethod: "cash" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("2");
    expect(state).toEqual(before);
  });

  test("combines BOM and direct requirements, then releases the recorded amounts even if BOM rules change", async () => {
    state.products[0].categoryId = "category";
    state.rules = [{ productTypeId: "category", componentProductId: "second", componentProduct: state.products[1], formulaExpr: "qty", coefficient: 1, waste: 0, rounding: 0, minimum: 0 }];
    await draft({ items: [item("product", 2), item("second", 3)] });
    receive("product", 10, "main");
    receive("second", 5, "second-branch");
    expect((await action("confirm")).status).toBe(200);
    expect(state.movements.filter((movement: any) => movement.type === "RESERVE")).toEqual([
      expect.objectContaining({ productId: "product", branchId: "main", qty: 2 }),
      expect.objectContaining({ productId: "second", branchId: "second-branch", qty: 5 }),
    ]);
    state.rules[0].formulaExpr = "qty * 99";
    expect((await action("cancel")).status).toBe(200);
    expect(state.snapshots.every((snapshot: any) => snapshot.reserved === 0)).toBe(true);
  });

  test("rolls back cancellation if releasing stock fails", async () => {
    await draft();
    receive("product", 4, "main");
    expect((await action("confirm")).status).toBe(200);
    // Simulate an inconsistent legacy ledger so cancellation must not partially succeed.
    state.movements.push({ productId: "product", branchId: "main", type: "RELEASE_RESERVATION", qty: 2, refType: "ORDER", refId: "other" });
    const before = copy(state);
    expect((await action("cancel")).status).toBe(409);
    expect(state).toEqual(before);
  });

  test("confirms once, reserves stock and creates documents/debt", async () => {
    await draft();
    receive();
    const response = await action("confirm");
    expect(response.status).toBe(200);
    expect((await response.json()).order).toMatchObject({ id: "order-1", status: "CONFIRMED", outstandingAmount: 216 });
    expect(state.orders[0].status).toBe("CONFIRMED");
    expect(state.orders[0].outstandingAmount).toBe(216);
    expect(state.payments).toHaveLength(0);
    expect(state.documents).toHaveLength(5);
    expect(state.movements.filter((m: any) => m.type === "RESERVE")).toHaveLength(1);
    expect((await action("confirm")).status).toBe(409);
    expect(state.documents).toHaveLength(5);
    expect(state.movements.filter((m: any) => m.type === "RESERVE")).toHaveLength(1);
  });

  test.each(["cash", "transfer"])("records %s payment only at confirmation", async (paymentMethod) => {
    await draft();
    receive();
    expect((await action("confirm", { paymentMethod })).status).toBe(200);
    expect(state.orders[0].paidAmount).toBe(216);
    expect(state.orders[0].outstandingAmount).toBe(0);
    expect(state.payments[0].method).toBe(paymentMethod === "cash" ? "cash" : "bank");
    expect(state.documents).toHaveLength(6);
  });

  test("rolls back earlier reservations when a later item has insufficient stock", async () => {
    await draft({ items: [item(), item("second")] });
    receive();
    expect((await action("confirm")).status).toBe(409);
    expect(state.orders[0].status).toBe("DRAFT");
    expect(state.movements.filter((m: any) => m.type === "RESERVE")).toHaveLength(0);
    expect(state.documents).toHaveLength(0);
    expect(state.payments).toHaveLength(0);
  });

  test("rolls back main product reservation when a BOM component is unavailable", async () => {
    state.products[0].categoryId = "category";
    state.rules = [{ productTypeId: "category", componentProductId: "second", componentProduct: state.products[1], formulaExpr: "qty", coefficient: 1, waste: 0, rounding: 0, minimum: 0 }];
    await draft();
    receive();
    expect((await action("confirm")).status).toBe(409);
    expect(state.orders[0].status).toBe("DRAFT");
    expect(state.movements.filter((m: any) => m.type === "RESERVE")).toHaveLength(0);
  });

  test("does not reserve services", async () => {
    await draft({ items: [item("service", 1)] });
    expect((await action("confirm")).status).toBe(200);
    expect(state.movements).toHaveLength(0);
  });

  test("checks combined quantities when quick fill and calculator use the same product", async () => {
    await draft({ items: [item("product", 6), item("product", 6)] });
    receive("product", 10);
    expect((await action("confirm")).status).toBe(409);
    expect(state.orders[0].status).toBe("DRAFT");
    expect(state.movements.filter((m: any) => m.type === "RESERVE")).toHaveLength(0);
  });

  test("does not release another order's stock when cancelling a draft", async () => {
    await draft();
    receive();
    state.movements.push({ productId: "product", type: "RESERVE", qty: 5, refId: "other-order" });
    expect((await action("cancel")).status).toBe(200);
    expect(state.orders[0].status).toBe("CANCELLED");
    expect(state.movements).toHaveLength(2);
    expect(models.inventoryMovement.create).not.toHaveBeenCalled();
  });

  test("rejects direct payment for a draft", async () => {
    await draft();
    expect((await pay(request({ orderId: "order-1", amount: 100, method: "cash" }))).status).toBe(409);
    expect(state.payments).toHaveLength(0);
    expect(state.orders[0].status).toBe("DRAFT");
  });

  test("rolls back confirmation and payment if document creation fails", async () => {
    await draft();
    receive();
    failDocuments = true;
    expect((await action("confirm", { paymentMethod: "cash" })).status).toBe(500);
    expect(state.orders[0].status).toBe("DRAFT");
    expect(state.payments).toHaveLength(0);
    expect(state.movements.filter((m: any) => m.type === "RESERVE")).toHaveLength(0);
  });
});
