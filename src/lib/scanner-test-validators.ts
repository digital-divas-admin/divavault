import { z } from "zod";

const tierEnum = z.enum(["free", "protected", "premium"], {
  message: "Invalid tier",
});
export type SubscriptionTier = z.infer<typeof tierEnum>;

export const resetEmbeddingsSchema = z.object({
  contributorId: z.string().uuid({ message: "Invalid contributor ID" }),
});

export const triggerScanSchema = z.object({
  contributorId: z.string().uuid({ message: "Invalid contributor ID" }),
  scanType: z
    .enum(["face_match", "reverse_image", "ai_detection"], {
      message: "Invalid scan type",
    })
    .optional(),
});

export const seedTestDataSchema = z.object({
  contributorId: z.string().uuid({ message: "Invalid contributor ID" }),
});

export const cleanTestDataSchema = z.object({
  contributorId: z.string().uuid({ message: "Invalid contributor ID" }),
});

export const toggleCrawlSchema = z.object({
  platform: z.string().min(1, { message: "Platform is required" }),
  enabled: z.boolean({ message: "Enabled must be a boolean" }),
});

export const triggerCrawlSchema = z.object({
  platform: z.string().min(1, { message: "Platform is required" }),
});

export const changeTierSchema = z.object({
  contributorId: z.string().uuid({ message: "Invalid contributor ID" }),
  tier: tierEnum,
});

export const autoHoneypotSchema = z.object({
  count: z
    .number()
    .int({ message: "Count must be an integer" })
    .min(1, { message: "Count must be at least 1" })
    .max(100, { message: "Count must be at most 100" }),
  platform: z.string().min(1).optional(),
});

export const seedContributorSchema = z.object({
  full_name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Valid email required" }),
  photo_paths: z
    .array(
      z.object({
        bucket: z.string(),
        file_path: z.string(),
      })
    )
    .min(1, { message: "At least one photo required" }),
  subscription_tier: tierEnum.default("premium"),
});

export type SeedContributorData = z.infer<typeof seedContributorSchema>;
export type AutoHoneypotData = z.infer<typeof autoHoneypotSchema>;
export type ResetEmbeddingsData = z.infer<typeof resetEmbeddingsSchema>;
export type TriggerScanData = z.infer<typeof triggerScanSchema>;
export type SeedTestDataData = z.infer<typeof seedTestDataSchema>;
export type CleanTestDataData = z.infer<typeof cleanTestDataSchema>;
export type ToggleCrawlData = z.infer<typeof toggleCrawlSchema>;
export type TriggerCrawlData = z.infer<typeof triggerCrawlSchema>;
export type ChangeTierData = z.infer<typeof changeTierSchema>;
