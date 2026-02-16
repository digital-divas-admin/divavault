import { z } from "zod";

// ---------------------------------------------------------------------------
// Opt-out request schemas (Zod v4)
// ---------------------------------------------------------------------------

/** Schema for sending an opt-out notice to a single company. */
export const sendOptOutSchema = z.object({
  company_slug: z.string().min(1, { message: "Company is required" }),
});

export type SendOptOutInput = z.infer<typeof sendOptOutSchema>;

/** Schema for manually completing an opt-out (web form / account settings). */
export const completeOptOutSchema = z.object({
  company_slug: z.string().min(1, { message: "Company is required" }),
  notes: z.string().optional(),
});

export type CompleteOptOutInput = z.infer<typeof completeOptOutSchema>;

/** Schema for recording a company's response to an opt-out request. */
export const recordResponseSchema = z.object({
  request_id: z.string().uuid({ message: "Valid request ID required" }),
  response_text: z.string().min(1, { message: "Response text is required" }),
  communication_type: z.enum(["response", "confirmation", "denial"], {
    message: "Invalid communication type",
  }),
});

export type RecordResponseInput = z.infer<typeof recordResponseSchema>;

/** Schema for sending opt-out notices to all remaining companies at once. */
export const sendBatchSchema = z.object({}).optional();

export type SendBatchInput = z.infer<typeof sendBatchSchema>;
