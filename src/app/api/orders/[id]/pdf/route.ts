import { NextResponse } from "next/server";
import { requireAction } from "@/lib/rbac";
import { generateOrderPdf } from "@/lib/docs/pdf";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role, userId } = await requireAction("doc.generate");
    const { id } = await params;
    const { searchParams } = new URL(_req.url);
    const type = (searchParams.get("type") || "CUSTOMER_ORDER") as any;

    const result = await generateOrderPdf(id, type, role);

    // Save generated document record
    await db.generatedDocument.create({
      data: {
        templateId: "template-" + type.toLowerCase(),
        templateVersion: 1,
        type: type,
        entityType: "ORDER",
        entityId: id,
        url: `/api/orders/${id}/pdf?type=${type}`,
        generatedById: userId,
      },
    }).catch(() => null);

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
