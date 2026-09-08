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
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return undefined
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}connection_limit=3&pool_timeout=10`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: buildDatabaseUrl(),
      },
    },
  })

if (!isProd) globalForPrisma.prisma = db
