"""SQLAlchemy 2.0 models mirroring the shared database schema.

Adapted to the real column names in the Consented AI database:
- contributors.verification_status
- contributors.full_name (not first_name/last_name)
- contributor_images.file_path + bucket (not storage_url)
- contributor_images.capture_step (not image_type)
"""

from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import BIT, JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# --- Tables the scanner READS from (owned by web app) ---


class Contributor(Base):
    __tablename__ = "contributors"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    full_name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    verification_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    subscription_tier: Mapped[str] = mapped_column(Text, server_default=text("'free'"))
    instagram_username: Mapped[str | None] = mapped_column(Text)
    photo_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    consent_given: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    opted_out: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    suspended: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    flagged: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class ContributorImage(Base):
    __tablename__ = "contributor_images"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    session_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("capture_sessions.id"))
    capture_step: Mapped[str | None] = mapped_column(Text)
    pose: Mapped[str | None] = mapped_column(Text)
    angle: Mapped[str | None] = mapped_column(Text)
    expression: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(Text)
    bucket: Mapped[str | None] = mapped_column(Text)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    quality_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    sharpness_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    brightness_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    identity_match_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    embedding_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    embedding_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("extensions.uuid_generate_v4()"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    source: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(Text)
    original_url: Mapped[str | None] = mapped_column(Text)
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    bucket: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'processing'"))
    display_name: Mapped[str | None] = mapped_column(Text)
    embedding_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    embedding_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class CaptureSession(Base):
    __tablename__ = "capture_sessions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    session_type: Mapped[str] = mapped_column(Text, server_default=text("'onboarding'"))
    status: Mapped[str] = mapped_column(Text, server_default=text("'active'"))
    device_info: Mapped[dict | None] = mapped_column(JSONB)
    images_captured: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    images_required: Mapped[int] = mapped_column(Integer, server_default=text("9"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# --- Tables the scanner WRITES to ---


class ContributorKnownAccount(Base):
    __tablename__ = "contributor_known_accounts"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(Text)
    handle: Mapped[str | None] = mapped_column(Text)
    profile_url: Mapped[str | None] = mapped_column(Text)
    domain: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class ContributorEmbedding(Base):
    __tablename__ = "contributor_embeddings"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    source_image_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributor_images.id", ondelete="CASCADE"))
    source_upload_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("uploads.id", ondelete="CASCADE"))
    embedding = Column(Vector(512), nullable=False)
    detection_score: Mapped[float | None] = mapped_column(Float)
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    embedding_type: Mapped[str] = mapped_column(Text, server_default=text("'single'"), nullable=False)
    centroid_metadata: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    contributor_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    scan_type: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    source_name: Mapped[str | None] = mapped_column(Text)
    images_processed: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    matches_found: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class DiscoveredImage(Base):
    __tablename__ = "discovered_images"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    scan_job_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("scan_jobs.id", ondelete="SET NULL"))
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    page_url: Mapped[str | None] = mapped_column(Text)
    page_title: Mapped[str | None] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(Text)
    image_stored_url: Mapped[str | None] = mapped_column(Text)
    has_face: Mapped[bool | None] = mapped_column(Boolean)
    face_count: Mapped[int | None] = mapped_column(Integer)
    phash = mapped_column(BIT(64))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class DiscoveredFaceEmbedding(Base):
    __tablename__ = "discovered_face_embeddings"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    discovered_image_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discovered_images.id", ondelete="CASCADE"))
    face_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    embedding = Column(Vector(512), nullable=False)
    detection_score: Mapped[float | None] = mapped_column(Float)
    matched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    discovered_image_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discovered_images.id", ondelete="CASCADE"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_tier: Mapped[str] = mapped_column(Text, nullable=False)
    best_embedding_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributor_embeddings.id"))
    face_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    source_account: Mapped[str | None] = mapped_column(Text)
    is_known_account: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    known_account_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributor_known_accounts.id"))
    is_ai_generated: Mapped[bool | None] = mapped_column(Boolean)
    ai_detection_score: Mapped[float | None] = mapped_column(Float)
    ai_generator: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'new'"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    match_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"))
    evidence_type: Mapped[str] = mapped_column(Text, nullable=False)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class Takedown(Base):
    __tablename__ = "takedowns"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    match_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(Text, nullable=False)
    takedown_type: Mapped[str] = mapped_column(Text, server_default=text("'dmca'"))
    notice_content: Mapped[str | None] = mapped_column(Text)
    submission_method: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_received: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class ScannerNotification(Base):
    __tablename__ = "scanner_notifications"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"))
    notification_type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict | None] = mapped_column(JSONB)
    read: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    sent: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class ScanSchedule(Base):
    __tablename__ = "scan_schedule"

    contributor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="CASCADE"), primary_key=True)
    scan_type: Mapped[str] = mapped_column(Text, primary_key=True)
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scan_interval_hours: Mapped[int] = mapped_column(Integer, server_default=text("168"))
    priority: Mapped[int] = mapped_column(Integer, server_default=text("0"))


class RegistryIdentity(Base):
    """Registry identity — claim/registry users (no auth.users row)."""
    __tablename__ = "registry_identities"

    cid: Mapped[str] = mapped_column(Text, primary_key=True)
    status: Mapped[str] = mapped_column(Text, server_default=text("'claimed'"))
    face_embedding = Column(Vector(512), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(Text, server_default=text("'buffalo_sc'"))
    identity_hash: Mapped[str] = mapped_column(Text)
    selfie_bucket: Mapped[str | None] = mapped_column(Text)
    selfie_path: Mapped[str | None] = mapped_column(Text)
    embedding_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    embedding_error: Mapped[str | None] = mapped_column(Text)
    detection_score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)


class RegistryMatch(Base):
    """Match between a discovered image and a registry identity (claim user)."""
    __tablename__ = "registry_matches"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    cid: Mapped[str] = mapped_column(Text, nullable=False)
    discovered_image_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discovered_images.id", ondelete="SET NULL"))
    source_url: Mapped[str | None] = mapped_column(Text)
    page_url: Mapped[str | None] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(Text)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_tier: Mapped[str] = mapped_column(Text, nullable=False)
    face_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    match_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    is_ai_generated: Mapped[bool | None] = mapped_column(Boolean)
    ai_detection_score: Mapped[float | None] = mapped_column(Float)
    evidence_hash: Mapped[str | None] = mapped_column(Text)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)


class PlatformCrawlSchedule(Base):
    __tablename__ = "platform_crawl_schedule"

    platform: Mapped[str] = mapped_column(Text, primary_key=True)
    last_crawl_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_crawl_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    crawl_interval_hours: Mapped[int] = mapped_column(Integer, server_default=text("24"))
    enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    search_terms: Mapped[dict | None] = mapped_column(JSONB)
    crawl_phase: Mapped[str | None] = mapped_column(Text)  # 'crawling', 'detecting', 'matching', None
    total_images_discovered: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    tags_total: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    tags_exhausted: Mapped[int] = mapped_column(Integer, server_default=text("0"))
