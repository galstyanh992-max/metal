import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const userId = (session.user as any).id;

    // Get unread notifications for this user + global notifications
    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { userId, readAt: null },
          { userId: null, readAt: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ notifications });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const userId = (session.user as any).id;
    const body = await req.json();
    const { action, notificationId } = body;

    if (action === "mark_read" && notificationId) {
      await db.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "mark_all_read") {
      await db.notification.updateMany({
        where: { OR: [{ userId }, { userId: null }], readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
