-- Extend contributors with test user fields
ALTER TABLE contributors ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT false;
ALTER TABLE contributors ADD COLUMN IF NOT EXISTS test_user_type TEXT;

CREATE INDEX IF NOT EXISTS idx_contributors_test_user
ON contributors (is_test_user) WHERE is_test_user = true;

-- Honeypot ground truth table
CREATE TABLE IF NOT EXISTS test_honeypot_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id          UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    platform                TEXT NOT NULL,
    planted_url             TEXT NOT NULL,
    content_type            TEXT NOT NULL,
    generation_method       TEXT,
    difficulty              TEXT NOT NULL,
    expected_similarity_min FLOAT DEFAULT 0.70,
    expected_similarity_max FLOAT DEFAULT 0.95,
    detected                BOOLEAN DEFAULT false,
    detected_at             TIMESTAMPTZ,
    detected_match_id       UUID REFERENCES matches(id),
    detected_similarity     FLOAT,
    planted_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_honeypot_contributor ON test_honeypot_items(contributor_id);
CREATE INDEX IF NOT EXISTS idx_honeypot_detected ON test_honeypot_items(detected);

-- Enable RLS (scanner uses service_role which bypasses RLS)
ALTER TABLE test_honeypot_items ENABLE ROW LEVEL SECURITY;
