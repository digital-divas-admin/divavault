import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const trackSelectionSchema = z.object({
  trackType: z.enum(["sfw", "nsfw"], {
    message: "Please select a track",
  }),
});

export const consentSchema = z.object({
  consentAge: z.literal(true, { message: "Required" }),
  consentAiTraining: z.literal(true, { message: "Required" }),
  consentLikeness: z.literal(true, { message: "Required" }),
  consentRevocation: z.literal(true, { message: "Required" }),
  consentPrivacy: z.literal(true, { message: "Required" }),
  consentNsfw: z.literal(true, { message: "Required" }).optional(),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type TrackSelectionData = z.infer<typeof trackSelectionSchema>;
export type ConsentFormData = z.infer<typeof consentSchema>;
