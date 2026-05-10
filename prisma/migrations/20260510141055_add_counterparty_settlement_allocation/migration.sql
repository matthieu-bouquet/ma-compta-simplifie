-- CreateTable
CREATE TABLE "CounterpartySettlementAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payableLineId" TEXT NOT NULL,
    "settlementLineId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CounterpartySettlementAllocation_payableLineId_fkey" FOREIGN KEY ("payableLineId") REFERENCES "EntryLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CounterpartySettlementAllocation_settlementLineId_fkey" FOREIGN KEY ("settlementLineId") REFERENCES "EntryLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CounterpartySettlementAllocation_payableLineId_idx" ON "CounterpartySettlementAllocation"("payableLineId");

-- CreateIndex
CREATE INDEX "CounterpartySettlementAllocation_settlementLineId_idx" ON "CounterpartySettlementAllocation"("settlementLineId");

-- CreateIndex
CREATE UNIQUE INDEX "CounterpartySettlementAllocation_payableLineId_settlementLineId_key" ON "CounterpartySettlementAllocation"("payableLineId", "settlementLineId");
