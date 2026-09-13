type PoolerMode = "session" | "transaction"

const SUPABASE_POOLER_SUFFIX = ".pooler.supabase.com"

function isSupabasePooler(hostname: string): boolean {
  return hostname.endsWith(SUPABASE_POOLER_SUFFIX)
}

function resolvePoolerMode(hostname: string): PoolerMode | undefined {
  const configured = process.env.SUPABASE_POOLER_MODE?.trim().toLowerCase()
  if (configured === "session" || configured === "transaction") return configured
  return isSupabasePooler(hostname) ? "transaction" : undefined
}

function setIfMissing(params: URLSearchParams, key: string, value: string) {
  if (!params.has(key)) params.set(key, value)
}

export function normalizeDatabaseUrl(rawUrl = process.env.DATABASE_URL?.trim()): string | undefined {
  if (!rawUrl) return undefined

  const url = new URL(rawUrl)
  const poolerMode = resolvePoolerMode(url.hostname)

  if (poolerMode === "transaction") {
    url.port = "6543"
    url.searchParams.set("pgbouncer", "true")
    url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? "1")
  } else {
    setIfMissing(url.searchParams, "connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? "3")
  }

  setIfMissing(url.searchParams, "pool_timeout", process.env.PRISMA_POOL_TIMEOUT ?? "30")
  setIfMissing(url.searchParams, "connect_timeout", process.env.PRISMA_CONNECT_TIMEOUT ?? "30")
  setIfMissing(url.searchParams, "sslmode", "require")

  return url.toString()
}

export function getDatabaseConnectionMetadata() {
  const rawUrl = process.env.DATABASE_URL?.trim()
  if (!rawUrl) return { configured: false as const }

  const url = new URL(rawUrl)
  const normalized = new URL(normalizeDatabaseUrl(rawUrl) ?? rawUrl)

  return {
    configured: true as const,
    host: normalized.hostname,
    originalPort: url.port || (url.protocol === "postgresql:" ? "5432" : ""),
    port: normalized.port,
    poolerMode: resolvePoolerMode(url.hostname) ?? "custom",
    sslmode: normalized.searchParams.get("sslmode"),
  }
}
