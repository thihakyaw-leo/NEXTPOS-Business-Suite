CREATE TABLE IF NOT EXISTS hr_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    base_salary REAL NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS hr_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    employee_id INTEGER NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT,
    hours_worked REAL NOT NULL DEFAULT 0 CHECK (hours_worked >= 0),
    date TEXT NOT NULL,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
);

CREATE TABLE IF NOT EXISTS hr_payroll_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    processed_at TEXT,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    UNIQUE (tenant_id, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS hr_payslips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    period_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    basic_pay REAL NOT NULL DEFAULT 0,
    overtime_pay REAL NOT NULL DEFAULT 0,
    deductions REAL NOT NULL DEFAULT 0,
    net_pay REAL NOT NULL DEFAULT 0,
    days_present REAL NOT NULL DEFAULT 0,
    total_hours REAL NOT NULL DEFAULT 0,
    overtime_hours REAL NOT NULL DEFAULT 0,
    isdeleted INTEGER NOT NULL DEFAULT 0 CHECK (isdeleted IN (0, 1)),
    createdate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (period_id) REFERENCES hr_payroll_periods(id),
    FOREIGN KEY (employee_id) REFERENCES hr_employees(id),
    UNIQUE (tenant_id, period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant
    ON hr_employees (tenant_id, name)
    WHERE isdeleted = 0;

CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date
    ON hr_attendance (tenant_id, employee_id, date DESC)
    WHERE isdeleted = 0;

CREATE INDEX IF NOT EXISTS idx_hr_attendance_open_shift
    ON hr_attendance (tenant_id, employee_id, date)
    WHERE check_out IS NULL AND isdeleted = 0;

CREATE INDEX IF NOT EXISTS idx_hr_payroll_periods_tenant
    ON hr_payroll_periods (tenant_id, start_date DESC, end_date DESC)
    WHERE isdeleted = 0;

CREATE INDEX IF NOT EXISTS idx_hr_payslips_period
    ON hr_payslips (tenant_id, period_id, employee_id)
    WHERE isdeleted = 0;
