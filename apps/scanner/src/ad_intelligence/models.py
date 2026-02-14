"""SQLAlchemy 2.0 models for the Ad Intelligence tables."""

from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.db.models import Base


class AdIntelAd(Base):
    __tablename__ = "ad_intel_ads"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    platform: Mapped[str] = mapped_column(Text, nullable=False)
    platform_ad_id: Mapped[str] = mapped_column(Text, nullable=False)
    advertiser_name: Mapped[str | None] = mapped_column(Text)
    advertiser_id: Mapped[str | None] = mapped_column(Text)
    creative_url: Mapped[str | None] = mapped_column(Text)
    creative_stored_path: Mapped[str | None] = mapped_column(Text)
    ad_text: Mapped[str | None] = mapped_column(Text)
    landing_page_url: Mapped[str | None] = mapped_column(Text)
    reached_countries: Mapped[dict | None] = mapped_column(JSONB)
    is_ai_generated: Mapped[bool | None] = mapped_column(Boolean)
    ai_detection_score: Mapped[float | None] = mapped_column(Float)
    ai_generator: Mapped[str | None] = mapped_column(Text)
    face_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    processing_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    error_message: Mapped[str | None] = mapped_column(Text)
    discovered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class AdIntelFace(Base):
    __tablename__ = "ad_intel_faces"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ad_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("ad_intel_ads.id", ondelete="CASCADE"))
    face_index: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    embedding = Column(Vector(512), nullable=True)
    detection_score: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
    description_keywords: Mapped[list | None] = mapped_column(ARRAY(Text))
    demographics: Mapped[dict | None] = mapped_column(JSONB)
    described: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    searched: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    matched: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class AdIntelStockCandidate(Base):
    __tablename__ = "ad_intel_stock_candidates"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    face_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("ad_intel_faces.id", ondelete="CASCADE"))
    stock_platform: Mapped[str] = mapped_column(Text, nullable=False)
    stock_image_id: Mapped[str] = mapped_column(Text, nullable=False)
    stock_image_url: Mapped[str | None] = mapped_column(Text)
    preview_stored_path: Mapped[str | None] = mapped_column(Text)
    photographer: Mapped[str | None] = mapped_column(Text)
    model_name: Mapped[str | None] = mapped_column(Text)
    license_type: Mapped[str | None] = mapped_column(Text)
    embedding = Column(Vector(512), nullable=True)
    similarity_score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class AdIntelMatch(Base):
    __tablename__ = "ad_intel_matches"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ad_face_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("ad_intel_faces.id", ondelete="CASCADE"))
    stock_candidate_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("ad_intel_stock_candidates.id", ondelete="SET NULL"))
    contributor_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("contributors.id", ondelete="SET NULL"))
    match_type: Mapped[str] = mapped_column(Text, nullable=False)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_tier: Mapped[str | None] = mapped_column(Text)
    ad_platform: Mapped[str | None] = mapped_column(Text)
    advertiser_name: Mapped[str | None] = mapped_column(Text)
    review_status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class AdIntelConfig(Base):
    __tablename__ = "ad_intel_config"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[dict | None] = mapped_column(JSONB)
    description: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
