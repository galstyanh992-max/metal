import type { Prisma, MovementType } from "@prisma/client";
import { inventoryStateFromMovements, lockInventoryProducts, type InventoryState } from "./ledger";
import { roundInventoryQuantity } from "./quantity";

export class OrderStockError extends Error {}
export type StockRequirement = { productId: string; qty: number; name: string };
type Allocation = { productId: string; branchId: string | null; qty: number };
type StockMovement = Allocation & { type: MovementType };
const stockKey = (productId: string, branchId: string | null) => JSON.stringify([productId, branchId]);

function branchStates(movements: StockMovement[]) {
  const groups = new Map<string, StockMovement[]>();
  for (const movement of movements) {
    const key = stockKey(movement.productId, movement.branchId);
    const group = groups.get(key) ?? [];
    group.push(movement);
    groups.set(key, group);
  }
  const states = new Map<string, InventoryState>();
  for (const [key, group] of groups) states.set(key, inventoryStateFromMovements(group));
  return states;
}

async function writeAllocations(
  tx: Prisma.TransactionClient, orderId: string, userId: string,
  allocations: Allocation[], states: Map<string, InventoryState>, type: "RESERVE" | "RELEASE_RESERVATION",
) {
  if (!allocations.length) return;
  await tx.inventoryMovement.createMany({
    data: allocations.map((allocation) => ({
      ...allocation, type, byUserId: userId, refType: "ORDER", refId: orderId,
      note: type === "RESERVE" ? "Պատվերի պաշարի ամրագրում" : "Պատվերի ամրագրման ազատում",
    })),
  });
  const productIds = [...new Set(allocations.map((item) => item.productId))];
  const snapshots = await tx.inventorySnapshot.findMany({ where: { productId: { in: productIds } } });
  const snapshotMap = new Map(snapshots.map((snapshot) => [stockKey(snapshot.productId, snapshot.branchId), snapshot]));
  for (const allocation of allocations) {
    const key = stockKey(allocation.productId, allocation.branchId);
    const state = states.get(key)!;
    const reserved = roundInventoryQuantity(state.reserved + (type === "RESERVE" ? allocation.qty : -allocation.qty));
    const existing = snapshotMap.get(key);
    const data = { onHand: state.onHand, reserved, updatedAt: new Date() };
    if (existing) await tx.inventorySnapshot.update({ where: { id: existing.id }, data });
    else await tx.inventorySnapshot.create({ data: { ...data, productId: allocation.productId, branchId: allocation.branchId } });
  }
  if (type === "RESERVE") {
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const notifications = allocations.flatMap((allocation) => {
      const product = productMap.get(allocation.productId);
      const available = roundInventoryQuantity(states.get(stockKey(allocation.productId, allocation.branchId))!.available - allocation.qty);
      return product && available < product.minStock ? [{
        type: "low_stock", severity: "WARNING" as const, title: "Ցածր մնացորդ",
        body: `${product.name} (${product.sku}) մնացորդը ${available} է, նվազագույնը՝ ${product.minStock}`,
        payload: JSON.stringify({ productId: product.id, branchId: allocation.branchId, available, minStock: product.minStock }),
      }] : [];
    });
    if (notifications.length) await tx.notification.createMany({ data: notifications });
  }
}

/** Allocate from the actual warehouses, in their configured order, then legacy unassigned stock. */
export async function reserveOrderStock(tx: Prisma.TransactionClient, orderId: string, userId: string, requirements: StockRequirement[]) {
  const required = new Map<string, StockRequirement>();
  for (const item of requirements) {
    if (!Number.isFinite(item.qty) || item.qty <= 0) throw new OrderStockError("Ապրանքի ամրագրման քանակը սխալ է");
    const previous = required.get(item.productId);
    required.set(item.productId, { ...item, qty: roundInventoryQuantity((previous?.qty ?? 0) + item.qty) });
  }
  const ids = [...required.keys()];
  if (!ids.length) return;
  await lockInventoryProducts(tx, ids);
  const movements = await tx.inventoryMovement.findMany({ where: { productId: { in: ids } }, select: { productId: true, branchId: true, type: true, qty: true } });
  const states = branchStates(movements);
  const branches = await tx.branch.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
  const sources: (string | null)[] = [...branches.map((branch) => branch.id), null];
  const allocations: Allocation[] = [];
  for (const item of required.values()) {
    const available = roundInventoryQuantity(sources.reduce((sum, branchId) => sum + (states.get(stockKey(item.productId, branchId))?.available ?? 0), 0));
    if (item.qty > available) {
      throw new OrderStockError(`«${item.name}» — պահեստներում մատչելի է ${available}, անհրաժեշտ է ${item.qty}։ Լրացրեք պաշարը և կրկին հաստատեք սևագիրը։`);
    }
    let remaining = item.qty;
    for (const branchId of sources) {
      const availableHere = states.get(stockKey(item.productId, branchId))?.available ?? 0;
      const qty = roundInventoryQuantity(Math.min(remaining, availableHere));
      if (qty > 0) allocations.push({ productId: item.productId, branchId, qty });
      remaining = roundInventoryQuantity(remaining - qty);
      if (remaining === 0) break;
    }
  }
  await writeAllocations(tx, orderId, userId, allocations, states, "RESERVE");
}

/** Release only this order's remaining reservations, at the branches where they were made. */
export async function releaseOrderStock(tx: Prisma.TransactionClient, orderId: string, userId: string) {
  const movements = await tx.inventoryMovement.findMany({
    where: { refType: "ORDER", refId: orderId },
    select: { productId: true, branchId: true, type: true, qty: true },
  });
  const reserved = new Map<string, Allocation>();
  for (const movement of movements) {
    if (!["RESERVE", "RELEASE_RESERVATION", "ISSUE"].includes(movement.type)) continue;
    const key = stockKey(movement.productId, movement.branchId);
    const previous = reserved.get(key)?.qty ?? 0;
    reserved.set(key, { productId: movement.productId, branchId: movement.branchId,
      qty: roundInventoryQuantity(previous + (movement.type === "RESERVE" ? movement.qty : -movement.qty)) });
  }
  const allocations = [...reserved.values()].filter((item) => item.qty > 0);
  if (!allocations.length) return;
  const ids = [...new Set(allocations.map((item) => item.productId))];
  await lockInventoryProducts(tx, ids);
  const allMovements = await tx.inventoryMovement.findMany({ where: { productId: { in: ids } }, select: { productId: true, branchId: true, type: true, qty: true } });
  const states = branchStates(allMovements);
  for (const allocation of allocations) {
    if (allocation.qty > (states.get(stockKey(allocation.productId, allocation.branchId))?.reserved ?? 0)) {
      throw new OrderStockError("Պատվերի ամրագրված պաշարը փոխվել է։ Թարմացրեք էջը։");
    }
  }
  await writeAllocations(tx, orderId, userId, allocations, states, "RELEASE_RESERVATION");
}
