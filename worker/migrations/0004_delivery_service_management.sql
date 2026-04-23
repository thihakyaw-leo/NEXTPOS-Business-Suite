ALTER TABLE tx_sale_sale
ADD COLUMN delivery_provider TEXT;

ALTER TABLE tx_sale_sale
ADD COLUMN delivery_tracking_id TEXT;

ALTER TABLE tx_sale_sale
ADD COLUMN delivery_status TEXT;

ALTER TABLE tx_sale_sale
ADD COLUMN delivery_fee REAL NOT NULL DEFAULT 0;

ALTER TABLE tx_sale_sale
ADD COLUMN delivery_cost REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sale_delivery_tracking
    ON tx_sale_sale (delivery_tracking_id)
    WHERE delivery_tracking_id IS NOT NULL AND isdeleted = 0;

CREATE INDEX IF NOT EXISTS idx_sale_delivery_status
    ON tx_sale_sale (tenant_id, delivery_status)
    WHERE isdeleted = 0;
