import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { generateQrPng } from "@/lib/docs/pdf";

export async function GET(req: Request) {
  try {
    await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");
    const { searchParams } = new URL(req.url);
    const data = searchParams.get("data") || "";
    if (!data) return NextResponse.json({ error: "data required" }, { status: 400 });
    const png = await generateQrPng(data);
    return new NextResponse(png, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
