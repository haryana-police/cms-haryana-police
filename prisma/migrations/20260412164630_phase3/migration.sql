-- CreateTable
CREATE TABLE "repeat_offender_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personName" TEXT,
    "fatherName" TEXT,
    "mobileNumber" TEXT,
    "vehicleNumber" TEXT,
    "linkedArea" TEXT,
    "frequency" INTEGER NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "signalType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sho_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "linkedArea" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
