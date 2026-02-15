/**
 * Zod v4 schemas for registry consent validation.
 */

import { z } from "zod";

/** Validates CID format: CID-1 followed by 16 lowercase hex characters */
export const cidSchema = z
  .string()
  .regex(/^CID-1[0-9a-f]{16}$/, { message: "Invalid CID format" });

/** Validates ConsentScope JSONB structure */
export const consentScopeSchema = z.object({
  spec_version: z.string().optional(),
  use_types: z.record(z.string(), z.boolean()).optional(),
  geographic_scope: z
    .object({
      type: z.enum(["allowlist", "blocklist"]),
      regions: z.array(z.string()),
    })
    .optional(),
  content_exclusions: z.array(z.string()).optional(),
  modalities: z.record(z.string(), z.boolean()).optional(),
  temporal: z
    .object({
      valid_from: z.string(),
      valid_until: z.string().nullable(),
      auto_renew: z.boolean(),
    })
    .optional(),
  revocation_reason: z.string().optional(),
});

/** Validates input for bulk CID lookup */
export const bulkLookupSchema = z.object({
  cids: z.array(cidSchema)
    .min(1, { message: "At least one CID required" })
    .max(100, { message: "Maximum 100 CIDs per request" }),
});

/** Validates input for bulk consent check */
export const bulkConsentSchema = z.object({
  cids: z.array(cidSchema)
    .min(1, { message: "At least one CID required" })
    .max(100, { message: "Maximum 100 CIDs per request" }),
  use_type: z.string().optional(),
  region: z.string().max(10, { message: "Region code too long" }).optional(),
  modality: z.string().optional(),
});

/** Validates input for creating a new consent event */
export const consentEventInputSchema = z.object({
  cid: cidSchema,
  eventType: z.enum(["grant", "modify", "restrict", "revoke", "reinstate"], {
    message: "Invalid event type",
  }),
  consentScope: consentScopeSchema,
  source: z.enum(["onboarding", "dashboard", "api", "admin", "system"], {
    message: "Invalid source",
  }),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  legacyConsentId: z.string().nullable().optional(),
});
