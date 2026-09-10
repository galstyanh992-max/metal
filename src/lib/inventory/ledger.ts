/**
 * Inventory invariant helpers.
 *
 * ON_HAND     = SUM(RECEIVE) − SUM(ISSUE) − SUM(WRITE_OFF) + SUM(RETURN) + SUM(ADJUSTMENT)
 * RESERVED    = SUM(RESERVE) − SUM(RELEASE_RESERVATION) − SUM(ISSUE from reservation)
 * AVAILABLE   = ON_HAND − RESERVED
 *
 * Movements are IMMUTABLE. Corrections via new ADJUSTMENT movement.
 */
import { db } from "@/lib/db";
import { Prisma, type MovementType } from "@prisma/client";

const ADDS_TO_ON_HAND: MovementType[] = ["RECEIVE", "RETURN"];
const SUBS_FROM_ON_HAND: MovementType[] = ["ISSUE", "WRITE_OFF"];
const ADJUSTMENT_TYPE: MovementType = "ADJUSTMENT";

const ADDS_TO_RESERVED: MovementType[] = ["RESERVE"];
const SUBS_FROM_RESERVED: MovementType[] = ["RELEASE_RESERVATION", "ISSUE"];

export interface InventoryState {
  onHand: number;
  reserved: number;
  available: number;
}

type LedgerClient = Prisma.TransactionClient | typeof db;

async function getInventoryState(client: LedgerClient, productId: string, branchId?: string): Promise<InventoryState> {
  const movements = await client.inventoryMovement.findMany({
    where: { productId, branchId: branchId ?? null },
    select: { type: true, qty: true },
  });

  let onHand = 0;
  let reserved = 0;

  for (const m of movements) {
    if (ADDS_TO_ON_HAND.includes(m.type)) onHand += m.qty;
    else if (SUBS_FROM_ON_HAND.includes(m.type)) onHand -= m.qty;
    else if (m.type === ADJUSTMENT_TYPE) onHand += m.qty; // signed
    if (ADDS_TO_RESERVED.includes(m.type)) reserved += m.qty;
    else if (SUBS_FROM_RESERVED.includes(m.type)) reserved -= m.qty;
  }

  return {
    onHand: Math.max(0, onHand),
    reserved: Math.max(0, reserved),
    available: Math.max(0, onHand - reserved),
  };
}

export async function computeInventoryState(productId: string, branchId?: string): Promise<InventoryState> {
  return getInventoryState(db, productId, branchId);
}

export async function refreshSnapshot(productId: string, branchId?: string): Promise<void> {
  const state = await computeInventoryState(productId, branchId);
  // Find existing snapshot for this (productId, branchId) combo
  const existing = await db.inventorySnapshot.findFirst({
    where: { productId, branchId: branchId ?? null },
  });
  if (existing) {
    await db.inventorySnapshot.update({
      where: { id: existing.id },
      data: { onHand: state.onHand, reserved: state.reserved, updatedAt: new Date() },
    });
  } else {
    await db.inventorySnapshot.create({
      data: { productId, branchId: branchId ?? null, onHand: state.onHand, reserved: state.reserved },
    });
  }
}

/**
 * Record a movement inside a transaction. Validates invariants.
 */
export async function recordMovement(params: {
  productId: string;
  type: MovementType;
  qty: number;
  byUserId: string;
  refType?: string;
  refId?: string;
  note?: string;
  branchId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { productId, type, qty, byUserId, refType, refId, note, branchId } = params;
  if (qty <= 0) return { ok: false, error: "qty must be positive" };

  return await db.$transaction(async (tx) => {
    const state = await getInventoryState(tx, productId, branchId);

    if (type === "RESERVE") {
      if (qty > state.available) {
        return { ok: false, error: `Insufficient available stock. Available: ${state.available}, requested: ${qty}` };
      }
    } else if (type === "ISSUE") {
      if (qty > state.reserved) {
        return { ok: false, error: `Cannot issue more than reserved. Reserved: ${state.reserved}, requested: ${qty}` };
      }
    } else if (type === "RELEASE_RESERVATION") {
      if (qty > state.reserved) {
        return { ok: false, error: `Cannot release more than reserved. Reserved: ${state.reserved}, requested: ${qty}` };
      }
    } else if (type === "WRITE_OFF") {
      if (qty > state.onHand) {
        return { ok: false, error: `Cannot write off more than on-hand. On hand: ${state.onHand}, requested: ${qty}` };
      }
    } else if (type === "RETURN") {
      // allowed — adds to on-hand
    } else if (type === "ADJUSTMENT") {
      // signed adjustment; can be negative (correction)
    }

    await tx.inventoryMovement.create({
      data: {
        productId,
        type,
        qty: type === "ADJUSTMENT" ? qty : Math.abs(qty),
        byUserId,
        refType: refType ?? null,
        refId: refId ?? null,
        note: note ?? null,
        branchId: branchId ?? null,
      },
    });

    // refresh snapshot (find or create by productId + branchId)
    const newState = await getInventoryState(tx, productId, branchId);
    const existingSnap = await tx.inventorySnapshot.findFirst({
      where: { productId, branchId: branchId ?? null },
    });
    if (existingSnap) {
      await tx.inventorySnapshot.update({
        where: { id: existingSnap.id },
        data: { onHand: newState.onHand, reserved: newState.reserved, updatedAt: new Date() },
      });
    } else {
      await tx.inventorySnapshot.create({
        data: { productId, branchId: branchId ?? null, onHand: newState.onHand, reserved: newState.reserved },
      });
    }

    // check low stock
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (product && newState.available < product.minStock) {
      await tx.notification.create({
        data: {
          type: "low_stock",
          severity: "WARNING",
          title: "Ցածր մնացորդ",
          body: `${product.name} (${product.sku}) մնացորդը ${newState.available} է, նվազագույնը՝ ${product.minStock}`,
          payload: JSON.stringify({ productId, available: newState.available, minStock: product.minStock }),
        },
      });
    }

    return { ok: true };
  });
}
