import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

export async function GET() {
  try {
    await requireAction("admin.manage_users");
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}
