import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { answerQuestion } from "@/lib/assistant/engine";

/**
 * POST /api/assistant — project assistant chat.
 * Answers in Armenian, grounded in live Supabase data.
 */
export async function POST(req: Request) {
  try {
    await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");
    const { question } = await req.json() as { question: string };

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const reply = await answerQuestion(question.trim());
    return NextResponse.json({ reply: reply.text, data: reply.data ?? null });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    console.error("assistant error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
