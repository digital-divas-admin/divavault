-- Add circuit breaker columns to platform_crawl_schedule
ALTER TABLE platform_crawl_schedule
  ADD COLUMN IF NOT EXISTS consecutive_failures integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz;
