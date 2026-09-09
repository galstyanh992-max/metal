import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  await requireAction("doc.view_templates");

  try {
    const [templates, generated] = await Promise.all([
      db.documentTemplate.findMany({ orderBy: { type: "asc" } }),
      db.generatedDocument.findMany({ orderBy: { generatedAt: "desc" }, take: 50, include: { generatedBy: { select: { name: true } } } }),
    ]);
    return NextResponse.json({ templates, generated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  await requireAction("doc.edit_templates");

  try {
    const body = await req.json();
    const { id, name, bodyTemplate, active } = body as {
      id: string;
      name?: string;
      bodyTemplate?: string;
      active?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const template = await db.documentTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(bodyTemplate !== undefined && { bodyTemplate }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ template });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
