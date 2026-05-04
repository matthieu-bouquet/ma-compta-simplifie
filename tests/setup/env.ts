import path from 'node:path'

// Unit tests should never touch dev.db
process.env.DATABASE_URL =
  process.env.DATABASE_URL || `file:${path.join(process.cwd(), '.tmp', 'unit.db')}`
process.env.DOCUMENTS_DIR = process.env.DOCUMENTS_DIR || path.join(process.cwd(), '.tmp', 'documents')

