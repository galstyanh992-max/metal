import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const capturedAt = new Date().toISOString();
  const logs = await db.auditLog.findMany({ orderBy: { at: "asc" } });
  const backupDirectory = join(process.cwd(), "backups");
  await mkdir(backupDirectory, { recursive: true });
  const filePath = join(backupDirectory, `audit-logs-before-clear-${capturedAt.replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, JSON.stringify({ version: 1, capturedAt, logs }, null, 2), "utf8");

  const deleted = await db.auditLog.deleteMany();
  console.log(JSON.stringify({ filePath, deleted: deleted.count, remaining: await db.auditLog.count() }));
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
