import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireAction("admin.view_audit");
    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId") || undefined;
    const role = searchParams.get("role") || undefined;
    const query = searchParams.get("q")?.trim() || undefined;
    const logs = await db.auditLog.findMany({
      where: {
        ...(actorId ? { actorId } : {}),
        ...(role ? { actor: { role: role as any } } : {}),
        ...(query ? {
          OR: [
            { action: { contains: query, mode: "insensitive" } },
            { entityType: { contains: query, mode: "insensitive" } },
            { actor: { name: { contains: query, mode: "insensitive" } } },
            { actor: { email: { contains: query, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { at: "desc" },
      take: 100,
    });
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
