import { createPrismaClient } from '../src/lib/createPrismaClient'

const STANDARD_JOURNALS = [
  { code: 'AC', name: 'Achats' },
  { code: 'BQ', name: 'Banque' },
  { code: 'CA', name: 'Caisse' },
  { code: 'OD', name: 'Opérations Diverses' },
  { code: 'VE', name: 'Ventes' },
]

const prisma = createPrismaClient()

async function main() {
  for (const j of STANDARD_JOURNALS) {
    await prisma.journal.upsert({
      where: { code: j.code },
      update: { name: j.name },
      create: j,
    })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
