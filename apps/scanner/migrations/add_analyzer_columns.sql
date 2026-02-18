-- Extend ml_recommendations for analyzer output
ALTER TABLE ml_recommendations
  ADD COLUMN IF NOT EXISTS target_platform TEXT,
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS expected_impact TEXT,
  ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS supporting_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

-- Extend ml_section_profiles for section ranker output
ALTER TABLE ml_section_profiles
  ADD COLUMN IF NOT EXISTS ai_reason TEXT,
  ADD COLUMN IF NOT EXISTS ml_risk_level TEXT DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_recommendations_status
  ON ml_recommendations (status);
