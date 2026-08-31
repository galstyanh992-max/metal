/**
 * Reset passwords for the 4 seed users in Supabase PostgreSQL.
 *
 * Sets:
 *   admin1@armroll.am      -> admin123
 *   admin2@armroll.am      -> admin123
 *   operator@armroll.am    -> operator123
 *   warehouse@armroll.am   -> warehouse123
 *
 * Usage:  npx tsx scripts/reset-passwords.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const targets = [
  { email: "admin1@armroll.am", password: "admin123" },
  { email: "admin2@armroll.am", password: "admin123" },
  { email: "operator@armroll.am", password: "operator123" },
  { email: "warehouse@armroll.am", password: "warehouse123" },
];

async function main() {
  for (const t of targets) {
    const hash = bcrypt.hashSync(t.password, 10);
    const r = await db.user.update({
      where: { email: t.email },
      data: { passwordHash: hash, active: true },
      select: { email: true, role: true, active: true },
    });
    console.log(`Reset ${r.email} (${r.role}) active=${r.active} -> password=${t.password}`);
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
