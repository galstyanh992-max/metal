import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("product.list");
    const units = await db.unit.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ units });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
