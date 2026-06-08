-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringExpenseTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "amountCents" INTEGER,
    "counterpartyId" TEXT,
    "operationAccountNumber" TEXT NOT NULL,
    "treasuryAccountNumber" TEXT,
    "packCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpenseTemplate_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpenseTemplate_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RecurringExpenseTemplate" ("amountCents", "associationId", "counterpartyId", "createdAt", "id", "operationAccountNumber", "operationType", "title", "treasuryAccountNumber", "updatedAt") SELECT "amountCents", "associationId", "counterpartyId", "createdAt", "id", "operationAccountNumber", "operationType", "title", "treasuryAccountNumber", "updatedAt" FROM "RecurringExpenseTemplate";
DROP TABLE "RecurringExpenseTemplate";
ALTER TABLE "new_RecurringExpenseTemplate" RENAME TO "RecurringExpenseTemplate";
CREATE INDEX "RecurringExpenseTemplate_associationId_title_idx" ON "RecurringExpenseTemplate"("associationId", "title");
CREATE UNIQUE INDEX "RecurringExpenseTemplate_associationId_title_operationType_key" ON "RecurringExpenseTemplate"("associationId", "title", "operationType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
