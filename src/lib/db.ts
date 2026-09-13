import { PrismaClient } from '@prisma/client'
import { normalizeDatabaseUrl } from './database-url'

const isProd = process.env.NODE_ENV === 'production'
const retryDelaysMs = [250, 750, 1500]
const retryableCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function isRetryableDatabaseError(error: unknown): boolean {
  const code = getErrorCode(error)
  if (code && retryableCodes.has(code)) return true

  const message = error instanceof Error ? error.message : String(error)
  return /Can't reach database server|Timed out fetching a new connection|Server has closed the connection|Connection terminated/i.test(message)
}

async function withDatabaseRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= retryDelaysMs.length || !isRetryableDatabaseError(error)) throw error
      await sleep(retryDelaysMs[attempt])
    }
  }
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = normalizeDatabaseUrl()

  const client = new PrismaClient({
    log: ['error'],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return withDatabaseRetry(() => query(args))
        },
      },
    },
  })

  return client as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (!isProd) globalForPrisma.prisma = db
