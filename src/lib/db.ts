import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client with optimized connection pool settings for Supabase.
 *
 * - connection_limit: 5 (Supabase session pooler max is 15 — keep headroom)
 * - pool_timeout: 20s (fail fast instead of hanging)
 * - log: only errors/warnings in production
 *
 * Reuses the same client across hot-reloads in dev to prevent pool exhaustion.
 */
const isProd = process.env.NODE_ENV === 'production'

function buildDatabaseUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return undefined
  // Prisma expects ? for query params. Our Supabase URL has no query string,
  // so we need to add ?connection_limit=... not &connection_limit=...
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=5&pool_timeout=20`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: buildDatabaseUrl(),
      },
    },
  })

if (!isProd) globalForPrisma.prisma = db
