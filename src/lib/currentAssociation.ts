import { prisma } from '@/lib/prisma'
import { getCurrentAssociationId } from '@/lib/associationContext'

export async function getCurrentAssociation() {
  const associationId = await getCurrentAssociationId()
  if (!associationId) return null

  return prisma.association.findUnique({
    where: { id: associationId },
    select: {
      id: true,
      name: true,
      isClosed: true,
      legalFormCode: true,
      legalFormOther: true,
    },
  })
}

