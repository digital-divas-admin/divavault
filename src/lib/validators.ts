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

export const consentSchema = z.object({
  consentAge: z.literal(true, { message: "Required" }),
  consentAiTraining: z.literal(true, { message: "Required" }),
  consentLikeness: z.literal(true, { message: "Required" }),
  consentRevocation: z.literal(true, { message: "Required" }),
  consentPrivacy: z.literal(true, { message: "Required" }),
});

export const profileSchema = z.object({
  hairColor: z.string().min(1, { message: "Please select your hair color" }).nullable(),
  eyeColor: z.string().min(1, { message: "Please select your eye color" }).nullable(),
  skinTone: z.string().min(1, { message: "Please select your skin tone" }).nullable(),
  bodyType: z.string().min(1, { message: "Please select your body type" }).nullable(),
  ageRange: z.enum(["18-24", "25-34", "35-44", "45-54", "55+"], { message: "Please select your age range" }),
  gender: z.string().min(1, { message: "Please select your gender" }),
  ethnicity: z.string().optional().nullable(),
  selfDescription: z.string().max(500).optional().nullable(),
});

export const consentConfigSchema = z.object({
  // Core consents (required)
  consentAge: z.literal(true, { message: "Required" }),
  consentAiTraining: z.literal(true, { message: "Required" }),
  consentLikeness: z.literal(true, { message: "Required" }),
  consentRevocation: z.literal(true, { message: "Required" }),
  consentPrivacy: z.literal(true, { message: "Required" }),
  // Granular usage categories (optional toggles, default true)
  allowCommercial: z.boolean(),
  allowEditorial: z.boolean(),
  allowEntertainment: z.boolean(),
  allowELearning: z.boolean(),
  // Restrictions
  geoRestrictions: z.array(z.string()),
  contentExclusions: z.array(z.string()),
  // Consent version
  consentVersion: z.string(),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ConsentFormData = z.infer<typeof consentSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type ConsentConfigFormData = z.infer<typeof consentConfigSchema>;
