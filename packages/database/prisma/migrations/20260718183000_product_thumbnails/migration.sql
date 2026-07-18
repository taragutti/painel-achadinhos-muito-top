-- Add an owned thumbnail reference without modifying existing product images.
ALTER TABLE "Product" ADD COLUMN "thumbnailImageUrl" TEXT;
