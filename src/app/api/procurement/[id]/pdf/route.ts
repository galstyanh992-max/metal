import { NextResponse } from "next/server";
import { requireAction } from "@/lib/rbac";
import { generateProcurementPdf } from "@/lib/docs/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAction("procurement.view_purchase_history");
    const { id } = await params;
    const result = await generateProcurementPdf(id);
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
