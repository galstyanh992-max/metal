import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

/**
 * GET /api/inventory/transfer — list all transfers
 */
export async function GET(req: Request) {
  try {
    await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const take = Number(searchParams.get("limit") ?? 50);

    const transfers = await db.transfer.findMany({
      where: status ? { status } : undefined,
      include: {
        fromBranch: true,
        toBranch: true,
        items: { include: { product: { include: { unit: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ transfers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/**
 * POST /api/inventory/transfer — create a new transfer between branches
 *
 * Body:
 *   {
 *     fromBranchId: string,
 *     toBranchId: string,
 *     items: [{ productId, qty }],
 *     note?: string
 *   }
 *
 * Logic:
 *   1. Validate fromBranch != toBranch
 *   2. Validate each item has enough stock in fromBranch
 *   3. Create transfer record with status DRAFT
 *   4. If autoConfirm=true → execute transfer:
 *      - WRITE_OFF from fromBranch
 *      - RECEIVE to toBranch
 *   5. Status becomes IN_TRANSIT then RECEIVED
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireRole("ADMIN", "OPERATOR");
    const body = await req.json();
    const { fromBranchId, toBranchId, items, note, autoConfirm } = body as {
      fromBranchId: string;
      toBranchId: string;
      items: Array<{ productId: string; qty: number }>;
      note?: string;
      autoConfirm?: boolean;
    };

    if (!fromBranchId || !toBranchId) {
      return NextResponse.json({ error: "fromBranchId and toBranchId required" }, { status: 400 });
    }
    if (fromBranchId === toBranchId) {
      return NextResponse.json({ error: "Հնարավոր չէ փոխանցել նույն ֆիլիալին" }, { status: 400 });
    }
    if (!items?.length) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    // Validate branches exist
    const [fromBranch, toBranch] = await Promise.all([
      db.branch.findUnique({ where: { id: fromBranchId } }),
      db.branch.findUnique({ where: { id: toBranchId } }),
    ]);
    if (!fromBranch) return NextResponse.json({ error: "fromBranch not found" }, { status: 404 });
    if (!toBranch) return NextResponse.json({ error: "toBranch not found" }, { status: 404 });

    // Validate stock availability in fromBranch
    const stockErrors: string[] = [];
    for (const it of items) {
      const product = await db.product.findUnique({ where: { id: it.productId } });
      if (!product) {
        stockErrors.push(`Ապրանքը չի գտնվել`);
        continue;
      }
      // Compute available stock in fromBranch
      const movements = await db.inventoryMovement.findMany({
        where: { productId: it.productId, branchId: fromBranchId },
        select: { type: true, qty: true },
      });
      let onHand = 0;
      for (const m of movements) {
        if (["RECEIVE", "RETURN"].includes(m.type)) onHand += m.qty;
        else if (["ISSUE", "WRITE_OFF"].includes(m.type)) onHand -= m.qty;
        else if (m.type === "ADJUSTMENT") onHand += m.qty;
      }
      onHand = Math.max(0, onHand);
      if (onHand < it.qty) {
        stockErrors.push(`«${product.name}» (${product.sku}) — մատչելի է ${onHand} հատ, պահանջվում է ${it.qty}`);
      }
    }
    if (stockErrors.length > 0) {
      return NextResponse.json(
        { error: "Անբավարար պաշար ֆիլիալում", details: stockErrors, stockError: true },
        { status: 409 }
      );
    }

    // Generate transfer number
    const year = new Date().getFullYear();
    const count = await db.transfer.count({ where: { number: { startsWith: `TR-${year}-` } } });
    const number = `TR-${year}-${String(count + 1).padStart(4, "0")}`;

    // Build transfer items
    const transferItemsData = [];
    let totalAmount = 0;
    for (const it of items) {
      const product = await db.product.findUnique({ where: { id: it.productId } });
      const unitPrice = product?.purchasePrice ?? 0;
      const lineTotal = unitPrice * it.qty;
      totalAmount += lineTotal;
      transferItemsData.push({
        productId: it.productId,
        qty: it.qty,
        unitPrice,
        total: lineTotal,
        productName: product?.name ?? "",
      });
    }

    // Create transfer record
    const transfer = await db.transfer.create({
      data: {
        number,
        fromBranchId,
        toBranchId,
        status: autoConfirm ? "RECEIVED" : "DRAFT",
        totalAmount,
        note: note ?? null,
        createdBy: userId,
        receivedAt: autoConfirm ? new Date() : null,
        items: { create: transferItemsData },
      },
      include: { items: true, fromBranch: true, toBranch: true },
    });

    // If autoConfirm, execute the actual stock movements
    if (autoConfirm) {
      for (const it of items) {
        // WRITE_OFF from fromBranch
        await db.inventoryMovement.create({
          data: {
            productId: it.productId,
            type: "WRITE_OFF",
            qty: it.qty,
            byUserId: userId,
            branchId: fromBranchId,
            refType: "TRANSFER",
            refId: transfer.id,
            note: `Տեղափոխություն ${number} → ${toBranch.name}`,
          },
        });
        // RECEIVE to toBranch
        await db.inventoryMovement.create({
          data: {
            productId: it.productId,
            type: "RECEIVE",
            qty: it.qty,
            byUserId: userId,
            branchId: toBranchId,
            refType: "TRANSFER",
            refId: transfer.id,
            note: `Տեղափոխություն ${number} ← ${fromBranch.name}`,
          },
        });
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "transfer.create",
        entityType: "Transfer",
        entityId: transfer.id,
        afterJson: JSON.stringify({
          number,
          fromBranch: fromBranch.name,
          toBranch: toBranch.name,
          itemsCount: items.length,
          totalAmount,
          autoConfirmed: !!autoConfirm,
        }),
      },
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
