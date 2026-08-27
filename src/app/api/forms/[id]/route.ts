import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAction("client.list");
    const { id } = await params;
    const template = await db.formTemplate.findUnique({
      where: { id },
      include: {
        groups: {
          orderBy: { sortOrder: "asc" },
          include: {
            fields: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    if (!template) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAction("admin.manage_forms");
    const { id } = await params;
    const body = await req.json();

    // Operations: add_group, add_field, update_field, delete_field, reorder_fields, toggle_active
    const { op } = body as { op: string };

    if (op === "add_group") {
      const { label } = body;
      const count = await db.fieldGroup.count({ where: { templateId: id } });
      const group = await db.fieldGroup.create({
        data: { templateId: id, label, sortOrder: count + 1 },
      });
      return NextResponse.json({ group });
    }

    if (op === "add_field") {
      const { groupId, key, label, type, required, options, validation, conditionExpr } = body;
      const existing = await db.field.findFirst({ where: { groupId, key } });
      if (existing) return NextResponse.json({ error: "Field key already exists in group" }, { status: 400 });
      const count = await db.field.count({ where: { groupId } });
      const field = await db.field.create({
        data: {
          groupId, key, label, type, required: required ?? false,
          sortOrder: count + 1,
          options: options ? JSON.stringify(options) : null,
          validation: validation ? JSON.stringify(validation) : null,
          conditionExpr: conditionExpr ?? null,
        },
      });
      return NextResponse.json({ field });
    }

    if (op === "update_field") {
      const { fieldId, label, required, options, validation, conditionExpr, archivedAt } = body;
      const field = await db.field.update({
        where: { id: fieldId },
        data: {
          ...(label !== undefined && { label }),
          ...(required !== undefined && { required }),
          ...(options !== undefined && { options: JSON.stringify(options) }),
          ...(validation !== undefined && { validation: JSON.stringify(validation) }),
          ...(conditionExpr !== undefined && { conditionExpr }),
          ...(archivedAt !== undefined && { archivedAt: archivedAt ? new Date() : null }),
        },
      });
      return NextResponse.json({ field });
    }

    if (op === "delete_field") {
      const { fieldId } = body;
      // Check if field has been used in order items
      const used = await db.orderItemParameter.findFirst({ where: { fieldKey: (await db.field.findUnique({ where: { id: fieldId } }))?.key } });
      if (used) {
        // Soft delete (archive) instead of hard delete
        await db.field.update({ where: { id: fieldId }, data: { archivedAt: new Date() } });
        return NextResponse.json({ archived: true });
      }
      await db.field.delete({ where: { id: fieldId } });
      return NextResponse.json({ deleted: true });
    }

    if (op === "toggle_active") {
      const { active } = body;
      const template = await db.formTemplate.update({ where: { id }, data: { active } });
      return NextResponse.json({ template });
    }

    if (op === "duplicate") {
      // Create a new version of the template (snapshot)
      const original = await db.formTemplate.findUnique({
        where: { id },
        include: { groups: { include: { fields: true } } },
      });
      if (!original) return NextResponse.json({ error: "not found" }, { status: 404 });

      const newVersion = original.version + 1;
      const newTemplate = await db.formTemplate.create({
        data: {
          name: original.name,
          entityType: original.entityType,
          version: newVersion,
          active: true,
          groups: {
            create: original.groups.map((g) => ({
              label: g.label,
              sortOrder: g.sortOrder,
              conditionExpr: g.conditionExpr,
              active: g.active,
              fields: {
                create: g.fields.map((f) => ({
                  key: f.key,
                  label: f.label,
                  type: f.type,
                  required: f.required,
                  sortOrder: f.sortOrder,
                  options: f.options,
                  validation: f.validation,
                  conditionExpr: f.conditionExpr,
                  defaultValue: f.defaultValue,
                })),
              },
            })),
          },
        },
      });

      // Deactivate old version
      await db.formTemplate.update({ where: { id }, data: { active: false } });

      await db.auditLog.create({
        data: { actorId: userId, action: "form_template.version", entityType: "FormTemplate", entityId: newTemplate.id, afterJson: JSON.stringify({ version: newVersion }) },
      });

      return NextResponse.json({ template: newTemplate });
    }

    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
