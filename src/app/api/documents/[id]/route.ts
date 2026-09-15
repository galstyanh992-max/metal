import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAction("doc.view_templates");

  try {
    const { id } = await params;
    const template = await db.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAction("doc.edit_templates");

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, bodyTemplate, active, description, op, label, groupId, field } = body as {
      id?: string;
      name?: string;
      bodyTemplate?: string;
      active?: boolean;
      description?: string;
      op?: string;
      label?: string;
      groupId?: string;
      field?: any;
    };

    const existing = await db.documentTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    // Handle special operations
    if (op) {
      if (op === "toggle_active") {
        const template = await db.documentTemplate.update({
          where: { id },
          data: { active: active ?? !existing.active },
        });
        return NextResponse.json({ template });
      }

      if (op === "add_group") {
        // For now, just return success - groups are managed in client state
        // In a real implementation, you'd have a separate table for groups
        return NextResponse.json({ 
          success: true, 
          message: "Group operation not fully implemented" 
        });
      }

      if (op === "add_field") {
        // For now, just return success - fields are managed in client state
        return NextResponse.json({ 
          success: true, 
          message: "Field operation not fully implemented" 
        });
      }
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
