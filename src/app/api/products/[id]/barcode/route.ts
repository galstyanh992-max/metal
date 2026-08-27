import { NextResponse } from "next/server";
import { requireAction } from "@/lib/rbac";
import { generateBarcodePng } from "@/lib/docs/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAction("product.list");
    const { id } = await params;
    const png = await generateBarcodePng(id);
    return new NextResponse(png, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
