-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Counterparty_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "counterpartyId" TEXT,
    "referenceNumber" TEXT,
    "referenceSequence" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Entry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Entry_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Entry" ("createdAt", "date", "description", "fiscalYearId", "id", "journalId", "referenceNumber", "referenceSequence", "updatedAt") SELECT "createdAt", "date", "description", "fiscalYearId", "id", "journalId", "referenceNumber", "referenceSequence", "updatedAt" FROM "Entry";
DROP TABLE "Entry";
ALTER TABLE "new_Entry" RENAME TO "Entry";
CREATE INDEX "Entry_fiscalYearId_journalId_date_idx" ON "Entry"("fiscalYearId", "journalId", "date");
CREATE INDEX "Entry_counterpartyId_idx" ON "Entry"("counterpartyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Counterparty_associationId_kind_idx" ON "Counterparty"("associationId", "kind");
