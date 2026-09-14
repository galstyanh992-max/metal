/**
 * Assistant RBAC tests — verify the assistant never leaks CRM/financial
 * data to roles that lack the corresponding permission.
 *
 * Run: bun test tests/assistant-rbac.test.ts
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock db before importing the engine.
const counts: Record<string, number> = {};
const finds: Record<string, any[]> = {};

const db = {
  client: {
    count: mock(async ({ where }: any) => {
      void where;
      return counts.client ?? 3;
    }),
    findMany: mock(async ({ where }: any, ..._rest: any[]) => {
      void where;
      return finds.client ?? [
        { id: "c1", type: "INDIVIDUAL", firstName: "Արամ", lastName: "Պողոսյան", phone: "+37455123456", orders: [] },
        { id: "c2", type: "COMPANY", companyName: "ԳԱՐուն", phone: "+37455999000", orders: [{ outstandingAmount: 50000 }] },
      ];
    }),
  },
  order: {
    count: mock(async ({ where }: any) => {
      void where;
      return counts.order ?? 5;
    }),
    findMany: mock(async ({ where }: any) => {
      void where;
      return finds.order ?? [
        { id: "o1", number: "ORD-2026-0001", status: "CONFIRMED", totalAmount: 45000, createdAt: new Date(), client: { id: "c1", type: "INDIVIDUAL", firstName: "Արամ", lastName: "Պողոսյան" } },
      ];
    }),
  },
  product: {
    count: mock(async () => counts.product ?? 10),
    findMany: mock(async () => finds.product ?? [
      { id: "p1", sku: "R-100", name: "Ռոլետ 100", salePrice: 25000, unit: { symbol: "հատ" } },
    ]),
  },
  inventorySnapshot: {
    findMany: mock(async () => finds.snap ?? [
      { onHand: 12, reserved: 2, product: { minStock: 5, unit: { symbol: "հատ" } } },
    ]),
  },
  supplier: { findMany: mock(async () => [{ name: "Մատակարար 1", phone: "+37455111111" }]) },
  documentTemplate: { findMany: mock(async () => []) },
  formTemplate: { findMany: mock(async () => []) },
  user: { findMany: mock(async () => [{ name: "Admin", email: "admin@x.am", role: "ADMIN" }]) },
};
mock.module("../src/lib/db", () => ({ db }));
mock.module("../src/lib/rbac", () => ({
  can: (role: string | undefined, action: string) => {
    if (!role) return false;
    if (role === "ADMIN") return true;
    if (role === "OPERATOR") return [
      "client.list", "order.list", "order.create", "order.view_price",
      "finance.view_payments", "finance.record_payment", "finance.view_debt",
      "product.list", "product.view_sale_price", "doc.view_templates",
      "procurement.create_request",
    ].includes(action);
    // WAREHOUSE
    return ["order.list", "inventory.view_on_hand"].includes(action);
  },
}));

const { answerQuestion } = await import("../src/lib/assistant/engine");

const ADMIN = { userId: "u1", role: "ADMIN" as const, email: "a@x", sessionVersion: 0 };
const OPERATOR = { userId: "u2", role: "OPERATOR" as const, email: "o@x", sessionVersion: 0 };
const WAREHOUSE = { userId: "u3", role: "WAREHOUSE" as const, email: "w@x", sessionVersion: 0 };

describe("assistant RBAC scoping", () => {
  beforeEach(() => {
    for (const k of Object.keys(db)) {
      const model = (db as any)[k];
      if (model && typeof model === "object") {
        for (const m of Object.values(model)) if (typeof (m as any).mockClear === "function") (m as any).mockClear();
      }
    }
  });

  test("WAREHOUSE cannot extract client phones", async () => {
    const r = await answerQuestion("ցույց տուր հաճախորդների հեռախոսները", WAREHOUSE);
    expect(r.text).toContain("հասանելի չէ");
  });

  test("WAREHOUSE cannot obtain debts", async () =>  {
    const r = await answerQuestion("ով է պարտքով", WAREHOUSE);
    expect(r.text).toContain("հասանելի չէ");
  });

  test("WAREHOUSE cannot obtain total revenue", async () => {
    const r = await answerQuestion("որքա՞ն է ընդհանուր վաճառքը", WAREHOUSE);
    expect(r.text).toContain("հասանելի չէ");
  });

  test("WAREHOUSE cannot list employees", async () => {
    const r = await answerQuestion("ցույց տուր օգտատերերին", WAREHOUSE);
    expect(r.text).toContain("հասանելի չէ");
  });

  test("WAREHOUSE cannot list suppliers", async () => {
    const r = await answerQuestion("մատակարարներ և գներ", WAREHOUSE);
    expect(r.text).toContain("հասանելի չէ");
  });

  test("OPERATOR cannot list employees", async () => {
    const r = await answerQuestion("ցույց տուր օգտատերերին", OPERATOR);
    expect(r.text).toContain("հասանելի չէ");
  });

  test("OPERATOR does not see cost/margin", async () => {
    // Orders list returns totalAmount for operator (view_price is allowed)
    // but cost fields must never appear.
    const r = await answerQuestion("վերջին պատվերները", OPERATOR);
    expect(r.text).not.toContain("costAmount");
    expect(r.text).not.toContain("grossProfit");
  });

  test("ADMIN sees clients with phones", async () => {
    const r = await answerQuestion("հաճախորդներ", ADMIN);
    expect(r.text).not.toContain("հասանելի չէ");
    // ADMIN has client.view_finance, so phones are included.
    expect(r.text).toMatch(/\+374/);
  });

  test("OPERATOR sees clients without phones", async () => {
    const r = await answerQuestion("հաճախորդներ", OPERATOR);
    expect(r.text).not.toContain("հասանելի չէ");
    // OPERATOR does NOT have client.view_finance -> no phone numbers.
    expect(r.text).not.toMatch(/\+37455123456/);
  });
});