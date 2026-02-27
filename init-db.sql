-- Workshop Management System - Database Schema
-- Generated from ASP.NET Core Entity Framework models

-- EF Core Migrations History table
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" VARCHAR(150) NOT NULL,
    "ProductVersion" VARCHAR(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- ==================== AUTH & ORGANIZATIONS ====================

-- Users table
CREATE TABLE IF NOT EXISTS "Users" (
    "Id" SERIAL PRIMARY KEY,
    "Email" VARCHAR(100) NOT NULL,
    "Username" VARCHAR(100) NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "FirstName" VARCHAR(100),
    "LastName" VARCHAR(100),
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "EmailConfirmed" BOOLEAN NOT NULL DEFAULT FALSE,
    "LastLoginAt" TIMESTAMP,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "CurrentOrganizationId" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email" ON "Users" ("Email");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Username" ON "Users" ("Username");

-- Organizations table
CREATE TABLE IF NOT EXISTS "Organizations" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(500),
    "OwnerId" INTEGER NOT NULL,
    "IsPersonal" BOOLEAN NOT NULL DEFAULT FALSE,
    "JoinCode" VARCHAR(40),
    "JoinCodeGeneratedAt" TIMESTAMP,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_Organizations_Users_OwnerId" FOREIGN KEY ("OwnerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Organizations_JoinCode" ON "Organizations" ("JoinCode");

-- Add FK from Users to Organizations (circular dependency)
ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS "FK_Users_Organizations_CurrentOrganizationId";
ALTER TABLE "Users" ADD CONSTRAINT "FK_Users_Organizations_CurrentOrganizationId"
    FOREIGN KEY ("CurrentOrganizationId") REFERENCES "Organizations" ("Id") ON DELETE SET NULL;

-- OrganizationMembers table
CREATE TABLE IF NOT EXISTS "OrganizationMembers" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Role" INTEGER NOT NULL DEFAULT 2,
    "JoinedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_OrganizationMembers_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OrganizationMembers_Users" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_OrganizationMembers_OrganizationId_UserId" ON "OrganizationMembers" ("OrganizationId", "UserId");

-- Invitations table
CREATE TABLE IF NOT EXISTS "Invitations" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "Email" VARCHAR(100) NOT NULL,
    "Token" VARCHAR(100) NOT NULL,
    "Status" INTEGER NOT NULL DEFAULT 1,
    "InvitedById" INTEGER NOT NULL,
    "ExpiresAt" TIMESTAMP NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "AcceptedAt" TIMESTAMP,
    "RejectedAt" TIMESTAMP,
    CONSTRAINT "FK_Invitations_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Invitations_Users_InvitedById" FOREIGN KEY ("InvitedById") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Invitations_Token" ON "Invitations" ("Token");
CREATE INDEX IF NOT EXISTS "IX_Invitations_OrganizationId_Email" ON "Invitations" ("OrganizationId", "Email");

-- RefreshTokens table
CREATE TABLE IF NOT EXISTS "RefreshTokens" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "Token" VARCHAR(500) NOT NULL,
    "ExpiresAt" TIMESTAMP NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "RevokedAt" TIMESTAMP,
    "ReplacedByToken" VARCHAR(100),
    "CreatedByIp" VARCHAR(100),
    "RevokedByIp" VARCHAR(100),
    CONSTRAINT "FK_RefreshTokens_Users" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_RefreshTokens_Token" ON "RefreshTokens" ("Token");

-- ==================== BUSINESS ENTITIES ====================

-- Materials table
CREATE TABLE IF NOT EXISTS "Materials" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "Unit" VARCHAR(50) NOT NULL,
    "Color" VARCHAR(100),
    "Category" VARCHAR(100),
    "Description" VARCHAR(500),
    "MinimumStock" NUMERIC,
    "IsArchived" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_Materials_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_Materials_OrganizationId_Name_Color" ON "Materials" ("OrganizationId", "Name", "Color");
CREATE INDEX IF NOT EXISTS "IX_Materials_OrganizationId" ON "Materials" ("OrganizationId");
CREATE INDEX IF NOT EXISTS "IX_Materials_Category" ON "Materials" ("Category");
CREATE INDEX IF NOT EXISTS "IX_Materials_IsArchived" ON "Materials" ("IsArchived");

-- Products table
CREATE TABLE IF NOT EXISTS "Products" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "Category" VARCHAR(100),
    "Description" VARCHAR(500),
    "ProductionTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "Weight" NUMERIC(18,4) NOT NULL DEFAULT 0,
    "FileLinks" VARCHAR(2000),
    "EstimatedCost" NUMERIC(18,2),
    "MarkupPercent" NUMERIC(5,2) NOT NULL DEFAULT 100,
    "RecommendedPrice" NUMERIC(18,2),
    "IsArchived" BOOLEAN NOT NULL DEFAULT FALSE,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_Products_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_Products_OrganizationId" ON "Products" ("OrganizationId");
CREATE INDEX IF NOT EXISTS "IX_Products_Name" ON "Products" ("Name");
CREATE INDEX IF NOT EXISTS "IX_Products_Category" ON "Products" ("Category");
CREATE INDEX IF NOT EXISTS "IX_Products_IsArchived" ON "Products" ("IsArchived");

-- RecipeItems table (BOM)
CREATE TABLE IF NOT EXISTS "RecipeItems" (
    "Id" SERIAL PRIMARY KEY,
    "ProductId" INTEGER NOT NULL,
    "MaterialId" INTEGER NOT NULL,
    "Quantity" NUMERIC(18,4) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_RecipeItems_Products" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_RecipeItems_Materials" FOREIGN KEY ("MaterialId") REFERENCES "Materials" ("Id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_RecipeItems_ProductId_MaterialId" ON "RecipeItems" ("ProductId", "MaterialId");

-- MaterialReceipts table
CREATE TABLE IF NOT EXISTS "MaterialReceipts" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "MaterialId" INTEGER NOT NULL,
    "Quantity" NUMERIC(18,4) NOT NULL,
    "ReceiptDate" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UnitPrice" NUMERIC(18,2) NOT NULL,
    "TotalPrice" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "BatchNumber" VARCHAR(100),
    "PurchaseSource" VARCHAR(200),
    "Comment" VARCHAR(500),
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_MaterialReceipts_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_MaterialReceipts_Materials" FOREIGN KEY ("MaterialId") REFERENCES "Materials" ("Id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IX_MaterialReceipts_OrganizationId" ON "MaterialReceipts" ("OrganizationId");
CREATE INDEX IF NOT EXISTS "IX_MaterialReceipts_MaterialId" ON "MaterialReceipts" ("MaterialId");
CREATE INDEX IF NOT EXISTS "IX_MaterialReceipts_ReceiptDate" ON "MaterialReceipts" ("ReceiptDate");

-- Productions table
CREATE TABLE IF NOT EXISTS "Productions" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "ProductionDate" TIMESTAMP NOT NULL DEFAULT NOW(),
    "BatchNumber" VARCHAR(50) NOT NULL,
    "QrCode" VARCHAR(500),
    "CostPerUnit" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "TotalCost" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "RecommendedPricePerUnit" NUMERIC(18,2),
    "PhotoPath" VARCHAR(500),
    "Comment" VARCHAR(500),
    "IsCancelled" BOOLEAN NOT NULL DEFAULT FALSE,
    "CancelledAt" TIMESTAMP,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_Productions_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Productions_Products" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IX_Productions_OrganizationId" ON "Productions" ("OrganizationId");
CREATE INDEX IF NOT EXISTS "IX_Productions_ProductId" ON "Productions" ("ProductId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Productions_OrganizationId_BatchNumber" ON "Productions" ("OrganizationId", "BatchNumber");
CREATE INDEX IF NOT EXISTS "IX_Productions_ProductionDate" ON "Productions" ("ProductionDate");

-- MaterialWriteOffs table
CREATE TABLE IF NOT EXISTS "MaterialWriteOffs" (
    "Id" SERIAL PRIMARY KEY,
    "ProductionId" INTEGER NOT NULL,
    "MaterialReceiptId" INTEGER NOT NULL,
    "MaterialId" INTEGER NOT NULL,
    "Quantity" NUMERIC(18,4) NOT NULL,
    "UnitPrice" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_MaterialWriteOffs_Productions" FOREIGN KEY ("ProductionId") REFERENCES "Productions" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_MaterialWriteOffs_MaterialReceipts" FOREIGN KEY ("MaterialReceiptId") REFERENCES "MaterialReceipts" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_MaterialWriteOffs_Materials" FOREIGN KEY ("MaterialId") REFERENCES "Materials" ("Id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IX_MaterialWriteOffs_ProductionId" ON "MaterialWriteOffs" ("ProductionId");
CREATE INDEX IF NOT EXISTS "IX_MaterialWriteOffs_MaterialReceiptId" ON "MaterialWriteOffs" ("MaterialReceiptId");

-- FinishedProducts table
CREATE TABLE IF NOT EXISTS "FinishedProducts" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "ProductionId" INTEGER NOT NULL,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'InStock',
    "CostPerUnit" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "RecommendedPrice" NUMERIC(18,2),
    "SalePrice" NUMERIC(18,2),
    "Client" VARCHAR(200),
    "SaleDate" TIMESTAMP,
    "WriteOffReason" VARCHAR(500),
    "Comment" VARCHAR(500),
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_FinishedProducts_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_FinishedProducts_Productions" FOREIGN KEY ("ProductionId") REFERENCES "Productions" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_FinishedProducts_OrganizationId" ON "FinishedProducts" ("OrganizationId");
CREATE INDEX IF NOT EXISTS "IX_FinishedProducts_ProductionId" ON "FinishedProducts" ("ProductionId");
CREATE INDEX IF NOT EXISTS "IX_FinishedProducts_Status" ON "FinishedProducts" ("Status");

-- OperationHistory table
CREATE TABLE IF NOT EXISTS "OperationHistory" (
    "Id" SERIAL PRIMARY KEY,
    "OrganizationId" INTEGER NOT NULL,
    "UserId" INTEGER,
    "OperationType" VARCHAR(50) NOT NULL,
    "EntityType" VARCHAR(50),
    "EntityId" INTEGER,
    "EntityName" VARCHAR(200),
    "Quantity" NUMERIC(18,4),
    "Amount" NUMERIC(18,2),
    "Description" VARCHAR(1000),
    "Details" TEXT,
    "RelatedOperationId" INTEGER,
    "IsCancelled" BOOLEAN NOT NULL DEFAULT FALSE,
    "CancelledAt" TIMESTAMP,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_OperationHistory_Organizations" FOREIGN KEY ("OrganizationId") REFERENCES "Organizations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OperationHistory_Users" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IX_OperationHistory_OrganizationId" ON "OperationHistory" ("OrganizationId");
CREATE INDEX IF NOT EXISTS "IX_OperationHistory_OperationType" ON "OperationHistory" ("OperationType");
CREATE INDEX IF NOT EXISTS "IX_OperationHistory_EntityType" ON "OperationHistory" ("EntityType");
CREATE INDEX IF NOT EXISTS "IX_OperationHistory_CreatedAt" ON "OperationHistory" ("CreatedAt");

-- Record this as an EF migration so the backend doesn't try to re-create tables
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250101000000_InitialCreate', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
