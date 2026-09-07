/**
 * Seed 4 default branches for Arm Roll ERP.
 *
 * Usage:  npx tsx scripts/seed-branches.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BRANCHES = [
  { code: "main", name: "Գլխավոր պահեստ", address: "Երևան, գլխավոր գրասենյակ", phone: "+374 10 555 555", sortOrder: 0 },
  { code: "branch-2", name: "Ֆիլիալ 2 — Մալաթիա", address: "Երևան, Մալաթիա-Սեբաստիա", phone: "+374 10 555 556", sortOrder: 1 },
  { code: "branch-3", name: "Ֆիլիալ 3 — Արաբկիր", address: "Երևան, Արաբկիր", phone: "+374 10 555 557", sortOrder: 2 },
  { code: "branch-4", name: "Ֆիլիալ 4 — Էրեբունի", address: "Երևան, Էրեբունի", phone: "+374 10 555 558", sortOrder: 3 },
];

async function main() {
  for (const b of BRANCHES) {
    const existing = await db.branch.findUnique({ where: { code: b.code } });
    if (existing) {
      await db.branch.update({
        where: { id: existing.id },
        data: { name: b.name, address: b.address, phone: b.phone, sortOrder: b.sortOrder, active: true },
      });
      console.log(`✓ Updated existing: ${b.code} — ${b.name}`);
    } else {
      await db.branch.create({ data: b });
      console.log(`+ Created: ${b.code} — ${b.name}`);
    }
  }
  const count = await db.branch.count();
  console.log(`\n=== Total branches: ${count} ===`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
