-- CreateTable
CREATE TABLE "MembershipSeason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipSeason_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MembershipSeasonTariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "duesAccountNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipSeasonTariff_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "MembershipSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipSeasonTariff_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MembershipCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "MembershipSeason" ("id", "associationId", "name", "startDate", "endDate", "createdAt", "updatedAt")
SELECT
    fy."id",
    fy."associationId",
    'Saison ' || COALESCE(
        CASE
            WHEN typeof(fy."startDate") IN ('integer', 'real') THEN date(fy."startDate" / 1000, 'unixepoch')
            ELSE substr(CAST(fy."startDate" AS TEXT), 1, 10)
        END,
        'inconnue'
    ) || ' – ' || COALESCE(
        CASE
            WHEN typeof(fy."endDate") IN ('integer', 'real') THEN date(fy."endDate" / 1000, 'unixepoch')
            ELSE substr(CAST(fy."endDate" AS TEXT), 1, 10)
        END,
        'inconnue'
    ),
    fy."startDate",
    fy."endDate",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "FiscalYear" AS fy
WHERE fy."associationId" IN (
    SELECT "associationId" FROM "Member"
    UNION
    SELECT "associationId" FROM "MembershipCategory"
    UNION
    SELECT "associationId" FROM "MembershipFee"
);

INSERT INTO "MembershipSeasonTariff" ("id", "seasonId", "categoryId", "amountCents", "duesAccountNumber", "createdAt", "updatedAt")
SELECT
    s."id" || '-' || c."id",
    s."id",
    c."id",
    c."amountCents",
    c."duesAccountNumber",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "MembershipSeason" AS s
INNER JOIN "MembershipCategory" AS c ON c."associationId" = s."associationId";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MembershipFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "associationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
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
    CONSTRAINT "MembershipFee_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "MembershipSeason" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipFee_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "MembershipSeasonTariff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipFee_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MembershipCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MembershipFee" (
    "id",
    "associationId",
    "memberId",
    "seasonId",
    "tariffId",
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
    COALESCE(
        (
            SELECT t."id" FROM "MembershipSeasonTariff" AS t
            WHERE t."seasonId" = f."fiscalYearId"
              AND t."categoryId" = f."categoryId"
        ),
        (
            SELECT t."id" FROM "MembershipSeasonTariff" AS t
            WHERE t."seasonId" = f."fiscalYearId"
              AND t."categoryId" = (SELECT m."categoryId" FROM "Member" AS m WHERE m."id" = f."memberId")
        ),
        (
            SELECT t."id" FROM "MembershipSeasonTariff" AS t
            WHERE t."seasonId" = f."fiscalYearId"
            LIMIT 1
        )
    ),
    f."categoryId",
    f."snapshotFirstName",
    f."snapshotLastName",
    f."snapshotEmail",
    f."snapshotPhone",
    f."snapshotAddress",
    f."snapshotPostalCode",
    f."snapshotCity",
    f."snapshotLicenseNumber",
    f."imageRightsConsent",
    f."internalRulesAccepted",
    f."emailCommunicationsConsent",
    f."amountCents",
    f."duesAccountNumber",
    f."status",
    f."paidAt",
    f."treasuryAccountNumber",
    f."entryId",
    f."createdAt",
    f."updatedAt"
FROM "MembershipFee" AS f;
DROP TABLE "MembershipFee";
ALTER TABLE "new_MembershipFee" RENAME TO "MembershipFee";
CREATE UNIQUE INDEX "MembershipFee_entryId_key" ON "MembershipFee"("entryId");
CREATE UNIQUE INDEX "MembershipFee_memberId_seasonId_key" ON "MembershipFee"("memberId", "seasonId");
CREATE INDEX "MembershipFee_associationId_seasonId_status_idx" ON "MembershipFee"("associationId", "seasonId", "status");
CREATE INDEX "MembershipFee_seasonId_idx" ON "MembershipFee"("seasonId");
CREATE INDEX "MembershipFee_tariffId_idx" ON "MembershipFee"("tariffId");
CREATE INDEX "MembershipFee_categoryId_idx" ON "MembershipFee"("categoryId");
CREATE UNIQUE INDEX "MembershipSeason_associationId_name_key" ON "MembershipSeason"("associationId", "name");
CREATE INDEX "MembershipSeason_associationId_startDate_idx" ON "MembershipSeason"("associationId", "startDate");
CREATE UNIQUE INDEX "MembershipSeasonTariff_seasonId_categoryId_key" ON "MembershipSeasonTariff"("seasonId", "categoryId");
CREATE INDEX "MembershipSeasonTariff_categoryId_idx" ON "MembershipSeasonTariff"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
