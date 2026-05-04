import { Prisma, PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const prismaLog: Prisma.LogLevel[] = process.env.NODE_ENV === 'development' ? ['query'] : []

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: prismaLog,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
