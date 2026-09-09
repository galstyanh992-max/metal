import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

/**
 * GET /api/inventory — list inventory states per branch.
 * OPTIMIZED: Single bulk query for ALL movements, computed in-memory.
 * Before: 104 products × 1 query each = 105 queries (N+1 problem)
 * After: 2 queries total (products + branches) + 1 bulk movements query = 3 queries
 */
export async function GET(req: Request) {
  try {
    const { role } = await requireAction("inventory.view_on_hand");
    const { searchParams } = new URL(req.url);
    const filterBranchId = searchParams.get("branchId");

    // Single parallel fetch — only 3 queries total
    const [products, branches, allMovements] = await Promise.all([
      db.product.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          minStock: true,
          unitId: true,
          color: true,
          categoryId: true,
          unit: { select: { symbol: true, code: true } },
          category: { select: { id: true, name: true } },
        },
      }),
      db.branch.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, code: true },
      }),
      // Bulk fetch ALL movements in one query (instead of 104 separate queries)
      db.inventoryMovement.findMany({
        where: filterBranchId ? { branchId: filterBranchId } : undefined,
        select: { productId: true, type: true, qty: true, branchId: true },
      }),
    ]);

    // Build product ID set for quick lookup
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Aggregate all movements in-memory (no more DB queries)
    // Structure: Map<productId, Map<branchId, { onHand, reserved }>>
    const inventoryMap = new Map<string, Map<string, { onHand: number; reserved: number }>>();

    for (const m of allMovements) {
      const pid = m.productId;
      const bid = m.branchId ?? "default";

      if (!inventoryMap.has(pid)) inventoryMap.set(pid, new Map());
      const branchMap = inventoryMap.get(pid)!;

      if (!branchMap.has(bid)) branchMap.set(bid, { onHand: 0, reserved: 0 });
      const st = branchMap.get(bid)!;

      switch (m.type) {
        case "RECEIVE":
        case "RETURN":
          st.onHand += m.qty;
          break;
        case "ISSUE":
        case "WRITE_OFF":
          st.onHand -= m.qty;
          st.reserved -= m.qty; // ISSUE also reduces reserved
          break;
        case "ADJUSTMENT":
          st.onHand += m.qty; // signed
          break;
        case "RESERVE":
          st.reserved += m.qty;
          break;
        case "RELEASE_RESERVATION":
          st.reserved -= m.qty;
          break;
      }
    }

    // Build response — compute per-product state from in-memory map
    const states = products.map((p) => {
      const branchMap = inventoryMap.get(p.id) ?? new Map();
      let totalOnHand = 0;
      let totalReserved = 0;

      const byBranch = branches.map((b) => {
        const st = branchMap.get(b.id) ?? { onHand: 0, reserved: 0 };
        const onHand = Math.max(0, st.onHand);
        const reserved = Math.max(0, st.reserved);
        totalOnHand += onHand;
        totalReserved += reserved;
        return {
          branchId: b.id,
          branchName: b.name,
          branchCode: b.code,
          onHand,
          reserved,
          available: Math.max(0, onHand - reserved),
        };
      });

      // Also check default branch (movements without branchId)
      const defaultSt = branchMap.get("default");
      if (defaultSt) {
        const onHand = Math.max(0, defaultSt.onHand);
        const reserved = Math.max(0, defaultSt.reserved);
        totalOnHand += onHand;
        totalReserved += reserved;
      }

      return {
        ...p,
        state: {
          onHand: totalOnHand,
          reserved: totalReserved,
          available: Math.max(0, totalOnHand - totalReserved),
        },
        byBranch,
      };
    });

    return NextResponse.json({ inventory: states, branches });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
