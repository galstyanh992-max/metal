import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("tax.view");
    const [rules, profile] = await Promise.all([
      db.taxRule.findMany({ orderBy: { createdAt: "desc" }, include: { versions: { orderBy: { version: "desc" }, take: 5 } } }),
      db.taxProfile.findFirst(),
    ]);
    return NextResponse.json({ rules, profile });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("tax.create");
    const body = await req.json();
    const { type, regime, name, rate, formulaExpr, effectiveFrom, officialSource } = body;

    const rule = await db.taxRule.create({
      data: {
        type: type ?? "VAT",
        regime: regime ?? "UNKNOWN",
        name,
        rate: rate ?? 0,
        formulaExpr: formulaExpr ?? null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        officialSource: officialSource ?? null,
        status: "DRAFT",
        version: 1,
      },
    });

    await db.taxRuleVersion.create({
      data: {
        ruleId: rule.id,
        version: 1,
        snapshotJson: JSON.stringify(rule),
        changeById: userId,
        changeReason: "Սկզբնական ստեղծում",
      },
    });

    await db.auditLog.create({
      data: { actorId: userId, action: "tax_rule.create", entityType: "TaxRule", entityId: rule.id, afterJson: JSON.stringify({ name, type }) },
    });

    return NextResponse.json({ rule });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
