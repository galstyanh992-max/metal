import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("finance.manage_loyalty");
    const [tiers, overrides] = await Promise.all([
      db.loyaltyTier.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { clients: true } } } }),
      db.loyaltyOverride.findMany({ include: { client: true, byUser: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({ tiers, overrides });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
