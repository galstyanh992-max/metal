import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

/**
 * GET /api/inventory — list inventory states per branch.
 * Optional query: ?branchId=xxx to filter to one branch
 *
 * Returns for each product:
 *   - state (overall: onHand, reserved, available across all branches)
 *   - byBranch: [{ branchId, branchName, onHand, available }]
 */
export async function GET(req: Request) {
  try {
    const { role } = await requireAction("inventory.view_on_hand");
    const { searchParams } = new URL(req.url);
    const filterBranchId = searchParams.get("branchId");

    const [products, branches] = await Promise.all([
      db.product.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          minStock: true,
          unitId: true,
          unit: { select: { symbol: true } },
        },
      }),
      db.branch.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, code: true },
      }),
    ]);

    // Build states per (product, branch)
    const states = await Promise.all(
      products.map(async (p) => {
        // Get all movements for this product, grouped by branch
        const allMovements = await db.inventoryMovement.findMany({
          where: filterBranchId ? { productId: p.id, branchId: filterBranchId } : { productId: p.id },
          select: { type: true, qty: true, branchId: true },
        });

        // Aggregate per branch
        const byBranchMap = new Map<string, { onHand: number; reserved: number }>();
        let totalOnHand = 0;
        let totalReserved = 0;

        for (const m of allMovements) {
          const bId = m.branchId ?? "default";
          if (!byBranchMap.has(bId)) byBranchMap.set(bId, { onHand: 0, reserved: 0 });
          const st = byBranchMap.get(bId)!;
          if (["RECEIVE", "RETURN"].includes(m.type)) {
            st.onHand += m.qty;
            totalOnHand += m.qty;
          } else if (["ISSUE", "WRITE_OFF"].includes(m.type)) {
            st.onHand -= m.qty;
            totalOnHand -= m.qty;
          } else if (m.type === "ADJUSTMENT") {
            st.onHand += m.qty;
            totalOnHand += m.qty;
          } else if (m.type === "RESERVE") {
            st.reserved += m.qty;
            totalReserved += m.qty;
          } else if (m.type === "RELEASE_RESERVATION") {
            st.reserved -= m.qty;
            totalReserved -= m.qty;
          }
        }

        // Build per-branch array
        const byBranch = branches.map((b) => {
          const st = byBranchMap.get(b.id) ?? { onHand: 0, reserved: 0 };
          return {
            branchId: b.id,
            branchName: b.name,
            branchCode: b.code,
            onHand: Math.max(0, st.onHand),
            reserved: Math.max(0, st.reserved),
            available: Math.max(0, st.onHand - st.reserved),
          };
        });

        return {
          ...p,
          state: {
            onHand: Math.max(0, totalOnHand),
            reserved: Math.max(0, totalReserved),
            available: Math.max(0, totalOnHand - totalReserved),
          },
          byBranch,
        };
      })
    );

    return NextResponse.json({ inventory: states, branches });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
