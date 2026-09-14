import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { answerQuestion } from "@/lib/assistant/engine";

/**
 * POST /api/assistant — project assistant chat.
 * Answers in Armenian, grounded in live Supabase data.
 * All queries are scoped by the caller's role (see engine.ts).
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireRole("ADMIN", "OPERATOR", "WAREHOUSE");
    const { question } = await req.json() as { question: string };

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const reply = await answerQuestion(question.trim(), ctx);
    return NextResponse.json({ reply: reply.text, data: reply.data ?? null });
  } catch (e: any) {
    if (e instanceof NextResponse) return e;
    console.error("assistant error:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: e?.status ?? 500 });
  }
}
