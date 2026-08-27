import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";
import { sendEmail, sendWhatsApp } from "@/lib/comms/adapters";

export async function GET() {
  try {
    await requireAction("doc.send");
    const logs = await db.communicationLog.findMany({
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true, type: true } },
        order: { select: { id: true, number: true } },
        byUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ logs });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAction("doc.send");
    const body = await req.json();
    const { channel, to, subject, body: messageBody, clientId, orderId, templateName } = body as {
      channel: "EMAIL" | "WHATSAPP";
      to: string;
      subject?: string;
      body: string;
      clientId?: string;
      orderId?: string;
      templateName?: string;
    };

    if (!channel || !to || !messageBody) {
      return NextResponse.json({ error: "channel, to, and body required" }, { status: 400 });
    }

    let result;
    if (channel === "EMAIL") {
      result = await sendEmail({ to, subject: subject ?? "(առանց վերնագրի)", body: messageBody, clientId, orderId });
    } else {
      result = await sendWhatsApp({ to, body: messageBody, clientId, orderId, templateName });
    }

    // Always log the communication
    const log = await db.communicationLog.create({
      data: {
        channel,
        direction: "OUTBOUND",
        clientId: clientId ?? null,
        orderId: orderId ?? null,
        subject: subject ?? null,
        body: messageBody,
        status: result.success ? "SENT" : "FAILED",
        providerMessageId: result.messageId ?? null,
        error: result.error ?? null,
        byUserId: userId,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true, type: true } },
        byUser: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: `comms.send.${channel.toLowerCase()}`,
        entityType: "CommunicationLog",
        entityId: log.id,
        afterJson: JSON.stringify({ channel, to, status: log.status, provider: "provider" in result ? result.provider : "unknown" }),
      },
    });

    return NextResponse.json({ log, result });
  } catch (e: any) {
    if (e?.name === "NextResponse") return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
