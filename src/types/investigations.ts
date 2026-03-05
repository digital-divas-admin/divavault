// Deepfake Investigation & Debunking Tool — TypeScript interfaces

// --- Enum arrays (source of truth) + derived union types ---

export const INVESTIGATION_STATUSES = ["draft", "in_progress", "review", "published", "archived"] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export const INVESTIGATION_VERDICTS = ["confirmed_fake", "likely_fake", "inconclusive", "likely_real", "confirmed_real"] as const;
export type InvestigationVerdict = (typeof INVESTIGATION_VERDICTS)[number];

export const INVESTIGATION_CATEGORIES = ["war_misinfo", "political", "celebrity", "revenge", "fraud", "other"] as const;
export type InvestigationCategory = (typeof INVESTIGATION_CATEGORIES)[number];

export const EVIDENCE_TYPES = ["finding", "note", "external_link", "screenshot", "metadata_anomaly", "timeline_entry", "source_match", "ai_detection", "provenance_check"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const REVERSE_SEARCH_ENGINES = ["tineye", "google_lens", "yandex", "manual", "serpapi", "wayback", "news_search", "ap_archive", "getty_editorial"] as const;
export type ReverseSearchEngine = (typeof REVERSE_SEARCH_ENGINES)[number];

export type MediaDownloadStatus = "pending" | "downloading" | "completed" | "failed";
export type TaskStatus = "pending" | "running" | "completed" | "failed";
export type TaskType = "download_media" | "extract_frames" | "extract_metadata" | "reverse_search" | "ai_detection" | "check_provenance" | "news_search" | "wire_search";
export type ActivityEventType =
  | "investigation_created"
  | "investigation_updated"
  | "verdict_set"
  | "media_added"
  | "media_downloaded"
  | "frames_extracted"
  | "frame_annotated"
  | "evidence_added"
  | "evidence_updated"
  | "search_result_added"
  | "published"
  | "unpublished"
  | "reverse_search_completed"
  | "ai_detection_completed"
  | "provenance_checked"
  | "news_search_completed"
  | "wire_search_completed";

// --- Main interfaces ---

export interface Investigation {
  id: string;
  title: string;
  slug: string;
  category: InvestigationCategory;
  status: InvestigationStatus;
  verdict: InvestigationVerdict | null;
  confidence_score: number | null;
  summary: string | null;
  methodology: string | null;
  description: string | null;
  source_urls: string[];
  geographic_context: string | null;
  date_first_seen: string | null;
  date_investigated: string;
  thumbnail_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface InvestigationMedia {
  id: string;
  investigation_id: string;
  source_url: string;
  platform: string | null;
  media_type: "video" | "image" | "unknown";
  storage_path: string | null;
  thumbnail_path: string | null;
  download_status: MediaDownloadStatus;
  download_error: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  fps: number | null;
  codec: string | null;
  resolution_width: number | null;
  resolution_height: number | null;
  ffprobe_data: Record<string, unknown> | null;
  exif_data: Record<string, unknown> | null;
  engagement_stats: {
    views?: number | null;
    reposts?: number | null;
    likes?: number | null;
    replies?: number | null;
    bookmarks?: number | null;
    captured_at?: string | null;
  } | null;
  storage_url?: string;
  created_at: string;
  updated_at: string;
}

export interface InvestigationFrame {
  id: string;
  media_id: string;
  investigation_id: string;
  frame_number: number;
  timestamp_seconds: number | null;
  storage_path: string;
  thumbnail_path: string | null;
  storage_url?: string;
  thumbnail_url?: string;
  admin_notes: string | null;
  has_artifacts: boolean;
  is_key_evidence: boolean;
  drawing_data: Record<string, unknown> | null;
  annotation_image_path: string | null;
  annotation_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ReverseSearchResult {
  id: string;
  investigation_id: string;
  frame_id: string | null;
  engine: ReverseSearchEngine;
  result_url: string;
  result_domain: string | null;
  result_title: string | null;
  result_date: string | null;
  relevance_rating: number | null;
  notes: string | null;
  created_at: string;
}

export interface InvestigationEvidence {
  id: string;
  investigation_id: string;
  evidence_type: EvidenceType;
  title: string | null;
  content: string | null;
  attachment_path: string | null;
  attachment_url?: string;
  external_url: string | null;
  display_order: number;
  ai_detection_score: number | null;
  ai_detection_deepfake_score: number | null;
  ai_detection_generator: string | null;
  frame_number: number | null;
  provenance_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DeepfakeTask {
  id: string;
  investigation_id: string;
  media_id: string | null;
  frame_id: string | null;
  task_type: TaskType;
  status: TaskStatus;
  progress: number | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  investigation_id: string;
  event_type: ActivityEventType;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// --- Composite types for pages ---

export interface InvestigationListItem {
  id: string;
  title: string;
  slug: string;
  category: InvestigationCategory;
  status: InvestigationStatus;
  verdict: InvestigationVerdict | null;
  confidence_score: number | null;
  thumbnail_path: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  media_count: number;
  evidence_count: number;
}

export interface InvestigationStats {
  total: number;
  drafts: number;
  in_progress: number;
  published: number;
  confirmed_fake: number;
}

export interface InvestigationDetail extends Investigation {
  media: InvestigationMedia[];
  frames: InvestigationFrame[];
  evidence: InvestigationEvidence[];
  tasks: DeepfakeTask[];
  activity: ActivityLogEntry[];
  reverse_search_results: ReverseSearchResult[];
}

// --- Verdict display helpers ---

export const VERDICT_LABELS: Record<InvestigationVerdict, string> = {
  confirmed_fake: "Confirmed Fake",
  likely_fake: "Likely Fake",
  inconclusive: "Inconclusive",
  likely_real: "Likely Real",
  confirmed_real: "Confirmed Real",
};

export const VERDICT_COLORS: Record<InvestigationVerdict, string> = {
  confirmed_fake: "bg-red-500/10 text-red-600 border-red-500/20",
  likely_fake: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  inconclusive: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  likely_real: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  confirmed_real: "bg-green-500/10 text-green-600 border-green-500/20",
};

export const VERDICT_TEXT_COLORS: Record<InvestigationVerdict, string> = {
  confirmed_fake: "text-red-600",
  likely_fake: "text-orange-600",
  inconclusive: "text-yellow-600",
  likely_real: "text-blue-600",
  confirmed_real: "text-green-600",
};

export const VERDICT_BANNER_COLORS: Record<InvestigationVerdict, string> = {
  confirmed_fake: "bg-red-50 border-red-200 text-red-800",
  likely_fake: "bg-orange-50 border-orange-200 text-orange-800",
  inconclusive: "bg-yellow-50 border-yellow-200 text-yellow-800",
  likely_real: "bg-blue-50 border-blue-200 text-blue-800",
  confirmed_real: "bg-green-50 border-green-200 text-green-800",
};

export const CATEGORY_LABELS: Record<InvestigationCategory, string> = {
  war_misinfo: "War Misinfo",
  political: "Political",
  celebrity: "Celebrity",
  revenge: "Revenge",
  fraud: "Fraud",
  other: "Other",
};

export const STATUS_LABELS: Record<InvestigationStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  review: "Under Review",
  published: "Published",
  archived: "Archived",
};

export const STATUS_COLORS: Record<InvestigationStatus, string> = {
  draft: "",
  in_progress: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  review: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  published: "bg-green-500/10 text-green-600 border-green-500/20",
  archived: "bg-muted text-muted-foreground",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  finding: "Finding",
  note: "Note",
  external_link: "External Link",
  screenshot: "Screenshot",
  metadata_anomaly: "Metadata Anomaly",
  timeline_entry: "Timeline Entry",
  source_match: "Source Match",
  ai_detection: "AI Detection",
  provenance_check: "Provenance Check",
};
