-- CreateTable
CREATE TABLE "RecurringExpenseTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "counterpartyId" TEXT,
    "operationAccountNumber" TEXT NOT NULL,
    "treasuryAccountNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpenseTemplate_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpenseTemplate_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecurringExpenseTemplate_associationId_title_idx" ON "RecurringExpenseTemplate"("associationId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringExpenseTemplate_associationId_title_operationType_key" ON "RecurringExpenseTemplate"("associationId", "title", "operationType");
