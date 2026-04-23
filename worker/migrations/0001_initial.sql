PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    company_code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    currency_code TEXT NOT NULL DEFAULT 'MMK',
    timezone TEXT NOT NULL DEFAULT 'Asia/Yangon',
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    hardware_id TEXT NOT NULL,
    activation_key TEXT NOT NULL UNIQUE,
    device_name TEXT,
    activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    last_seen_at TEXT,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE TABLE IF NOT EXISTS t_inventory_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    barcode TEXT,
    category TEXT,
    unit TEXT NOT NULL DEFAULT 'PCS',
    location_code TEXT NOT NULL DEFAULT 'MAIN',
    quantity_on_hand REAL NOT NULL DEFAULT 0,
    reorder_level REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE TABLE IF NOT EXISTS inventory_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    item_code TEXT NOT NULL,
    location_code TEXT NOT NULL DEFAULT 'MAIN',
    transaction_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    quantity_change REAL NOT NULL,
    quantity_before REAL NOT NULL DEFAULT 0,
    quantity_after REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    remarks TEXT,
    transaction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE TABLE IF NOT EXISTS tx_sale_sale (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    sale_number TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    net_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    cashier_id TEXT,
    register_id TEXT,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    UNIQUE (tenant_id, sale_number),
    UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS tx_sale_saledetail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    sale_id INTEGER NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    barcode TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    cost_price REAL NOT NULL DEFAULT 0,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (tenant_id, sale_id) REFERENCES tx_sale_sale(tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activations_tenant_hardware
    ON activations (tenant_id, hardware_id)
    WHERE isdeleted = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_stock_tenant_item_location
    ON t_inventory_stock (tenant_id, item_code, location_code)
    WHERE isdeleted = 0;

CREATE INDEX IF NOT EXISTS idx_activations_tenant_id
    ON activations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_activations_hardware_id
    ON activations (hardware_id);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_barcode
    ON t_inventory_stock (tenant_id, barcode);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_item
    ON inventory_ledger (tenant_id, item_code, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_reference
    ON inventory_ledger (tenant_id, reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_sale_sale_date
    ON tx_sale_sale (tenant_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sale_sale_status
    ON tx_sale_sale (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_sale_detail_sale
    ON tx_sale_saledetail (tenant_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_detail_item
    ON tx_sale_saledetail (tenant_id, item_code);
