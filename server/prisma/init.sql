-- Run this in Supabase → SQL Editor if `npx prisma db push` cannot reach the direct host (P1001).
-- After this succeeds, run: npm run db:seed (from repo root: npm run db:seed)

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "InventoryUnit" AS ENUM ('KG', 'EACH');
CREATE TYPE "RecipeUnit" AS ENUM ('GRAM', 'EACH', 'KG');

CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "internalNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Food',
    "parLevel" DECIMAL(14,6) NOT NULL,
    "onHand" DECIMAL(14,6) NOT NULL,
    "inventoryUnit" "InventoryUnit" NOT NULL,
    "vendorName" TEXT,
    "supplierSku" TEXT,
    "minOrder" DECIMAL(14,6),
    "unitCost" DECIMAL(14,4),
    "orderPackAmount" DECIMAL(14,6),
    "orderPackLabel" TEXT,
    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" DECIMAL(14,6) NOT NULL,
    "unit" "RecipeUnit" NOT NULL,
    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesEntry" (
    "id" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "SalesEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuItem_code_key" ON "MenuItem"("code");
CREATE UNIQUE INDEX "Ingredient_internalNumber_key" ON "Ingredient"("internalNumber");

ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesEntry" ADD CONSTRAINT "SalesEntry_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Performance (matches Prisma @@index). Safe to run once after tables exist.
CREATE INDEX IF NOT EXISTS "RecipeLine_menuItemId_idx" ON "RecipeLine"("menuItemId");
CREATE INDEX IF NOT EXISTS "RecipeLine_ingredientId_idx" ON "RecipeLine"("ingredientId");
CREATE INDEX IF NOT EXISTS "SalesEntry_menuItemId_idx" ON "SalesEntry"("menuItemId");
CREATE INDEX IF NOT EXISTS "SalesEntry_soldAt_idx" ON "SalesEntry"("soldAt");
