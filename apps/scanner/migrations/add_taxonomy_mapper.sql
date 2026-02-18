-- Extend ml_section_profiles with mapper columns
ALTER TABLE ml_section_profiles
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS section_id TEXT,
  ADD COLUMN IF NOT EXISTS section_name TEXT,
  ADD COLUMN IF NOT EXISTS total_content INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_recommendation TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ml_priority FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS total_scanned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_faces INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS face_rate FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS last_crawl_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_section_profiles_platform_enabled
  ON ml_section_profiles (platform, scan_enabled);

-- Extend ml_platform_maps
ALTER TABLE ml_platform_maps
  ADD COLUMN IF NOT EXISTS sections_discovered INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_platform_maps_platform_snapshot
  ON ml_platform_maps (platform, snapshot_at DESC);
