/**
 * Create or update an ADMIN user.
 *
 * Password is NEVER hardcoded. It is resolved, in priority order, from:
 *   1. ADMIN_PASSWORD environment variable
 *   2. --password=<value> CLI argument
 *   3. If neither is provided, a cryptographically secure password is generated
 *      and printed ONCE to stdout. Save it immediately; it is not stored.
 *
 * Usage:
 *   ADMIN_PASSWORD="..." npx tsx scripts/create-admin.ts
 *   npx tsx scripts/create-admin.ts --password="..."
 *   npx tsx scripts/create-admin.ts            # generates a random password
 *
 * Email/name can be overridden via ADMIN_EMAIL / ADMIN_NAME env vars.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient, UserRole } from "@prisma/client";

const db = new PrismaClient();

function readCliPassword(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--password="));
  if (!arg) return null;
  const value = arg.slice("--password=".length);
  return value.length > 0 ? value : null;
}

function generateSecurePassword(): string {
  // 24 bytes -> base64url, ~32 chars, URL-safe.
  return crypto.randomBytes(24).toString("base64url");
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@gmail.com").toLowerCase();
  const name = process.env.ADMIN_NAME ?? "Admin";
  const password = process.env.ADMIN_PASSWORD ?? readCliPassword() ?? generateSecurePassword();

  if (password.length < 8) {
    throw new Error("Admin password must be at least 8 characters. Set ADMIN_PASSWORD env var or pass --password=<value>.");
  }

  const hash = bcrypt.hashSync(password, 12);
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

  // Print the password ONCE so the operator can capture it from a secure terminal.
  // If a password was supplied via env/CLI we do NOT echo it back.
  const generated = !process.env.ADMIN_PASSWORD && !readCliPassword();
  console.log("OK:", user);
  if (generated) {
    console.log("Generated one-time password (save immediately, will not be shown again):");
    console.log(password);
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());