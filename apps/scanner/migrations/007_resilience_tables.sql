-- Adversarial Crawler Resilience Module: foundation tables
-- Tracks crawl health, degradation events, auto-generated patches, and page cache.

-- 1. Crawl health snapshots — one row per crawl tick
CREATE TABLE IF NOT EXISTS crawl_health_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,
    crawl_type      TEXT NOT NULL,
    tick_number     INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    duration_seconds DOUBLE PRECISION,
    images_discovered INTEGER DEFAULT 0,
    images_new      INTEGER DEFAULT 0,
    download_failures INTEGER DEFAULT 0,
    tags_total      INTEGER DEFAULT 0,
    tags_exhausted  INTEGER DEFAULT 0,
    faces_found     INTEGER DEFAULT 0,
    http_errors     JSONB,
    error_message   TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crawl_health_snapshots_platform_created
    ON crawl_health_snapshots (platform, created_at);

-- 2. Degradation events — detected anomalies in crawl health
CREATE TABLE IF NOT EXISTS degradation_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,
    degradation_type TEXT NOT NULL,
    severity        TEXT NOT NULL,
    symptom         TEXT NOT NULL,
    baseline_value  DOUBLE PRECISION,
    current_value   DOUBLE PRECISION,
    deviation_pct   DOUBLE PRECISION,
    snapshot_id     UUID REFERENCES crawl_health_snapshots(id),
    diagnosis       TEXT,
    diagnosis_at    TIMESTAMPTZ,
    root_cause      TEXT,
    page_snapshot_url TEXT,
    status          TEXT DEFAULT 'open',
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_degradation_events_platform_status
    ON degradation_events (platform, status);

-- 3. Crawler patches — auto-generated code fixes
CREATE TABLE IF NOT EXISTS crawler_patches (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    degradation_event_id UUID REFERENCES degradation_events(id),
    platform             TEXT NOT NULL,
    target_file          TEXT NOT NULL,
    patch_type           TEXT NOT NULL,
    description          TEXT,
    diff_content         TEXT,
    claude_reasoning     TEXT,
    sandbox_result       TEXT,
    sandbox_yield_before INTEGER,
    sandbox_yield_after  INTEGER,
    canary_result        TEXT,
    canary_yield_before  INTEGER,
    canary_yield_after   INTEGER,
    status               TEXT DEFAULT 'draft',
    promoted_at          TIMESTAMPTZ,
    rolled_back_at       TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crawler_patches_platform_status
    ON crawler_patches (platform, status);

-- 4. Crawler page cache — cached HTML for structural-change detection
CREATE TABLE IF NOT EXISTS crawler_page_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,
    search_term     TEXT,
    url             TEXT NOT NULL,
    html_content    TEXT NOT NULL,
    response_status INTEGER,
    response_bytes  INTEGER,
    images_found    INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crawler_page_cache_platform_search_term
    ON crawler_page_cache (platform, search_term);
