/**
 * Import 73 arm roll products into the ERP.
 * Idempotent — uses name-based dedup.
 */

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const PRODUCTS: { name: string; family: string }[] = [
  { name: "Կոռոբ 16", family: "Կոռոբ" }, { name: "Կոռոբ 20", family: "Կոռոբ" },
  { name: "Կոռոբ 25", family: "Կոռոբ" }, { name: "Կոռոբ 30", family: "Կոռոբ" },
  { name: "Կոռոբ 35", family: "Կոռոբ" }, { name: "Կոռոբ 40", family: "Կոռոբ" },
  { name: "Վալ 40", family: "Վալ" }, { name: "Վալ 60", family: "Վալ" },
  { name: "Վալ 70", family: "Վալ" }, { name: "Վալ 102", family: "Վալ" },
  { name: "Լամիլ 3,9", family: "Լամիլ" }, { name: "Լամիլ 5,5", family: "Լամիլ" }, { name: "Լամիլ 7,7", family: "Լամիլ" },
  { name: "Տակացու 3,9", family: "Տակացու" }, { name: "Տակացու 5,5", family: "Տակացու" }, { name: "Տակացու 7,7", family: "Տակացու" },
  { name: "Ռետինե ժապավեն 3,9", family: "Ռետինե ժապավեն" }, { name: "Ռետինե ժապավեն 5,5", family: "Ռետինե ժապավեն" }, { name: "Ռետինե ժապավեն 7,7", family: "Ռետինե ժապավեն" },
  { name: "Ուղղորդիչ 3,9", family: "Ուղղորդիչ" }, { name: "Ուղղորդիչ 5,5", family: "Ուղղորդիչ" }, { name: "Ուղղորդիչ 7,7", family: "Ուղղորդիչ" }, { name: "Ուղղորդիչ մեգա", family: "Ուղղորդիչ" },
  { name: "Պուխ մանր", family: "Պուխ" }, { name: "Պուխ խոշոր", family: "Պուխ" },
  { name: "Կողային կափարիչ 16", family: "Կողային կափարիչ" }, { name: "Կողային կափարիչ 20", family: "Կողային կափարիչ" },
  { name: "Կողային կափարիչ 25", family: "Կողային կափարիչ" }, { name: "Կողային կափարիչ 30", family: "Կողային կափարիչ" },
  { name: "Կողային կափարիչ 35", family: "Կողային կափարիչ" }, { name: "Կողային կափարիչ 40", family: "Կողային կափարիչ" },
  { name: "Առանցքակալ փոքր", family: "Առանցքակալ" }, { name: "Առանցքակալ մեծ", family: "Առանցքակալ" },
  { name: "Առանցքակալի ամրակ փոքր", family: "Առանցքակալի ամրակ" }, { name: "Առանցքակալի ամրակ մեծ", family: "Առանցքակալի ամրակ" },
  { name: "Օս պլաստմասե 40", family: "Օս" }, { name: "Օս պլաստմասե 60", family: "Օս" },
  { name: "Օս կարգավորվող դյուրալյումինե 60", family: "Օս" }, { name: "Օս պլաստմասե 70", family: "Օս" },
  { name: "Օս դյուրալյումինե 70", family: "Օս" }, { name: "Օս կարգավորվող պլաստմասե 70", family: "Օս" },
  { name: "Օս կարգավորվող դյուրալյումինե 70", family: "Օս" },
  { name: "Ռոլիկ մեծ", family: "Ռոլիկ" }, { name: "Ռոլիկ փոքր", family: "Ռոլիկ" },
  { name: "Օղակ 40", family: "Օղակ" }, { name: "Օղակ 60", family: "Օղակ" }, { name: "Օղակ 70", family: "Օղակ" },
  { name: "Կախիչ 3,9", family: "Կախիչ" }, { name: "Կախիչ 7,7/5,5", family: "Կախիչ" },
  { name: "Վերին ավտոմատ փական 7,7", family: "Վերին ավտոմատ փական" },
  { name: "Խցան 3,9", family: "Խցան" }, { name: "Խցան 5,5", family: "Խցան" }, { name: "Խցան 7,7", family: "Խցան" },
  { name: "Կարդան ունիվերսալ", family: "Կարդան" }, { name: "Կարդան շարժական", family: "Կարդան" },
  { name: "Վթարային բռնակ DS38A 1300mm", family: "Վթարային բռնակ" }, { name: "Վթարային բռնակ DS38C 1800mm", family: "Վթարային բռնակ" },
  { name: "Շարժիչ 20Nm(60)", family: "Շարժիչ" }, { name: "Շարժիչ 50Nm առանց վթարային (60)", family: "Շարժիչ" },
  { name: "Շարժիչ 50Nm(60)", family: "Շարժիչ" }, { name: "Շարժիչ 80Nm (70)", family: "Շարժիչ" },
  { name: "Շարժիչ 100Nm (70)", family: "Շարժիչ" }, { name: "Շարժիչ 120Nm (70)", family: "Շարժիչ" },
  { name: "Շարժիչ 140Nm (70)", family: "Շարժիչ" }, { name: "Շարժիչ 230Nm (102)", family: "Շարժիչ" },
  { name: "Բլոկ DC155 1 կանալանի", family: "Բլոկ" }, { name: "Բլոկ DC257 4 կանալանի", family: "Բլոկ" },
  { name: "Պուլտ DC115A", family: "Պուլտ" }, { name: "Պուլտ DC115B", family: "Պուլտ" },
  { name: "Կառավարման անջատիչ DC866", family: "Կառավարման անջատիչ" },
  { name: "Ադապտեր 60-70", family: "Ադապտեր" },
  { name: "Սահմանափակիչ թիթեղ", family: "Սահմանափակիչ թիթեղ" },
  { name: "Կողպեկ", family: "Կողպեկ" },
];

async function main() {
  const existing = await db.product.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map(p => p.name.trim()));

  const families = [...new Set(PRODUCTS.map(p => p.family))];
  const categoryMap = new Map();
  for (const family of families) {
    let cat = await db.category.findFirst({ where: { name: family } });
    if (!cat) cat = await db.category.create({ data: { name: family, sortOrder: 100 } });
    categoryMap.set(family, cat.id);
  }

  const pieceUnit = await db.unit.findUnique({ where: { code: "piece" } });
  if (!pieceUnit) throw new Error("piece unit not found");

  let created = 0, skipped = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const item = PRODUCTS[i];
    if (existingNames.has(item.name.trim())) { skipped++; continue; }
    await db.product.create({
      data: {
        sku: `IMP-${String(i + 1).padStart(3, "0")}`,
        name: item.name.trim(),
        categoryId: categoryMap.get(item.family),
        unitId: pieceUnit.id,
        active: true,
      },
    });
    created++;
  }

  const total = await db.product.count();
  console.log(`Source: ${PRODUCTS.length} | Created: ${created} | Skipped: ${skipped} | Total: ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
