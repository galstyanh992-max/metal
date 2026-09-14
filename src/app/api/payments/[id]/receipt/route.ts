import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, canAccessPayment } from "@/lib/authz";
import crypto from "node:crypto";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * POST /api/payments/[id]/receipt — upload a payment receipt.
 *
 * SECURITY: Receipts are stored in a PRIVATE directory (var/uploads/receipts),
 * NOT under public/. They are served only via the authenticated download route
 * which checks object-level authorization (canAccessPayment).
 *
 * Filenames are generated server-side (random) — never derived from the
 * client-supplied filename, to prevent path traversal and collision attacks.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("finance.record_payment");
    const { id } = await params;

    const allowed = await canAccessPayment(ctx, id);
    if (!allowed) return NextResponse.json({ error: "Վճարումը չի գտնվել" }, { status: 404 });

    const payment = await db.orderPayment.findUnique({ where: { id }, select: { id: true } });
    if (!payment) return NextResponse.json({ error: "Վճարումը չի գտնվել" }, { status: 404 });

    const formData = await req.formData();
    const receipt = formData.get("receipt");
    if (!(receipt instanceof File)) {
      return NextResponse.json({ error: "Կցեք չեկի ֆայլը" }, { status: 400 });
    }
    if (!EXTENSIONS[receipt.type]) {
      return NextResponse.json({ error: "Թույլատրվում են միայն PDF, JPG, PNG կամ WEBP ֆայլեր" }, { status: 400 });
    }
    if (receipt.size === 0 || receipt.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json({ error: "Ֆայլի առավելագույն չափը 10 ՄԲ է" }, { status: 400 });
    }

    const extension = EXTENSIONS[receipt.type];
    const random = crypto.randomBytes(16).toString("hex");
    const fileName = `${id}-${random}.${extension}`;
    const privateRoot = join(process.cwd(), "var", "uploads", "receipts");
    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(privateRoot, fileName), Buffer.from(await receipt.arrayBuffer()));

    const receiptRef = `/api/payments/${id}/receipt/file`;
    await db.orderPayment.update({ where: { id }, data: { receiptUrl: receiptRef } });
    await db.auditLog.create({
      data: {
        actorId: ctx.userId,
        action: "payment.receipt_upload",
        entityType: "OrderPayment",
        entityId: id,
        afterJson: JSON.stringify({ receiptUrl: receiptRef, storedFile: `<REDACTED>` }),
      },
    });
    return NextResponse.json({ receiptUrl: receiptRef });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error?.message ?? "Չհաջողվեց կցել չեկը" }, { status: error?.status ?? 500 });
  }
}