import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN", "OPERATOR");
    const { id } = await params;

    const history = await db.productPriceHistory.findMany({
      where: { productId: id },
      orderBy: { effectiveFrom: "desc" },
      take: 20,
      include: { product: { select: { name: true, sku: true } } },
    });

    return NextResponse.json({ history });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
