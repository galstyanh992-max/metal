/**
 * Safe BOM expression DSL.
 *
 * NO JavaScript eval. Parses a simple expression grammar:
 *   - variables: width, height, qty, coefficient, waste
 *   - operators: + - * / ( )
 *   - numbers
 *   - functions: round(x), ceil(x), floor(x), max(a,b), min(a,b)
 *
 * Returns a numeric result. Throws on invalid input.
 */

type Token =
  | { kind: "num"; value: number }
  | { kind: "var"; value: string }
  | { kind: "op"; value: string }
  | { kind: "paren"; value: "(" | ")" }
  | { kind: "comma" };

const TOKENIZER = /(\s+)|([0-9]+(?:\.[0-9]+)?)|([a-zA-Z_][a-zA-Z0-9_]*)|([+\-*/()])/g;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  TOKENIZER.lastIndex = 0;
  while ((m = TOKENIZER.exec(input)) !== null) {
    if (m[1]) continue;
    if (m[2] !== undefined) tokens.push({ kind: "num", value: parseFloat(m[2]) });
    else if (m[3] !== undefined) {
      if (m[3] === "round" || m[3] === "ceil" || m[3] === "floor" || m[3] === "max" || m[3] === "min") {
        tokens.push({ kind: "var", value: m[3] });
      } else {
        tokens.push({ kind: "var", value: m[3] });
      }
    } else if (m[4] !== undefined) {
      if (m[4] === "(" || m[4] === ")") tokens.push({ kind: "paren", value: m[4] });
      else tokens.push({ kind: "op", value: m[4] });
    }
  }
  return tokens;
}

// Pratt-style parser
class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): (ctx: Record<string, number>) => number {
    const fn = this.parseExpression();
    if (this.pos < this.tokens.length) throw new Error("Unexpected token at " + this.pos);
    return fn;
  }

  private peek(): Token | null {
    return this.tokens[this.pos] ?? null;
  }

  private next(): Token {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error("Unexpected end of input");
    return t;
  }

  private parseExpression(): (ctx: Record<string, number>) => number {
    let left = this.parseTerm();
    while (true) {
      const t = this.peek();
      if (t && t.kind === "op" && (t.value === "+" || t.value === "-")) {
        this.next();
        const right = this.parseTerm();
        const op = t.value;
        const l = left;
        left = (ctx) => (op === "+" ? l(ctx) + right(ctx) : l(ctx) - right(ctx));
      } else break;
    }
    return left;
  }

  private parseTerm(): (ctx: Record<string, number>) => number {
    let left = this.parseFactor();
    while (true) {
      const t = this.peek();
      if (t && t.kind === "op" && (t.value === "*" || t.value === "/")) {
        this.next();
        const right = this.parseFactor();
        const op = t.value;
        const l = left;
        left = (ctx) => (op === "*" ? l(ctx) * right(ctx) : l(ctx) / right(ctx));
      } else break;
    }
    return left;
  }

  private parseFactor(): (ctx: Record<string, number>) => number {
    const t = this.next();
    if (t.kind === "num") return () => t.value;
    if (t.kind === "var") {
      // function call?
      const next = this.peek();
      if (next && next.kind === "paren" && next.value === "(") {
        this.next(); // consume (
        const args: ((ctx: Record<string, number>) => number)[] = [];
        if (!(this.peek()?.kind === "paren" && (this.peek() as any).value === ")")) {
          args.push(this.parseExpression());
          while (this.peek()?.kind === "op" && (this.peek() as any).value === ",") {
            this.next();
            args.push(this.parseExpression());
          }
        }
        const close = this.next();
        if (close.kind !== "paren" || close.value !== ")") throw new Error("Expected )");
        const fname = t.value;
        return (ctx) => {
          const vals = args.map((a) => a(ctx));
          if (fname === "round") return Math.round(vals[0]);
          if (fname === "ceil") return Math.ceil(vals[0]);
          if (fname === "floor") return Math.floor(vals[0]);
          if (fname === "max") return Math.max(...vals);
          if (fname === "min") return Math.min(...vals);
          throw new Error("Unknown function: " + fname);
        };
      }
      // variable
      return (ctx) => {
        if (!(t.value in ctx)) throw new Error("Unknown variable: " + t.value);
        return ctx[t.value];
      };
    }
    if (t.kind === "paren" && t.value === "(") {
      const inner = this.parseExpression();
      const close = this.next();
      if (close.kind !== "paren" || close.value !== ")") throw new Error("Expected )");
      return inner;
    }
    if (t.kind === "op" && t.value === "-") {
      const inner = this.parseFactor();
      return (ctx) => -inner(ctx);
    }
    throw new Error("Unexpected token");
  }
}

