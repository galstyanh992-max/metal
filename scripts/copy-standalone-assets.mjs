// Cross-platform asset copier for the Next.js standalone build output.
// Replaces the previous `cp -r ...` shell snippet that was Windows-incompatible.
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const nextDir = join(process.cwd(), ".next");
const standaloneDir = join(nextDir, "standalone");
const publicDir = join(process.cwd(), "public");

async function main() {
  if (!existsSync(standaloneDir)) {
    console.error("[copy-standalone-assets] standalone dir not found:", standaloneDir);
    process.exit(1);
  }
  // Copy .next/static into standalone/.next/static
  const staticSrc = join(nextDir, "static");
  const staticDst = join(standaloneDir, ".next", "static");
  if (existsSync(staticSrc)) {
    await mkdir(join(standaloneDir, ".next"), { recursive: true });
    await cp(staticSrc, staticDst, { recursive: true });
    console.log("[copy-standalone-assets] copied .next/static ->", staticDst);
  }
  // Copy public/ into standalone/public
  if (existsSync(publicDir)) {
    await cp(publicDir, join(standaloneDir, "public"), { recursive: true });
    console.log("[copy-standalone-assets] copied public/ ->", join(standaloneDir, "public"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});