import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/branches/:id — rename or update warehouse details (ADMIN only). */
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { userId } = await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const existing = await db.branch.findUnique({ where: { id } });

    if (!existing) return NextResponse.json({ error: "Պահեստը չի գտնվել" }, { status: 404 });

    const patch: { name?: string; address?: string | null; phone?: string | null } = {};
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Պահեստի անունը պարտադիր է" }, { status: 400 });
      if (name !== existing.name) patch.name = name;
    }
    if (typeof body.address === "string") patch.address = body.address.trim() || null;
    if (typeof body.phone === "string") patch.phone = body.phone.trim() || null;

    if (Object.keys(patch).length === 0) return NextResponse.json({ branch: existing, changed: false });

    const branch = await db.branch.update({ where: { id }, data: patch });
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "branch.update",
        entityType: "Branch",
        entityId: id,
        beforeJson: JSON.stringify({ name: existing.name, address: existing.address, phone: existing.phone }),
        afterJson: JSON.stringify({ name: branch.name, address: branch.address, phone: branch.phone }),
      },
    });

    return NextResponse.json({ branch, changed: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

/** DELETE /api/branches/:id — delete an unused non-main warehouse (ADMIN only). */
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { userId } = await requireRole("ADMIN");
    const { id } = await params;
    const branch = await db.branch.findUnique({
      where: { id },
      include: { _count: { select: { inventoryMovements: true, inventorySnapshots: true, transfersFrom: true, transfersTo: true } } },
    });

    if (!branch) return NextResponse.json({ error: "Պահեստը չի գտնվել" }, { status: 404 });
    if (branch.code === "main") {
      return NextResponse.json({ error: "Հիմնական պահեստը չի կարող ջնջվել" }, { status: 409 });
    }

    const references = branch._count.inventoryMovements + branch._count.inventorySnapshots + branch._count.transfersFrom + branch._count.transfersTo;
    if (references > 0) {
      return NextResponse.json({
        error: "Այս պահեստն ունի մնացորդների կամ տեղափոխությունների պատմություն և չի կարող ջնջվել",
        references,
      }, { status: 409 });
    }

    await db.branch.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "branch.delete",
        entityType: "Branch",
        entityId: id,
        beforeJson: JSON.stringify({ code: branch.code, name: branch.name }),
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
