/**
 * DSL security tests — verify the restricted condition evaluator rejects
 * malicious payloads and accepts legitimate expressions.
 *
 * Run: bun test tests/dsl-security.test.ts
 */
import { describe, expect, test } from "bun:test";
import { evaluateCondition, validateCondition } from "../src/lib/bom/dsl";

describe("DSL condition evaluator", () => {
  test("legitimate comparisons succeed", () => {
    expect(evaluateCondition("operation == 'մոտորով'", { operation: "մոտորով" })).toBe(true);
    expect(evaluateCondition("operation == 'մոտորով'", { operation: "ձեռք" })).toBe(false);
    expect(evaluateCondition("qty > 5", { qty: 10 })).toBe(true);
    expect(evaluateCondition("qty > 5", { qty: 3 })).toBe(false);
    expect(evaluateCondition("qty >= 5 && qty <= 10", { qty: 7 })).toBe(true);
    expect(evaluateCondition("a == 1 || b == 2", { a: 0, b: 2 })).toBe(true);
    expect(evaluateCondition("!(qty > 5)", { qty: 3 })).toBe(true);
  });

  test("empty condition returns true", () => {
    expect(evaluateCondition("", {})).toBe(true);
    expect(evaluateCondition("   ", {})).toBe(true);
  });

  test("rejects constructor traversal", () => {
    expect(evaluateCondition("constructor.constructor == 'a'", {})).toBe(false);
    expect(() => validateCondition("constructor.constructor")).toThrow();
  });

  test("rejects __proto__ access", () => {
    expect(evaluateCondition("__proto__ == 'a'", {})).toBe(false);
    expect(() => validateCondition("__proto__.polluted")).toThrow();
  });

  test("rejects prototype identifier", () => {
    expect(() => validateCondition("prototype")).toThrow();
  });

  test("rejects globalThis", () => {
    expect(() => validateCondition("globalThis")).toThrow();
  });

  test("rejects window", () => {
    expect(() => validateCondition("window")).toThrow();
  });

  test("rejects document", () => {
    expect(() => validateCondition("document")).toThrow();
  });

  test("rejects process", () => {
    expect(() => validateCondition("process")).toThrow();
  });

  test("rejects fetch identifier", () => {
    expect(() => validateCondition("fetch")).toThrow();
  });

  test("rejects Function identifier", () => {
    expect(() => validateCondition("Function")).toThrow();
  });

  test("rejects property access (dot)", () => {
    expect(() => validateCondition("obj.method()")).toThrow();
    expect(() => validateCondition("a.b")).toThrow();
  });

  test("rejects bracket access", () => {
    expect(() => validateCondition("a['x']")).toThrow();
  });

  test("rejects function call syntax on identifiers", () => {
    // The tokenizer accepts identifiers + parens but parsePrimary returns
    // the identifier value — there is no call production, so a trailing ()
    // becomes "unexpected token" and the whole expression is rejected.
    expect(() => validateCondition("evil()")).toThrow();
  });

  test("rejects assignment", () => {
    expect(() => validateCondition("a = 1")).toThrow();
  });

  test("validateCondition throws on invalid without evaluating", () => {
    expect(() => validateCondition("process.exit()")).toThrow();
    expect(() => validateCondition("constructor.constructor('return process')()")).toThrow();
  });
});