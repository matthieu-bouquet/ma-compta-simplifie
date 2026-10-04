-- AlterTable
ALTER TABLE "Association" ADD COLUMN "rna" TEXT;
ALTER TABLE "Association" ADD COLUMN "socialObject" TEXT;
ALTER TABLE "Association" ADD COLUMN "receiptSignatoryName" TEXT;
ALTER TABLE "Association" ADD COLUMN "receiptSignatoryRole" TEXT;
ALTER TABLE "Association" ADD COLUMN "taxReceiptEligibilityAttested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MembershipCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "duesAccountNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipCategory_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "licenseNumber" TEXT,
    "notes" TEXT,
    "categoryId" TEXT,
    "counterpartyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Member_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MembershipCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Member_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Counterparty" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MembershipFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "duesAccountNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" DATETIME,
    "treasuryAccountNumber" TEXT,
    "entryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipFee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipFee_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorAddress" TEXT,
    "donorPostalCode" TEXT,
    "donorCity" TEXT,
    "donorEmail" TEXT,
    "amountCents" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "treasuryAccountNumber" TEXT NOT NULL,
    "eligibilityAttested" BOOLEAN NOT NULL DEFAULT false,
    "entryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Donation_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Donation_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxReceiptSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxReceiptSequence_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "pdfDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxReceipt_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxReceipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MembershipCategory_associationId_name_key" ON "MembershipCategory"("associationId", "name");
CREATE INDEX "MembershipCategory_associationId_idx" ON "MembershipCategory"("associationId");
CREATE INDEX "Member_associationId_lastName_idx" ON "Member"("associationId", "lastName");
CREATE INDEX "Member_categoryId_idx" ON "Member"("categoryId");
CREATE INDEX "Member_counterpartyId_idx" ON "Member"("counterpartyId");
CREATE UNIQUE INDEX "MembershipFee_entryId_key" ON "MembershipFee"("entryId");
CREATE UNIQUE INDEX "MembershipFee_memberId_fiscalYearId_key" ON "MembershipFee"("memberId", "fiscalYearId");
CREATE INDEX "MembershipFee_associationId_fiscalYearId_status_idx" ON "MembershipFee"("associationId", "fiscalYearId", "status");
CREATE INDEX "MembershipFee_fiscalYearId_idx" ON "MembershipFee"("fiscalYearId");
CREATE UNIQUE INDEX "Donation_entryId_key" ON "Donation"("entryId");
CREATE INDEX "Donation_associationId_date_idx" ON "Donation"("associationId", "date");
CREATE INDEX "Donation_fiscalYearId_date_idx" ON "Donation"("fiscalYearId", "date");
CREATE UNIQUE INDEX "TaxReceiptSequence_associationId_calendarYear_key" ON "TaxReceiptSequence"("associationId", "calendarYear");
CREATE UNIQUE INDEX "TaxReceipt_donationId_key" ON "TaxReceipt"("donationId");
CREATE UNIQUE INDEX "TaxReceipt_associationId_calendarYear_sequence_key" ON "TaxReceipt"("associationId", "calendarYear", "sequence");
CREATE INDEX "TaxReceipt_associationId_issuedAt_idx" ON "TaxReceipt"("associationId", "issuedAt");
