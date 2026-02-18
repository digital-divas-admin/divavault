-- Migration: add source intelligence tables for hostile account tracking and FP suppression
-- Phase 4C + 4D of the ML Intelligence Layer

-- Hostile accounts identified by Source Intelligence analyzer
CREATE TABLE IF NOT EXISTS ml_hostile_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    account_handle TEXT NOT NULL,
    match_count INTEGER DEFAULT 0,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    flagged_at TIMESTAMPTZ DEFAULT NOW(),
    evidence JSONB DEFAULT '{}',
    UNIQUE(platform, account_handle)
);

-- Suppression rules for repeat false positive pairs (FP Filter analyzer)
CREATE TABLE IF NOT EXISTS ml_suppression_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
    platform TEXT,
    face_embedding_hash TEXT,
    dismissal_count INTEGER DEFAULT 0,
    suppressed_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

-- Index for quick suppression lookups during matching
CREATE INDEX IF NOT EXISTS idx_suppression_contributor_platform
    ON ml_suppression_rules(contributor_id, platform);

-- Index for hostile account lookups during crawl processing
CREATE INDEX IF NOT EXISTS idx_hostile_account_lookup
    ON ml_hostile_accounts(platform, account_handle);
