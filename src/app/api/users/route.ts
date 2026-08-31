import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import bcrypt from "bcryptjs";

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

/**
 * PATCH /api/users — update a user's email and/or password.
 * Body: { userId, email?, password?, name?, active? }
 *
 * Only ADMIN can call. Cannot change own role.
 */
export async function PATCH(req: Request) {
  try {
    const { userId: actorId } = await requireAction("admin.manage_users");
    const body = await req.json();
    const { userId, email, password, name, active } = body as {
      userId: string;
      email?: string;
      password?: string;
      name?: string;
      active?: boolean;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const patch: any = {};
    if (typeof email === "string" && email.trim() && email !== existing.email) {
      // Check uniqueness
      const taken = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (taken && taken.id !== userId) {
        return NextResponse.json({ error: `«${email}» էլ․ հասցեն արդեն օգտագործվում է` }, { status: 409 });
      }
      patch.email = email.trim().toLowerCase();
    }
    if (typeof password === "string" && password.length >= 4) {
      patch.passwordHash = bcrypt.hashSync(password, 10);
    }
    if (typeof name === "string" && name.trim()) {
      patch.name = name.trim();
    }
    if (typeof active === "boolean") {
      patch.active = active;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ user: existing, changed: false });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: patch,
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        actorId,
        action: "user.update",
        entityType: "User",
        entityId: userId,
        beforeJson: JSON.stringify({
          email: existing.email,
          name: existing.name,
          active: existing.active,
        }),
        afterJson: JSON.stringify({
          email: updated.email,
          name: updated.name,
          active: updated.active,
          passwordChanged: !!patch.passwordHash,
        }),
      },
    });

    return NextResponse.json({ user: updated, changed: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
