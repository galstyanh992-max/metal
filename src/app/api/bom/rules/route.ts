import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("admin.manage_forms");
    const rules = await db.bomRule.findMany({
      include: { componentProduct: { select: { id: true, name: true, sku: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rules });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
