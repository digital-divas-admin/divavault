import { z } from "zod";

export const requestFiltersSchema = z.object({
  search: z.string().optional().default(""),
  category: z
    .enum([
      "all",
      "portrait",
      "full_body",
      "lifestyle",
      "fashion",
      "fitness",
      "artistic",
      "professional",
      "casual",
      "themed",
      "other",
    ])
    .optional()
    .default("all"),
  trackType: z.enum(["all", "sfw", "nsfw", "both"]).optional().default("all"),
  sortBy: z
    .enum(["newest", "deadline", "highest_pay"])
    .optional()
    .default("newest"),
});

export const createSubmissionSchema = z.object({
  requestId: z.string().uuid({ message: "Invalid request ID" }),
});

export const submitSubmissionSchema = z.object({
  action: z.enum(["submit", "withdraw"], { message: "Invalid action" }),
});

export const addImageSchema = z.object({
  filePath: z.string().min(1, { message: "File path is required" }),
  bucket: z.string().min(1, { message: "Bucket is required" }),
  fileSize: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  caption: z.string().max(500, { message: "Caption too long" }).optional(),
});

export const bookmarkSchema = z.object({
  requestId: z.string().uuid({ message: "Invalid request ID" }),
  action: z.enum(["add", "remove"], { message: "Invalid action" }),
});

export const reportSchema = z.object({
  requestId: z.string().uuid({ message: "Invalid request ID" }),
  reason: z.enum(
    ["uncomfortable", "discriminatory", "inappropriate", "misleading", "other"],
    { message: "Please select a reason" }
  ),
  details: z.string().max(1000).optional(),
});

// Admin validators
export const createRequestSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Title must be at least 5 characters" })
    .max(200),
  description: z
    .string()
    .min(20, { message: "Description must be at least 20 characters" })
    .max(5000),
  modelContext: z.string().max(2000).optional(),
  category: z.enum(
    [
      "portrait",
      "full_body",
      "lifestyle",
      "fashion",
      "fitness",
      "artistic",
      "professional",
      "casual",
      "themed",
      "other",
    ],
    { message: "Please select a category" }
  ),
  trackType: z.enum(["sfw", "nsfw", "both"], {
    message: "Please select a track type",
  }),
  payType: z.enum(["per_image", "per_set"], {
    message: "Please select a pay type",
  }),
  payAmountCents: z
    .number()
    .int()
    .min(100, { message: "Minimum pay is $1.00" }),
  setSize: z.number().int().min(1).optional(),
  speedBonusCents: z.number().int().min(0).optional().default(0),
  speedBonusDeadline: z.string().optional(),
  qualityBonusCents: z.number().int().min(0).optional().default(0),
  budgetTotalCents: z
    .number()
    .int()
    .min(1000, { message: "Minimum budget is $10.00" }),
  quantityNeeded: z
    .number()
    .int()
    .min(1, { message: "At least 1 item needed" }),
  minResolutionWidth: z.number().int().min(256).optional().default(1024),
  minResolutionHeight: z.number().int().min(256).optional().default(1024),
  qualityGuidelines: z.string().max(5000).optional(),
  estimatedEffort: z.string().max(200).optional(),
  visibility: z.enum(["open", "targeted", "invite_only"]).optional().default("open"),
  deadline: z.string().optional(),
  scenarioTags: z.array(z.string()).optional().default([]),
  settingTags: z.array(z.string()).optional().default([]),
  status: z
    .enum(["draft", "published"])
    .optional()
    .default("draft"),
}).refine(
  (data) => data.payType !== "per_set" || (data.setSize !== undefined && data.setSize > 0),
  { message: "Set size is required when pay type is per set", path: ["setSize"] }
);

export const reviewSubmissionSchema = z.object({
  action: z.enum(["accept", "reject", "revision_requested"], {
    message: "Invalid review action",
  }),
  feedback: z.string().max(2000).optional(),
  awardQualityBonus: z.boolean().optional().default(false),
});

export type RequestFiltersData = z.infer<typeof requestFiltersSchema>;
export type CreateSubmissionData = z.infer<typeof createSubmissionSchema>;
export type SubmitSubmissionData = z.infer<typeof submitSubmissionSchema>;
export type AddImageData = z.infer<typeof addImageSchema>;
export type BookmarkData = z.infer<typeof bookmarkSchema>;
export type ReportData = z.infer<typeof reportSchema>;
export type CreateRequestData = z.infer<typeof createRequestSchema>;
export type ReviewSubmissionData = z.infer<typeof reviewSubmissionSchema>;
