-- Align the existing Product table with the reviewed Prisma model.
-- Imported marketplace offers may not include a store name.
ALTER TABLE "Product" ALTER COLUMN "storeName" DROP NOT NULL;
