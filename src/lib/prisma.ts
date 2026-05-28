// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Ma Compta Simplifié

import { Prisma } from '@/generated/prisma/client'
import { createPrismaClient } from '@/lib/createPrismaClient'

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof createPrismaClient> }

const prismaLog: Prisma.LogLevel[] = process.env.NODE_ENV === 'development' ? ['query'] : []

export const prisma = globalForPrisma.prisma ?? createPrismaClient({ log: prismaLog })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
