import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const capturedAt = new Date().toISOString();
  const backup = {
    version: 1,
    capturedAt,
    products: await db.product.findMany(),
    priceHistory: await db.productPriceHistory.findMany(),
    movements: await db.inventoryMovement.findMany(),
    snapshots: await db.inventorySnapshot.findMany(),
  };

  const backupDirectory = join(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const fileName = `warehouse-before-reset-${capturedAt.replace(/[:.]/g, "-")}.json`;
  const filePath = join(backupDirectory, fileName);
  await writeFile(filePath, JSON.stringify(backup, null, 2), "utf8");

  console.log(JSON.stringify({
    filePath,
    products: backup.products.length,
    priceHistory: backup.priceHistory.length,
    movements: backup.movements.length,
    snapshots: backup.snapshots.length,
  }));
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