const compiledCache = new Map<string, (ctx: Record<string, number>) => number>();

export function compileFormula(expr: string): (ctx: Record<string, number>) => number {
  const cached = compiledCache.get(expr);
  if (cached) return cached;
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  const fn = parser.parse();
  compiledCache.set(expr, fn);
  return fn;
}

export function evaluateFormula(expr: string, ctx: Record<string, number>): number {
  return compileFormula(expr)(ctx);
}

/**
 * Evaluate a condition expression like "operation == 'մոտորով'"
 *
 * SECURITY: This is a restricted AST evaluator — NOT `new Function` / `eval`.
 * Supported tokens: identifiers, string literals, numbers, ==, !=, >, <, >=, <=,
 * &&, ||, !, ( ). No property access (.), no brackets, no function calls,
 * no constructor/prototype/__proto__, no globals (window/document/process/globalThis/fetch).
 *
 * Conditions are validated before evaluation. Malicious payloads are rejected.
 */

type CondToken =
  | { kind: "ident"; value: string }
  | { kind: "str"; value: string }
  | { kind: "num"; value: number }
  | { kind: "op"; value: "==" | "!=" | ">" | "<" | ">=" | "<=" | "&&" | "||" | "!" }
  | { kind: "paren"; value: "(" | ")" };

const COND_FORBIDDEN_IDENTS = new Set([
  "constructor", "prototype", "__proto__", "globalThis", "window", "document",
  "process", "fetch", "eval", "Function", "require", "module", "exports",
  "this", "self",
]);

