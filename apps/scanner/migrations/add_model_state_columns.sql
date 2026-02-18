-- Add training_signals and is_active columns to ml_model_state
-- Aligns schema with docx specification

ALTER TABLE ml_model_state
  ADD COLUMN IF NOT EXISTS training_signals INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Backfill training_signals from metrics->>'n_samples' where available
UPDATE ml_model_state
SET training_signals = (metrics->>'n_samples')::INTEGER
WHERE metrics->>'n_samples' IS NOT NULL
  AND training_signals = 0;

-- Mark the latest version of each model as active
UPDATE ml_model_state ms
SET is_active = true
FROM (
  SELECT DISTINCT ON (model_name) id
  FROM ml_model_state
  ORDER BY model_name, version DESC
) latest
WHERE ms.id = latest.id;
