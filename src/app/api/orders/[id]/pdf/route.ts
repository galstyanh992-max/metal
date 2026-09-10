import { NextResponse } from "next/server";
import { requireAction } from "@/lib/rbac";
import { generateOrderPdf } from "@/lib/docs/pdf";
import { db } from "@/lib/db";

const ORDER_PDF_TYPES = new Set([
  "CUSTOMER_ORDER",
  "WAREHOUSE_ORDER",
  "INVOICE",
  "PAYMENT_RECEIPT",
  "DELIVERY_NOTE",
  "PROCUREMENT_DOCUMENT",
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role, userId } = await requireAction("doc.generate");
    const { id } = await params;
    const { searchParams } = new URL(_req.url);
    const type = (searchParams.get("type") || "CUSTOMER_ORDER") as any;
    if (!ORDER_PDF_TYPES.has(type)) {
      return NextResponse.json({ error: "Փաստաթղթի տեսակը սխալ է" }, { status: 400 });
    }

    const result = await generateOrderPdf(id, type, role);

    // Save generated document record
    const existing = await db.generatedDocument.findFirst({
      where: { entityType: "ORDER", entityId: id, type },
      select: { id: true },
    });
    if (!existing) {
      await db.generatedDocument.create({
        data: {
          templateId: "template-" + type.toLowerCase(),
          templateVersion: 1,
          type,
          entityType: "ORDER",
          entityId: id,
          url: `/api/orders/${id}/pdf?type=${type}`,
          generatedById: userId,
        },
      });
    }
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "document.download",
        entityType: "Order",
        entityId: id,
        afterJson: JSON.stringify({ type }),
      },
    });

    return new NextResponse(result.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
