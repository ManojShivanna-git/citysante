-- Add barcode column to product_requests table
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
