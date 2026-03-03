-- Phase 2: Automated analysis columns for deepfake investigations
-- Run via exec_sql RPC or Supabase Management API

-- Add AI detection + provenance columns to evidence table
ALTER TABLE deepfake_evidence
  ADD COLUMN IF NOT EXISTS ai_detection_score float,
  ADD COLUMN IF NOT EXISTS ai_detection_generator text,
  ADD COLUMN IF NOT EXISTS provenance_data jsonb;

-- Add frame_id FK to tasks table (for per-frame tasks like reverse_search, ai_detection)
ALTER TABLE deepfake_tasks
  ADD COLUMN IF NOT EXISTS frame_id uuid REFERENCES deepfake_frames(id);
