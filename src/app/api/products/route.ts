import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction, stripForbiddenForWarehouse } from "@/lib/rbac";

export async function GET() {
  try {
    const { role } = await requireAction("product.list");
    const products = await db.product.findMany({
      where: { active: true, archivedAt: null },
      include: { unit: true, category: true },
      orderBy: { name: "asc" },
    });

    if (role === "WAREHOUSE") {
      return NextResponse.json({
        products: products.map((p) => {
          const { salePrice, purchasePrice, ...rest } = p as any;
          return rest;
        }),
      });
    }
    if (role === "OPERATOR") {
      return NextResponse.json({
        products: products.map((p) => {
          const { purchasePrice, ...rest } = p as any;
          return rest;
        }),
      });
    }
    return NextResponse.json({ products });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