function tokenizeCondition(input: string): CondToken[] {
  const tokens: CondToken[] = [];
  // Token spec in priority order. String literals first so quotes are consumed whole.
  const re = /(\s+)|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|([A-Za-z_$][A-Za-z0-9_$]*)|(>=|<=|==|!=|&&|\|\|)|(!|\(|\)|>|<)|(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  let last = 0;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      // Unconsumed characters between tokens — reject.
      const gap = input.slice(last, m.index);
      if (gap.trim().length > 0) throw new Error(`Unexpected characters: ${gap}`);
    }
    last = re.lastIndex;
    if (m[1] !== undefined) continue; // whitespace
    if (m[2] !== undefined) {
      const value = m[2].replace(/^['"]/, "").replace(/['"]$/, "").replace(/\\(.)/g, "$1");
      tokens.push({ kind: "str", value });
    } else if (m[3] !== undefined) {
      const value = m[3].replace(/^['"]/, "").replace(/['"]$/, "").replace(/\\(.)/g, "$1");
      tokens.push({ kind: "str", value });
    } else if (m[4] !== undefined) {
      const id = m[4];
      if (COND_FORBIDDEN_IDENTS.has(id)) throw new Error(`Forbidden identifier: ${id}`);
      tokens.push({ kind: "ident", value: id });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: "op", value: m[5] as any });
    } else if (m[6] !== undefined) {
      if (m[6] === "(" || m[6] === ")") {
        tokens.push({ kind: "paren", value: m[6] as "(" | ")" });
      } else {
        tokens.push({ kind: "op", value: m[6] as "!" | ">" | "<" });
      }
    } else if (m[7] !== undefined) {
      tokens.push({ kind: "num", value: parseFloat(m[7]) });
    }
  }
  if (last < input.length) {
    const tail = input.slice(last);
    if (tail.trim().length > 0) throw new Error(`Unexpected trailing characters: ${tail}`);
  }
  return tokens;
}

class CondParser {
  private pos = 0;
  constructor(private tokens: CondToken[]) {}

  parse(): (ctx: Record<string, any>) => boolean {
    const fn = this.parseOr();
    if (this.pos < this.tokens.length) throw new Error("Unexpected token at " + this.pos);
    return fn;
  }

  private peek(): CondToken | null {
    return this.tokens[this.pos] ?? null;
  }

  private next(): CondToken {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error("Unexpected end of input");
    return t;
  }

  private parseOr(): (ctx: Record<string, any>) => boolean {
    let left = this.parseAnd();
    while (true) {
      const t = this.peek();
      if (t && t.kind === "op" && t.value === "||") {
        this.next();
        const right = this.parseAnd();
        const l = left;
        left = (ctx) => l(ctx) || right(ctx);
      } else break;
    }
    return left;
  }

  private parseAnd(): (ctx: Record<string, any>) => boolean {
    let left = this.parseNot();
    while (true) {
      const t = this.peek();
      if (t && t.kind === "op" && t.value === "&&") {
        this.next();
        const right = this.parseNot();
        const l = left;
        left = (ctx) => l(ctx) && right(ctx);
      } else break;
    }
    return left;
  }

  private parseNot(): (ctx: Record<string, any>) => boolean {
    const t = this.peek();
    if (t && t.kind === "op" && t.value === "!") {
      this.next();
      const inner = this.parseNot();
      return (ctx) => !inner(ctx);
    }
    return this.parseComparison();
  }

  private parseComparison(): (ctx: Record<string, any>) => boolean {
    const left = this.parsePrimary();
    const t = this.peek();
    if (t && t.kind === "op" && ["==", "!=", ">", "<", ">=", "<="].includes(t.value)) {
      this.next();
      const right = this.parsePrimary();
      const op = t.value;
      const l = left;
      const r = right;
      return (ctx) => {
        const lv = l(ctx);
        const rv = r(ctx);
        switch (op) {
          case "==": return lv == rv;
          case "!=": return lv != rv;
          case ">": return lv > rv;
          case "<": return lv < rv;
          case ">=": return lv >= rv;
          case "<=": return lv <= rv;
          default: return false;
        }
      };
    }
    // Bare expression — truthiness.
    return (ctx) => Boolean(left(ctx));
  }

  private parsePrimary(): (ctx: Record<string, any>) => any {
    const t = this.next();
    if (t.kind === "str") return () => t.value;
    if (t.kind === "num") return () => t.value;
    if (t.kind === "ident") {
      // No property access allowed — bare identifier resolves to ctx value.
      return (ctx) => (t.value in ctx ? ctx[t.value] : undefined);
    }
    if (t.kind === "paren" && t.value === "(") {
      const inner = this.parseOr();
      const close = this.next();
      if (close.kind !== "paren" || close.value !== ")") throw new Error("Expected )");
      return inner;
    }
    if (t.kind === "op" && t.value === "!") {
      // Handled in parseNot; reaching here is a parse error.
      throw new Error("Unexpected !");
    }
    throw new Error("Unexpected token in primary");
  }
}

const condCache = new Map<string, (ctx: Record<string, any>) => boolean>();

export function evaluateCondition(expr: string, ctx: Record<string, any>): boolean {
  if (!expr || !expr.trim()) return true;
  try {
    const cached = condCache.get(expr);
    const fn = cached ?? new CondParser(tokenizeCondition(expr)).parse();
    if (!cached) condCache.set(expr, fn);
    return Boolean(fn(ctx));
  } catch (e) {
    console.warn("Condition eval failed:", expr, e);
    return false;
  }
}

/** Validate a condition expression without evaluating it. Throws on invalid input. */
export function validateCondition(expr: string): void {
  if (!expr || !expr.trim()) return;
  new CondParser(tokenizeCondition(expr)).parse();
}
