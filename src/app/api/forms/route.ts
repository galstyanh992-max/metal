import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("client.list"); // any authenticated user can view templates
    const templates = await db.formTemplate.findMany({
      include: {
        groups: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: {
            fields: {
              orderBy: { sortOrder: "asc" },
              where: { archivedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("admin.manage_forms");
    const body = await req.json();
    const { name, entityType } = body as { name: string; entityType: "PRODUCT" | "ORDER_ITEM" | "CLIENT" };

    if (!name || !entityType) {
      return NextResponse.json({ error: "name and entityType required" }, { status: 400 });
    }

    const template = await db.formTemplate.create({
      data: {
        name,
        entityType,
        version: 1,
        active: true,
      },
      include: { groups: true },
    });

    await db.auditLog.create({
      data: { actorId: userId, action: "form_template.create", entityType: "FormTemplate", entityId: template.id, afterJson: JSON.stringify({ name, entityType }) },
    });

    return NextResponse.json({ template });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
