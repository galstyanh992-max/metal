import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client — single instance, minimal config.
 * Connection limit kept low to avoid Supabase pool exhaustion.
 */
const isProd = process.env.NODE_ENV === 'production'

function buildDatabaseUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL?.trim()
  if (!baseUrl) return undefined
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=3&pool_timeout=10`
}

const databaseUrl = buildDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    // Omit the override when unset; Prisma rejects an explicit undefined URL.
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  })

if (!isProd) globalForPrisma.prisma = db
