ALTER TABLE t_inventory_stock
ADD COLUMN avg_cost REAL NOT NULL DEFAULT 0;

UPDATE t_inventory_stock
SET avg_cost = cost_price
WHERE avg_cost = 0;

ALTER TABLE inventory_ledger
ADD COLUMN source_ledger_id INTEGER;

CREATE TABLE IF NOT EXISTS tx_customer_receivable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL DEFAULT '',
    balance_amount REAL NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
    last_sale_number TEXT,
    last_sale_id INTEGER,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    UNIQUE (tenant_id, customer_name, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_source
    ON inventory_ledger (source_ledger_id);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_fifo_layers
    ON inventory_ledger (tenant_id, item_code, location_code, createdate, id)
    WHERE isdeleted = 0 AND quantity_change > 0;

CREATE INDEX IF NOT EXISTS idx_customer_receivable_customer
    ON tx_customer_receivable (tenant_id, customer_name, customer_phone);

CREATE INDEX IF NOT EXISTS idx_customer_receivable_last_sale
    ON tx_customer_receivable (tenant_id, last_sale_id);

CREATE TRIGGER IF NOT EXISTS trg_inventory_stock_prevent_negative
BEFORE UPDATE OF quantity_on_hand ON t_inventory_stock
FOR EACH ROW
WHEN NEW.quantity_on_hand < 0
BEGIN
    SELECT RAISE(ABORT, 'Insufficient stock for sale');
END;
