/**
 * Seed "Quick-Fill" product catalog — 19 component categories.
 *
 * Each item is a flat, single-line product that appears in the order
 * Quick-Fill panel so the operator can fill qty / meterage / price
 * in one go, then save (also updates the product's sale price).
 *
 * Deduplication: skipped if a product with the same SKU already exists.
 *
 * Usage:  npx tsx scripts/seed-quickfill-products.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// 19 quick-fill items (Armenian names, dedup by SKU prefix QF-)
const QUICK_FILL_ITEMS: Array<{
  sku: string;
  name: string;
  unitCode: string;
  defaultSalePrice?: number;
  defaultPurchasePrice?: number;
  category?: string;
}> = [
  { sku: "QF-KOROB",     name: "Կոռոբ",         unitCode: "piece", category: "Կոռոբ" },
  { sku: "QF-TRUBA",     name: "Տռուբա",        unitCode: "m",     category: "Տռուբա" },
  { sku: "QF-LAMIN",     name: "Լամին",         unitCode: "m",     category: "Լամին" },
  { sku: "QF-TANGENS",   name: "Տանգենցիալ",   unitCode: "piece", category: "Տանգենցիալ" },
  { sku: "QF-REZIN",     name: "Ռեզին",         unitCode: "m",     category: "Ռեզին" },
  { sku: "QF-NAPRAV",    name: "Ուղղորդիչ",     unitCode: "piece", category: "Ուղղորդիչ" },
  { sku: "QF-SHUR",      name: "Շուռ",          unitCode: "m",     category: "Շուռ" },
  { sku: "QF-BAKAVINA",  name: "Բակավինա",     unitCode: "piece", category: "Բակավինա" },
  { sku: "QF-PAZHNIK",   name: "Պաժնիկ",        unitCode: "piece", category: "Պաժնիկ" },
  { sku: "QF-DERZHATEL", name: "Դերժատել",     unitCode: "piece", category: "Դերժատել" },
  { sku: "QF-OS",        name: "Օս",            unitCode: "piece", category: "Օս" },
  { sku: "QF-ROLIK",     name: "Ռոլիկ",         unitCode: "piece", category: "Ռոլիկ" },
  { sku: "QF-KALTSO",    name: "Կալցո",         unitCode: "piece", category: "Կալցո" },
  { sku: "QF-KLIPS",     name: "Կլիպս",         unitCode: "piece", category: "Կլիպս" },
  { sku: "QF-ZAGLUSHKA", name: "Զագլուշկա",   unitCode: "piece", category: "Զագլուշկա" },
  { sku: "QF-KARDAN",    name: "Կարդան",        unitCode: "piece", category: "Կարդան" },
  { sku: "QF-RUCHKA",    name: "Ռուչկա",        unitCode: "piece", category: "Ռուչկա" },
  { sku: "QF-MOTOR-80",  name: "Մատոռ 80",     unitCode: "piece", defaultSalePrice: 28000, defaultPurchasePrice: 19000, category: "Շարժիչ" },
  { sku: "QF-PULT-DC155",name: "Պուլտ DC155",  unitCode: "piece", defaultSalePrice: 16500, defaultPurchasePrice: 9800, category: "Կառավարման վահանակ" },
];

async function main() {
  // Build unit lookup
  const units = await db.unit.findMany();
  const unitByCode = new Map(units.map((u) => [u.code, u]));
  console.log(`Found ${units.length} units`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const item of QUICK_FILL_ITEMS) {
    const unit = unitByCode.get(item.unitCode);
    if (!unit) {
      console.error(`Unit ${item.unitCode} not found — skipping ${item.sku}`);
      continue;
    }

    // Find or create category (by name, since Category.name is not unique)
    let category = null;
    if (item.category) {
      category = await db.category.findFirst({ where: { name: item.category } });
      if (!category) {
        category = await db.category.create({ data: { name: item.category!, active: true } });
        console.log(`+ Category created: ${category.name}`);
      }
    }

    // Dedup by SKU
    const existing = await db.product.findUnique({ where: { sku: item.sku } });
    if (existing) {
      // Update unit/category binding if needed; preserve existing prices
      const patch: any = { unitId: unit.id, active: true };
      if (category) patch.categoryId = category.id;
      if (item.defaultSalePrice && existing.salePrice === 0) patch.salePrice = item.defaultSalePrice;
      if (item.defaultPurchasePrice && existing.purchasePrice === 0) patch.purchasePrice = item.defaultPurchasePrice;
      await db.product.update({ where: { id: existing.id }, data: patch });
      console.log(`  ✓ Updated existing: ${item.sku} — ${item.name}`);
      updated++;
      continue;
    }

    await db.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        unitId: unit.id,
        categoryId: category?.id ?? null,
        salePrice: item.defaultSalePrice ?? 0,
        purchasePrice: item.defaultPurchasePrice ?? 0,
        active: true,
      },
    });
    console.log(`  + Created: ${item.sku} — ${item.name} (${item.unitCode})`);
    created++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total QF items processed: ${QUICK_FILL_ITEMS.length}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
