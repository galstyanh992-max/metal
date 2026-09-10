import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

/**
 * GET /api/branches — list all active branches
 */
export async function GET() {
  try {
    await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");
    const branches = await db.branch.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { inventoryMovements: true, transfersFrom: true, transfersTo: true },
        },
      },
    });
    return NextResponse.json({ branches });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/**
 * POST /api/branches — create a new warehouse (ADMIN only)
 * Body: { name, address?, phone?, code? }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireRole("ADMIN");
    const body = await req.json();
    const { code: submittedCode, name, address, phone, sortOrder } = body as {
      code?: string;
      name: string;
      address?: string;
      phone?: string;
      sortOrder?: number;
    };

    const displayName = name?.trim();
    if (!displayName) {
      return NextResponse.json({ error: "Պահեստի անունը պարտադիր է" }, { status: 400 });
    }

    const requestedCode = submittedCode?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const baseCode = requestedCode || "warehouse";
    let code = baseCode;
    let suffix = 2;
    while (await db.branch.findUnique({ where: { code } })) {
      code = `${baseCode}-${suffix++}`;
    }

    const branch = await db.branch.create({
      data: {
        code,
        name: displayName,
        address: address || null,
        phone: phone || null,
        sortOrder: Number(sortOrder) || 0,
      },
    });

    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "branch.create",
        entityType: "Branch",
        entityId: branch.id,
        afterJson: JSON.stringify({ code, name: displayName }),
      },
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
