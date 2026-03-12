-- Performance indexes for scanner pipeline hot paths.
-- All indexes use CONCURRENTLY for non-locking creation.

-- Phase 1a: Partial indexes on hot-path filter columns

-- Pending face detection (queried every 30s tick)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_images_pending_detection
    ON discovered_images (created_at) WHERE has_face IS NULL;

-- Images with detected faces (metrics/pipeline queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_images_has_face
    ON discovered_images (discovered_at) WHERE has_face = true;

-- Face embeddings pending matching (queried every tick)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dfe_pending_matching
    ON discovered_face_embeddings (created_at) WHERE matched_at IS NULL;

-- Contributor images pending embedding (ingest step)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributor_images_pending
    ON contributor_images (created_at) WHERE embedding_status = 'pending';

-- Uploads pending embedding
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uploads_pending
    ON uploads (created_at) WHERE embedding_status = 'pending';

-- Registry identities pending embedding
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_pending
    ON registry_identities (created_at)
    WHERE embedding_status = 'pending' AND selfie_bucket IS NOT NULL;

-- Matches pending review
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_pending_review
    ON matches (created_at) WHERE status = 'new';

-- Platform breakdown queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovered_images_platform
    ON discovered_images (platform) WHERE platform IS NOT NULL;


-- Phase 1b: pgvector IVFFlat indexes for similarity search

-- Contributor embeddings (small table, grows with users)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contributor_embeddings_cosine
    ON contributor_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);

-- Registry identities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_registry_identities_cosine
    ON registry_identities USING ivfflat (face_embedding vector_cosine_ops)
    WITH (lists = 10);

-- Discovered face embeddings (large table, 100k+ rows)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dfe_embedding_cosine
    ON discovered_face_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
