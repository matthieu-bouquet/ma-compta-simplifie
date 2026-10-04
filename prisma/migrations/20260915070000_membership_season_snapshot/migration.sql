-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MembershipFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "categoryId" TEXT,
    "snapshotFirstName" TEXT NOT NULL,
    "snapshotLastName" TEXT NOT NULL,
    "snapshotEmail" TEXT,
    "snapshotPhone" TEXT,
    "snapshotAddress" TEXT,
    "snapshotPostalCode" TEXT,
    "snapshotCity" TEXT,
    "snapshotLicenseNumber" TEXT,
    "imageRightsConsent" BOOLEAN NOT NULL DEFAULT false,
    "internalRulesAccepted" BOOLEAN NOT NULL DEFAULT false,
    "emailCommunicationsConsent" BOOLEAN NOT NULL DEFAULT false,
    "amountCents" INTEGER NOT NULL,
    "duesAccountNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" DATETIME,
    "treasuryAccountNumber" TEXT,
    "entryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipFee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipFee_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipFee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MembershipCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MembershipFee" (
    "id",
    "associationId",
    "memberId",
    "fiscalYearId",
    "categoryId",
    "snapshotFirstName",
    "snapshotLastName",
    "snapshotEmail",
    "snapshotPhone",
    "snapshotAddress",
    "snapshotPostalCode",
    "snapshotCity",
    "snapshotLicenseNumber",
    "imageRightsConsent",
    "internalRulesAccepted",
    "emailCommunicationsConsent",
    "amountCents",
    "duesAccountNumber",
    "status",
    "paidAt",
    "treasuryAccountNumber",
    "entryId",
    "createdAt",
    "updatedAt"
)
SELECT
    f."id",
    f."associationId",
    f."memberId",
    f."fiscalYearId",
    m."categoryId",
    COALESCE(m."firstName", ''),
    COALESCE(m."lastName", ''),
    m."email",
    m."phone",
    m."address",
    m."postalCode",
    m."city",
    m."licenseNumber",
    false,
    false,
    false,
    f."amountCents",
    f."duesAccountNumber",
    f."status",
    f."paidAt",
    f."treasuryAccountNumber",
    f."entryId",
    f."createdAt",
    f."updatedAt"
FROM "MembershipFee" AS f
LEFT JOIN "Member" AS m ON m."id" = f."memberId";
DROP TABLE "MembershipFee";
ALTER TABLE "new_MembershipFee" RENAME TO "MembershipFee";
CREATE UNIQUE INDEX "MembershipFee_entryId_key" ON "MembershipFee"("entryId");
CREATE UNIQUE INDEX "MembershipFee_memberId_fiscalYearId_key" ON "MembershipFee"("memberId", "fiscalYearId");
CREATE INDEX "MembershipFee_associationId_fiscalYearId_status_idx" ON "MembershipFee"("associationId", "fiscalYearId", "status");
CREATE INDEX "MembershipFee_fiscalYearId_idx" ON "MembershipFee"("fiscalYearId");
CREATE INDEX "MembershipFee_categoryId_idx" ON "MembershipFee"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
