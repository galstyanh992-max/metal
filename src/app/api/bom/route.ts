import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { evaluateFormula } from "@/lib/bom/dsl";

/**
 * BOM Calculation API
 * Given a product (which has a category) + dimension parameters,
 * calculate the required components and their quantities.
 */

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN", "OPERATOR");
    const body = await req.json();
    const { productId, parameters } = body as {
      productId: string;
      parameters: Record<string, number | string>;
    };

    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const product = await db.product.findUnique({
      where: { id: productId },
      include: { category: true, unit: true },
    });
    if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });
    if (!product.categoryId) return NextResponse.json({ error: "product has no category" }, { status: 400 });

    // Find BOM rules for this product's category
    const rules = await db.bomRule.findMany({
      where: { productTypeId: product.categoryId, active: true, archivedAt: null },
      include: { componentProduct: { include: { unit: true } } },
    });

    if (rules.length === 0) {
      return NextResponse.json({ components: [], message: "No BOM rules for this product category", debug: { categoryId: product.categoryId, productId: product.id } });
    }

    // Build calculation context from parameters
    const ctx: Record<string, number> = {};
    for (const [key, value] of Object.entries(parameters)) {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (!isNaN(num)) ctx[key] = num;
    }
    // Map common parameter name aliases
    if (ctx.quantity !== undefined && ctx.qty === undefined) ctx.qty = ctx.quantity;
    if (ctx.qty !== undefined && ctx.quantity === undefined) ctx.quantity = ctx.qty;
    // Always include coefficient and waste as 0 defaults if not set
    ctx.coefficient = ctx.coefficient ?? 1;
    ctx.waste = ctx.waste ?? 0;

    const components: Array<{
      ruleId: string;
      ruleVersion: number;
      componentProductId: string;
      componentProductSku: string;
      componentProductName: string;
      componentUnitSymbol: string;
      formula: string;
      rawQty: number;
      wasteQty: number;
      totalQty: number;
      roundedQty: number;
      minimum: number;
      finalQty: number;
      available: number;
      sufficient: boolean;
    }> = [];

    for (const rule of rules) {
      try {
        // Merge rule-level coefficient and waste into context
        const ruleCtx = {
          ...ctx,
          coefficient: rule.coefficient,
          waste: rule.waste,
        };

        const rawQty = evaluateFormula(rule.formulaExpr, ruleCtx);
        const wasteQty = Math.round(rawQty * rule.waste);
        const totalQty = rawQty + wasteQty;
        const roundedQty = rule.rounding > 0 ? Math.ceil(totalQty / rule.rounding) * rule.rounding : Math.ceil(totalQty);
        const finalQty = Math.max(rule.minimum, roundedQty);

        // Check inventory availability
        const movements = await db.inventoryMovement.findMany({
          where: { productId: rule.componentProductId },
          select: { type: true, qty: true },
        });
        let onHand = 0, reserved = 0;
        for (const m of movements) {
          if (["RECEIVE", "RETURN"].includes(m.type)) onHand += m.qty;
          else if (["ISSUE", "WRITE_OFF"].includes(m.type)) onHand -= m.qty;
          else if (m.type === "ADJUSTMENT") onHand += m.qty;
          if (m.type === "RESERVE") reserved += m.qty;
          else if (["RELEASE_RESERVATION", "ISSUE"].includes(m.type)) reserved -= m.qty;
        }
        const available = Math.max(0, onHand - reserved);

        components.push({
          ruleId: rule.id,
          ruleVersion: rule.version,
          componentProductId: rule.componentProductId,
          componentProductSku: rule.componentProduct.sku,
          componentProductName: rule.componentProduct.name,
          componentUnitSymbol: rule.componentProduct.unit?.symbol ?? "",
          formula: rule.formulaExpr,
          rawQty: Math.round(rawQty * 100) / 100,
          wasteQty,
          totalQty: Math.round(totalQty * 100) / 100,
          roundedQty,
          minimum: rule.minimum,
          finalQty,
          available,
          sufficient: available >= finalQty,
        });

        // Log calculation
        await db.bomCalculationLog.create({
          data: {
            ruleId: rule.id,
            ruleVersion: rule.version,
            inputsJson: JSON.stringify({ productId, parameters, ctx: ruleCtx }),
            outputJson: JSON.stringify({ rawQty, finalQty, available }),
          },
        });
      } catch (e: any) {
        console.error("BOM rule evaluation failed:", rule.id, e?.message);
      }
    }

    return NextResponse.json({
      product: { id: product.id, name: product.name, sku: product.sku },
      components,
      allSufficient: components.every((c) => c.sufficient),
    });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
