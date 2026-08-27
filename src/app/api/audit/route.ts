import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("admin.view_audit");
    const logs = await db.auditLog.findMany({
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: { at: "desc" },
      take: 100,
    });
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
