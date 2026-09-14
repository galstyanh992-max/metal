/**
 * Reset passwords for the seed users in Supabase PostgreSQL.
 *
 * Passwords are NEVER hardcoded. They are resolved, in priority order, from:
 *   1. Per-user environment variables: ADMIN_PASSWORD, OPERATOR_PASSWORD, WAREHOUSE_PASSWORD
 *   2. A single RESET_PASSWORD env var applied to all targets
 *   3. If none provided, a cryptographically secure password is generated PER USER
 *      and printed ONCE to stdout. Save them immediately.
 *
 * Usage:
 *   ADMIN_PASSWORD="..." OPERATOR_PASSWORD="..." WAREHOUSE_PASSWORD="..." npx tsx scripts/reset-passwords.ts
 *   RESET_PASSWORD="..." npx tsx scripts/reset-passwords.ts
 *   npx tsx scripts/reset-passwords.ts            # generates random passwords
 *
 * Target emails can be overridden via ADMIN1_EMAIL / ADMIN2_EMAIL / OPERATOR_EMAIL / WAREHOUSE_EMAIL env vars.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function generateSecurePassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

interface Target {
  envKey: string;
  email: string;
}

const targets: Target[] = [
  { envKey: "ADMIN_PASSWORD", email: (process.env.ADMIN1_EMAIL ?? "admin1@armroll.am").toLowerCase() },
  { envKey: "ADMIN_PASSWORD", email: (process.env.ADMIN2_EMAIL ?? "admin2@armroll.am").toLowerCase() },
  { envKey: "OPERATOR_PASSWORD", email: (process.env.OPERATOR_EMAIL ?? "operator@armroll.am").toLowerCase() },
  { envKey: "WAREHOUSE_PASSWORD", email: (process.env.WAREHOUSE_EMAIL ?? "warehouse@armroll.am").toLowerCase() },
];

async function main() {
  const generated: Array<{ email: string; password: string }> = [];

  for (const t of targets) {
    const password = process.env[t.envKey] ?? process.env.RESET_PASSWORD ?? generateSecurePassword();
    if (password.length < 8) {
      throw new Error(`Password for ${t.email} must be at least 8 characters. Set ${t.envKey} or RESET_PASSWORD env var.`);
    }
    const hash = bcrypt.hashSync(password, 12);
    const r = await db.user.update({
      where: { email: t.email },
      data: { passwordHash: hash, active: true, sessionVersion: { increment: 1 } },
      select: { email: true, role: true, active: true },
    });
    const wasGenerated = !process.env[t.envKey] && !process.env.RESET_PASSWORD;
    if (wasGenerated) generated.push({ email: r.email, password });
    console.log(`Reset ${r.email} (${r.role}) active=${r.active}`);
  }

  if (generated.length > 0) {
    console.log("\nGenerated one-time passwords (save immediately, will not be shown again):");
    for (const g of generated) {
      console.log(`  ${g.email} -> ${g.password}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());