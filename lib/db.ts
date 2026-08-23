import { PrismaClient, Prisma } from '@prisma/client'

/**
 * PrismaClient singleton for AppFoundry
 *
 * Ensures only one instance of PrismaClient exists across the application,
 * which is critical for connection pool management, especially in serverless
 * or development environments with hot reloading.
 *
 * In development, the global object preserves the PrismaClient instance across
 * hot reloads. In production, a new instance is created once.
 *
 * @see https://www.prisma.io/docs/orm/more/help-center/help-articles/nextjs-prisma-client-instantiation-issue
 */

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Initialize or retrieve the Prisma Client instance
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Detailed logging in development; minimal in production
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // Optional: Configure connection pool for production
    ...(process.env.NODE_ENV === 'production' && {
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    }),
  })

// Preserve the Prisma instance in global scope during development
// to avoid connection pool exhaustion on hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Graceful shutdown: disconnect on process termination
 */
async function disconnectPrisma() {
  await prisma.$disconnect()
}

// Handle process termination signals
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await disconnectPrisma()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await disconnectPrisma()
    process.exit(0)
  })
}

/**
 * Optional: Add middleware for query logging and performance monitoring
 *
 * Uncomment to enable detailed query tracking during development
 */
if (process.env.NODE_ENV === 'development') {
  prisma.$use(async (params, next) => {
    const before = Date.now()
    try {
      const result = await next(params)
      const duration = Date.now() - before
      if (duration > 100) {
        // Log slow queries (>100ms)
        console.warn(
          `[SLOW QUERY] ${params.model}.${params.action} took ${duration}ms`,
        )
      }
      return result
    } catch (error) {
      console.error(`[QUERY ERROR] ${params.model}.${params.action}`, error)
      throw error
    }
  })
}

/**
 * Type helpers for transaction contexts
 *
 * Use `TransactionClient` for functions that accept a Prisma client
 * during transactions, ensuring type safety and IDE autocomplete.
 *
 * @example
 * async function updateProjectStatus(
 *   projectId: string,
 *   tx: TransactionClient,
 * ) {
 *   return tx.project.update({ where: { id: projectId }, ... })
 * }
 *
 * // Use in a transaction:
 * await prisma.$transaction(async (tx) => {
 *   await updateProjectStatus(id, tx as TransactionClient)
 * })
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$transaction' | '$use' | '$executeRaw' | '$queryRaw'
>

// Re-export Prisma types for convenience
export type { Prisma }

// Export commonly used model types for convenience
export type {
  Project,
  GenerationRun,
  GenerationStep,
  GeneratedFile,
} from '@prisma/client'
