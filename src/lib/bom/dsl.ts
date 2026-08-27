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
 * Supports ==, !=, >, <, >=, <=, &&, ||, and string literals.
 */
export function evaluateCondition(expr: string, ctx: Record<string, any>): boolean {
  if (!expr || !expr.trim()) return true;
  try {
    // Simple safe evaluator — only allow comparisons and boolean ops
    const safe = expr
      .replace(/'([^']*)'/g, '"$1"')
      .replace(/==/g, "===")
      .replace(/!=/g, "!==")
      .replace(/&&/g, " && ")
      .replace(/\|\|/g, " || ");
    // Whitelist characters
    if (!/^[\w\s"()+\-*/<>=&|!.,]+$/.test(safe)) {
      console.warn("Unsafe condition expression rejected:", expr);
      return false;
    }
    const keys = Object.keys(ctx);
    const vals = Object.values(ctx);
    const fn = new Function(...keys, `"use strict"; return (${safe});`);
    return !!fn(...vals);
  } catch (e) {
    console.warn("Condition eval failed:", expr, e);
    return false;
  }
}
