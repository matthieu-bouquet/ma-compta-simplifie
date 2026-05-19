import { PrismaClient } from '@prisma/client'

const STANDARD_JOURNALS = [
  { code: 'AC', name: 'Achats' },
  { code: 'BQ', name: 'Banque' },
  { code: 'CA', name: 'Caisse' },
  { code: 'OD', name: 'Opérations Diverses' },
  { code: 'VE', name: 'Ventes' },
]

const prisma = new PrismaClient()

async function main() {
  for (const j of STANDARD_JOURNALS) {
    await prisma.journal.upsert({
      where: { code: j.code },
      update: { name: j.name },
      create: j,
    })
  }
}

await main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

