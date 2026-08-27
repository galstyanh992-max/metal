import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("procurement.view_purchase_history");
    const suppliers = await db.supplier.findMany({
      include: {
        _count: { select: { products: true, purchaseOrders: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ suppliers });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("procurement.manage_suppliers");
    const body = await req.json();
    const { name, taxId, legalAddress, phone, email, paymentTerms } = body;

    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const supplier = await db.supplier.create({
      data: { name, taxId, legalAddress, phone, email, paymentTerms },
    });

    await db.auditLog.create({
      data: { actorId: userId, action: "supplier.create", entityType: "Supplier", entityId: supplier.id, afterJson: JSON.stringify({ name }) },
    });

    return NextResponse.json({ supplier });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
