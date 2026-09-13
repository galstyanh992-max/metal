/**
 * Create or update an ADMIN user.
 *   email:    Admin@gmail.com
 *   password: Admin123
 *
 * Usage:  npx tsx scripts/create-admin.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const db = new PrismaClient();

const email = "admin@gmail.com";
const password = "Admin123";
const name = "Admin";

async function main() {
  const hash = bcrypt.hashSync(password, 10);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash: hash, role: UserRole.ADMIN, active: true, name },
    create: {
      email,
      name,
      role: UserRole.ADMIN,
      passwordHash: hash,
      active: true,
    },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  console.log("OK:", user);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());