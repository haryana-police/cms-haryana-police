-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "badgeNumber" TEXT,
    "rank" TEXT,
    "stationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "gd_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gdNumber" TEXT NOT NULL,
    "gdDate" DATETIME NOT NULL,
    "gdTime" TEXT NOT NULL,
    "policeStation" TEXT NOT NULL,
    "beatArea" TEXT,
    "entryType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "personName" TEXT,
    "fatherName" TEXT,
    "mobileNumber" TEXT,
    "vehicleNumber" TEXT,
    "location" TEXT NOT NULL,
    "complaintId" TEXT,
    "firId" TEXT,
    "summary" TEXT NOT NULL,
    "remarks" TEXT,
    "manualOverrideFlag" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "attachmentUrl" TEXT,
    "intelligenceFlag" BOOLEAN NOT NULL DEFAULT false,
    "intelligenceReason" TEXT,
    "confidenceScore" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "preventive_hotspots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "riskScore" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "preventive_patterns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patternType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT,
    "linkedValue" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "preventive_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "gd_entries_gdNumber_key" ON "gd_entries"("gdNumber");
