import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

/**
 * GET /api/debts — list all clients with outstanding debt.
 *
 * For each client returns:
 *   - id, type (INDIVIDUAL/COMPANY), name (firstName+lastName or companyName), phone, email
 *   - totalDebt — sum of outstandingAmount across unpaid orders
 *   - totalPaid — sum of paidAmount across all orders
 *   - totalOrdered — sum of totalAmount across all orders
 *   - orders: [{ id, number, createdAt, totalAmount, paidAmount, outstandingAmount, status }]
 *
 * Clients with 0 debt are filtered out by default.
 */
export async function GET(req: Request) {
  try {
    await requireAction("finance.view_debt");
    const { searchParams } = new URL(req.url);
    const includeZero = searchParams.get("includeZero") === "true";

    const clients = await db.client.findMany({
      where: { active: true, archivedAt: null },
      include: {
        orders: {
          where: { status: { notIn: ["DRAFT", "CANCELLED"] }, ...(includeZero ? {} : { outstandingAmount: { gt: 0 } }) },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            number: true,
            status: true,
            createdAt: true,
            totalAmount: true,
            paidAmount: true,
            outstandingAmount: true,
            note: true,
            dueDate: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const debtors = clients
      .map((c) => {
        const orders = c.orders ?? [];
        const totalDebt = orders.reduce((s, o) => s + o.outstandingAmount, 0);
        const totalPaid = orders.reduce((s, o) => s + o.paidAmount, 0);
        const totalOrdered = orders.reduce((s, o) => s + o.totalAmount, 0);
        const name = c.type === "COMPANY" ? c.companyName : `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
        const address = c.primaryAddress ?? c.actualAddress ?? c.legalAddress ?? c.secondaryAddress ?? "";
        return {
          id: c.id,
          type: c.type,
          firstName: c.firstName,
          lastName: c.lastName,
          companyName: c.companyName,
          name,
          phone: c.phone,
          email: c.email,
          taxId: c.taxId,
          address,
          orders,
          orderCount: orders.length,
          totalDebt,
          totalPaid,
          totalOrdered,
          oldestOrderDate: orders[0]?.createdAt ?? null,
        };
      })
      .filter((d) => includeZero || d.totalDebt > 0);

    // Sort: largest debt first
    debtors.sort((a, b) => b.totalDebt - a.totalDebt);

    const grandTotalDebt = debtors.reduce((s, d) => s + d.totalDebt, 0);
    const grandTotalPaid = debtors.reduce((s, d) => s + d.totalPaid, 0);
    const grandTotalOrdered = debtors.reduce((s, d) => s + d.totalOrdered, 0);

    return NextResponse.json({
      debtors,
      summary: {
        debtorCount: debtors.length,
        totalDebt: grandTotalDebt,
        totalPaid: grandTotalPaid,
        totalOrdered: grandTotalOrdered,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
