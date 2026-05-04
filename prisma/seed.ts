import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding journals...')
  
  const journals = [
    { code: 'BQ', name: 'Banque' },
    { code: 'AC', name: 'Achats' },
    { code: 'VE', name: 'Ventes' },
    { code: 'OD', name: 'Opérations Diverses' }
  ]

  for (const j of journals) {
    await prisma.journal.upsert({
      where: { code: j.code },
      update: {},
      create: j,
    })
  }

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
