import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Fallback for `prisma generate` during postinstall/CI when `.env` is absent.
const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
})
