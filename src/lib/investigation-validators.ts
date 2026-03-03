import { z } from "zod";
import {
  INVESTIGATION_CATEGORIES,
  INVESTIGATION_STATUSES,
  INVESTIGATION_VERDICTS,
  EVIDENCE_TYPES,
  REVERSE_SEARCH_ENGINES,
} from "@/types/investigations";

// --- Investigation CRUD ---

export const createInvestigationSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(200),
  category: z.enum(INVESTIGATION_CATEGORIES),
  description: z.string().optional(),
  summary: z.string().optional(),
  source_urls: z.array(z.string().url({ message: "Invalid URL" })).optional(),
  geographic_context: z.string().optional(),
  date_first_seen: z.string().optional(),
});

export const updateInvestigationSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  category: z.enum(INVESTIGATION_CATEGORIES).optional(),
  status: z.enum(INVESTIGATION_STATUSES).optional(),
  verdict: z.enum(INVESTIGATION_VERDICTS).nullable().optional(),
  confidence_score: z.number().int().min(0).max(100).nullable().optional(),
  summary: z.string().nullable().optional(),
  methodology: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  source_urls: z.array(z.string().url()).optional(),
  geographic_context: z.string().nullable().optional(),
  date_first_seen: z.string().nullable().optional(),
  slug: z.string().min(1).max(200).optional(),
});

// --- Media ---

export const addMediaSchema = z.object({
  source_url: z.string().url({ message: "Valid URL required" }),
  platform: z.string().optional(),
  media_type: z.enum(["video", "image", "unknown"]).optional(),
});

// --- Frame annotation ---

export const annotateFrameSchema = z.object({
  admin_notes: z.string().nullable().optional(),
  has_artifacts: z.boolean().optional(),
  is_key_evidence: z.boolean().optional(),
  drawing_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

// --- Evidence ---

export const createEvidenceSchema = z.object({
  evidence_type: z.enum(EVIDENCE_TYPES),
  title: z.string().optional(),
  content: z.string().optional(),
  external_url: z.string().url().optional(),
  attachment_path: z.string().optional(),
  display_order: z.number().int().optional(),
});

export const updateEvidenceSchema = z.object({
  evidence_type: z.enum(EVIDENCE_TYPES).optional(),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  external_url: z.string().url().nullable().optional(),
  display_order: z.number().int().optional(),
});

// --- Reverse search result ---

export const addSearchResultSchema = z.object({
  frame_id: z.string().uuid().optional(),
  engine: z.enum(REVERSE_SEARCH_ENGINES),
  result_url: z.string().url(),
  result_domain: z.string().optional(),
  result_title: z.string().optional(),
  result_date: z.string().optional(),
  relevance_rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

// --- Automated analysis trigger ---

export const AUTOMATED_TASK_TYPES = [
  "reverse_search",
  "ai_detection",
  "check_provenance",
  "news_search",
  "wire_search",
] as const;

export const triggerAutomatedSearchSchema = z.object({
  task_types: z.array(z.enum(AUTOMATED_TASK_TYPES)).min(1, { message: "At least one task type required" }),
  frame_ids: z.array(z.string().uuid()).optional(),
});

export type TriggerAutomatedSearchInput = z.infer<typeof triggerAutomatedSearchSchema>;

export type CreateInvestigationInput = z.infer<typeof createInvestigationSchema>;
export type UpdateInvestigationInput = z.infer<typeof updateInvestigationSchema>;
export type AddMediaInput = z.infer<typeof addMediaSchema>;
export type AnnotateFrameInput = z.infer<typeof annotateFrameSchema>;
export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;
export type AddSearchResultInput = z.infer<typeof addSearchResultSchema>;
