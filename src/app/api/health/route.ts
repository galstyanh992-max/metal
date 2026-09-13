import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDatabaseConnectionMetadata } from "@/lib/database-url"

export const runtime = "nodejs"

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1***@")
}

export async function GET() {
  const startedAt = Date.now()

  try {
    await db.$queryRaw`SELECT 1`

    return NextResponse.json({
      ok: true,
      database: "ok",
      latencyMs: Date.now() - startedAt,
      connection: getDatabaseConnectionMetadata(),
    })
  } catch (error) {
    console.error("Database health check failed", error)

    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        latencyMs: Date.now() - startedAt,
        connection: getDatabaseConnectionMetadata(),
        error: sanitizeError(error),
      },
      { status: 503 },
    )
  }
}
