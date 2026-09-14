import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, canAccessPayment } from "@/lib/authz";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * GET /api/payments/[id]/receipt/file — download the payment receipt.
 *
 * SECURITY: This route is authenticated and performs object-level
 * authorization (canAccessPayment). The file is read from a PRIVATE directory
 * (var/uploads/receipts) and streamed back — it is never served from public/.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("finance.view_payments");
    const { id } = await params;

    const allowed = await canAccessPayment(ctx, id);
    if (!allowed) return NextResponse.json({ error: "not found" }, { status: 404 });

    const payment = await db.orderPayment.findUnique({ where: { id }, select: { id: true, receiptUrl: true } });
    if (!payment || !payment.receiptUrl) {
      return NextResponse.json({ error: "Չեկ չի գտնվել" }, { status: 404 });
    }

    // The receiptUrl is the canonical reference; the actual file lives in
    // var/uploads/receipts with a server-generated name. We find it by the
    // payment id prefix (files are named `${id}-<random>.<ext>`).
    const privateRoot = join(process.cwd(), "var", "uploads", "receipts");
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(privateRoot);
    const match = files.find((f) => f.startsWith(`${id}-`));
    if (!match) return NextResponse.json({ error: "Չեկի ֆայլը չի գտնվել" }, { status: 404 });

    const ext = match.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME[ext] ?? "application/octet-stream";
    const buf = await readFile(join(privateRoot, match));

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="receipt-${id}.${ext}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: e?.status ?? 500 });
  }
}