import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await requireAction("admin.manage_users");
    const users = await db.user.findMany({
      where: { archivedAt: null },
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

/** DELETE /api/users — archive an account while retaining the activity history. */
export async function DELETE(req: Request) {
  try {
    const { userId: actorId } = await requireAction("admin.manage_users");
    const { userId } = await req.json() as { userId?: string };
    if (!userId) return NextResponse.json({ error: "Ընտրեք օգտատիրոջը" }, { status: 400 });
    if (userId === actorId) return NextResponse.json({ error: "Դուք չեք կարող հեռացնել ձեր սեփական հաշիվը" }, { status: 400 });

    const user = await db.user.findFirst({ where: { id: userId, archivedAt: null } });
    if (!user) return NextResponse.json({ error: "Օգտատերը չի գտնվել" }, { status: 404 });
    if (user.role === "ADMIN" && user.active) {
      const activeAdminCount = await db.user.count({ where: { role: "ADMIN", active: true, archivedAt: null } });
      if (activeAdminCount <= 1) {
        return NextResponse.json({ error: "Չի կարելի հեռացնել վերջին ակտիվ ադմինիստրատորին" }, { status: 400 });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active: false, archivedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "user.archive",
          entityType: "User",
          entityId: userId,
          beforeJson: JSON.stringify({ name: user.name, email: user.email, role: user.role }),
        },
      });
    });
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Չհաջողվեց հեռացնել օգտատիրոջը" }, { status: 500 });
  }
}

/** POST /api/users — create an account for an administrator, operator, or warehouse worker. */
export async function POST(req: Request) {
  try {
    const { userId: actorId } = await requireAction("admin.manage_users");
    const body = await req.json();
    const { name, email, password, role } = body as { name?: string; email?: string; password?: string; role?: string };

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return NextResponse.json({ error: "Լրացրեք անունը, էլ․ հասցեն, գաղտնաբառը և դերը" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Նշեք ճիշտ էլ․ հասցե" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Գաղտնաբառը պետք է ունենա առնվազն 8 նիշ" }, { status: 400 });
    }
    if (!(["ADMIN", "OPERATOR", "WAREHOUSE"] as const).includes(role as any)) {
      return NextResponse.json({ error: "Դերը սխալ է" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const taken = await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "Այս էլ․ հասցեն արդեն օգտագործվում է" }, { status: 409 });

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: role as any,
        active: true,
      },
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    });
    await db.auditLog.create({
      data: {
        actorId,
        action: "user.create",
        entityType: "User",
        entityId: user.id,
        afterJson: JSON.stringify({ name: user.name, email: user.email, role: user.role }),
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Չհաջողվեց ստեղծել օգտատերը" }, { status: 500 });
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
