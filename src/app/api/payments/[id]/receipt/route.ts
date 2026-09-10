import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/rbac";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAction("finance.record_payment");
    const { id } = await params;
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
    const fileName = `${id}-${Date.now()}.${extension}`;
    const relativeUrl = `/uploads/receipts/${fileName}`;
    const destination = join(process.cwd(), "public", "uploads", "receipts");
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, fileName), Buffer.from(await receipt.arrayBuffer()));

    await db.orderPayment.update({ where: { id }, data: { receiptUrl: relativeUrl } });
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "payment.receipt_upload",
        entityType: "OrderPayment",
        entityId: id,
        afterJson: JSON.stringify({ receiptUrl: relativeUrl }),
      },
    });
    return NextResponse.json({ receiptUrl: relativeUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Չհաջողվեց կցել չեկը" }, { status: 500 });
  }
}
