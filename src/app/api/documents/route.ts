import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("doc.view_templates");
    const [templates, generated] = await Promise.all([
      db.documentTemplate.findMany({ orderBy: { type: "asc" } }),
      db.generatedDocument.findMany({ orderBy: { generatedAt: "desc" }, take: 50, include: { generatedBy: { select: { name: true } } } }),
    ]);
    return NextResponse.json({ templates, generated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
