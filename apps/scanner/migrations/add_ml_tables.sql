-- ML feedback signals: buffered pipeline events for training data collection
CREATE TABLE IF NOT EXISTS ml_feedback_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    actor TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ml_signals_type ON ml_feedback_signals (signal_type);
CREATE INDEX idx_ml_signals_created ON ml_feedback_signals (created_at);

-- ML section profiles: per-section intelligence profiles (populated by ML models later)
CREATE TABLE IF NOT EXISTS ml_section_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key TEXT NOT NULL UNIQUE,
    profile JSONB DEFAULT '{}',
    confidence FLOAT DEFAULT 0.0,
    sample_count INTEGER DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ML recommendations: ML-generated recommendations awaiting human review
CREATE TABLE IF NOT EXISTS ml_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_type TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    confidence FLOAT DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ml_recs_status ON ml_recommendations (status);

-- ML model state: versioned ML model parameters for reproducibility
CREATE TABLE IF NOT EXISTS ml_model_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    parameters JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (model_name, version)
);

-- ML platform maps: platform taxonomy snapshots
CREATE TABLE IF NOT EXISTS ml_platform_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    taxonomy JSONB DEFAULT '{}',
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
