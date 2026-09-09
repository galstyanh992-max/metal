/**
 * Seed the "service" unit and the two service products (Հավաքում / Առաքում)
 * used by the Դարպասի Հաշվարկ calculator.
 *
 * Usage:  npx tsx scripts/seed-service-unit.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Ensure the "service" unit exists
  const serviceUnit = await db.unit.upsert({
    where: { code: "service" },
    update: { name: "Ծառայություն", symbol: "ծառ.", active: true },
    create: { code: "service", name: "Ծառայություն", symbol: "ծառ.", active: true },
  });
  console.log(`✓ Unit: ${serviceUnit.code} — ${serviceUnit.name}`);

  // 2. Ensure the two service products exist (no stock, no color, no length)
  const services = [
    { sku: "SVC-ASSEMBLY", name: "Հավաքում" },
    { sku: "SVC-DELIVERY", name: "Առաքում" },
  ];
  for (const s of services) {
    const existing = await db.product.findUnique({ where: { sku: s.sku } });
    if (existing) {
      await db.product.update({
        where: { id: existing.id },
        data: { unitId: serviceUnit.id, active: true, archivedAt: null },
      });
      console.log(`✓ Updated existing: ${s.sku} — ${s.name}`);
    } else {
      await db.product.create({
        data: {
          sku: s.sku,
          name: s.name,
          unitId: serviceUnit.id,
          salePrice: 0,
          purchasePrice: 0,
          minStock: 0,
          active: true,
        },
      });
      console.log(`+ Created: ${s.sku} — ${s.name}`);
    }
  }

  console.log("\n=== Service unit + products ready ===");
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
