import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client with optimized connection pool settings for Supabase.
 *
 * - connection_limit: 10 (Supabase session pooler max is 15 — keep headroom)
 * - pool_timeout: 10s (fail fast)
 * - log: only errors/warnings
 */
const isProd = process.env.NODE_ENV === 'production'

function buildDatabaseUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return undefined
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=10&pool_timeout=10`
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
