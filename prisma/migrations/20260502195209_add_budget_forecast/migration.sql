-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "sourceFiscalYearId" TEXT,
    "sourceCoefficientPercent" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Budget_associationId_updatedAt_idx" ON "Budget"("associationId", "updatedAt");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetId_accountNumber_key" ON "BudgetLine"("budgetId", "accountNumber");
