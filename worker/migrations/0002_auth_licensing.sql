ALTER TABLE tenants ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'pos_only';
ALTER TABLE tenants ADD COLUMN enabled_features TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tenants ADD COLUMN trial_ends_at TEXT;

UPDATE tenants
SET
    plan_type = COALESCE(plan_type, 'pos_only'),
    enabled_features = COALESCE(enabled_features, '[]'),
    trial_ends_at = COALESCE(trial_ends_at, datetime(createdate, '+7 days'));

CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at
    ON tenants (trial_ends_at);
