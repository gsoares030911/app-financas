alter table events add column if not exists recovery_applied_at timestamptz;
