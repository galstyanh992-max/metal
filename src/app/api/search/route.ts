import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const [clients, orders, products] = await Promise.all([
      db.client.findMany({
        where: {
          OR: [
            { firstName: { contains: q } }, { lastName: { contains: q } },
            { companyName: { contains: q } }, { phone: { contains: q } },
            { email: { contains: q } }, { taxId: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, type: true, firstName: true, lastName: true, companyName: true, phone: true, email: true },
      }),
      db.order.findMany({
        where: { OR: [{ number: { contains: q } }, { client: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { companyName: { contains: q } }] } }] },
        take: 10,
        include: { client: true },
      }),
      db.product.findMany({
        where: { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }] },
        take: 10,
        select: { id: true, name: true, sku: true, barcode: true },
      }),
    ]);

    const results = [
      ...clients.map((c) => ({ type: "client", id: c.id, label: c.type === "COMPANY" ? c.companyName : `${c.firstName} ${c.lastName}`, sub: c.phone })),
      ...orders.map((o) => ({ type: "order", id: o.id, label: o.number, sub: o.client?.companyName ?? `${o.client?.firstName ?? ""} ${o.client?.lastName ?? ""}` })),
      ...products.map((p) => ({ type: "product", id: p.id, label: p.name, sub: p.sku })),
    ];

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
