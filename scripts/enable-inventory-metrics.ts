/**
 * Widen only warehouse quantities, preserving existing rows and integer values.
 * Run before deploying the updated Prisma client: bun scripts/enable-inventory-metrics.ts
 * Safe to rerun. --check-only verifies the conversion inside a rolled-back transaction.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const checkOnly = process.argv.includes("--check-only");
const rollback = new Error("inventory-metrics-check-rollback");

try {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe('LOCK TABLE "InventoryMovement", "InventorySnapshot" IN ACCESS EXCLUSIVE MODE');
    const summarize = () => tx.$queryRaw<Array<{ movements: bigint; quantity: string; snapshots: bigint; onHand: string; reserved: string }>>`
      SELECT (SELECT count(*) FROM "InventoryMovement") AS movements,
             (SELECT coalesce(sum(qty::numeric), 0)::text FROM "InventoryMovement") AS quantity,
             (SELECT count(*) FROM "InventorySnapshot") AS snapshots,
             (SELECT coalesce(sum("onHand"::numeric), 0)::text FROM "InventorySnapshot") AS "onHand",
             (SELECT coalesce(sum(reserved::numeric), 0)::text FROM "InventorySnapshot") AS reserved`;
    const before = (await summarize())[0];
    await tx.$executeRawUnsafe('ALTER TABLE "InventoryMovement" ALTER COLUMN "qty" TYPE DOUBLE PRECISION USING "qty"::DOUBLE PRECISION');
    await tx.$executeRawUnsafe('ALTER TABLE "InventorySnapshot" ALTER COLUMN "onHand" TYPE DOUBLE PRECISION USING "onHand"::DOUBLE PRECISION, ALTER COLUMN "reserved" TYPE DOUBLE PRECISION USING "reserved"::DOUBLE PRECISION');
    const after = (await summarize())[0];
    if (Object.keys(before).some((key) => before[key as keyof typeof before] !== after[key as keyof typeof after])) {
      throw new Error("Warehouse totals changed during conversion; rolling back.");
    }
    console.log(`Verified ${before.movements} movements and ${before.snapshots} snapshots: quantities unchanged.`);
    if (checkOnly) throw rollback;
  }, { timeout: 30_000 });
  console.log("Warehouse quantities now support fractional measurements.");
} catch (error) {
  if (error === rollback) console.log("Check passed; schema changes rolled back.");
  else throw error;
} finally {
  await db.$disconnect();
}
