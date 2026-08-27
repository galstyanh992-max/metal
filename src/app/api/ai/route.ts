import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { generateProposal } from "@/lib/ai/provider";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId } = await requireRole("ADMIN", "OPERATOR");
    const { module, prompt, context, tier } = await req.json() as {
      module: string;
      prompt: string;
      context?: Record<string, any>;
      tier?: "fast" | "reasoning";
    };

    const proposal = await generateProposal({ module, prompt, context, tier });

    // Persist proposal
    const saved = await db.aiProposal.create({
      data: {
        module: module as any,
        inputJson: JSON.stringify(proposal.input),
        outputJson: JSON.stringify(proposal.output),
        modelUsed: proposal.model,
        status: proposal.status === "REJECTED_BY_GUARDRAIL" ? "REJECTED_BY_GUARDRAIL" : "PENDING",
        rejectedReason: proposal.reason,
      },
    });

    return NextResponse.json({ proposal, id: saved.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
