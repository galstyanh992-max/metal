import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction, requireRole } from "@/lib/rbac";
import { parseLoyaltyThreshold } from "@/lib/loyalty/threshold";

export async function GET() {
  try {
    await requireAction("finance.manage_loyalty");
    const [tiers, overrides] = await Promise.all([
      db.loyaltyTier.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { clients: true } } } }),
      db.loyaltyOverride.findMany({ include: { client: true, byUser: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({ tiers, overrides });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireRole("ADMIN");
    const body = await request.json().catch(() => null);
    const tierId = typeof body?.tierId === "string" ? body.tierId : "";
    const thresholdTurnover = parseLoyaltyThreshold(body?.thresholdTurnover);
    if (!tierId || thresholdTurnover === null) {
      return NextResponse.json({ error: "Շեմը պետք է լինի ամբողջ, ոչ բացասական թիվ՝ մինչև 2 000 000 000 դր։" }, { status: 400 });
    }
    const tier = await db.$transaction(async (tx) => {
      const before = await tx.loyaltyTier.findUnique({ where: { id: tierId } });
      if (!before) return null;
      const updated = await tx.loyaltyTier.update({ where: { id: tierId }, data: { thresholdTurnover } });
      await tx.auditLog.create({
        data: {
          actorId: userId, action: "loyalty.threshold.update", entityType: "LoyaltyTier", entityId: tierId,
          beforeJson: JSON.stringify({ thresholdTurnover: before.thresholdTurnover }),
          afterJson: JSON.stringify({ thresholdTurnover }),
        },
      });
      return updated;
    });
    if (!tier) return NextResponse.json({ error: "Մակարդակը չի գտնվել" }, { status: 404 });
    return NextResponse.json({ tier });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Loyalty threshold update failed", error);
    return NextResponse.json({ error: "Չհաջողվեց պահպանել շեմը։ Փորձեք կրկին։" }, { status: 500 });
  }
}
