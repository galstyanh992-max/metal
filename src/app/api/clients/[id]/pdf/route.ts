import { NextResponse } from "next/server";
import { requireAction } from "@/lib/rbac";
import { generateDebtStatementPdf } from "@/lib/docs/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role } = await requireAction("finance.view_debt");
    const { id } = await params;
    const result = await generateDebtStatementPdf(id);
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
