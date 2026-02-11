import { z } from "zod";

export const seedTestUsersSchema = z.object({
  count: z.number().int().min(1).max(20).default(1),
  withPhotos: z.boolean().default(false),
  withMatches: z.boolean().default(false),
  tier: z.enum(["free", "protected", "premium"]).default("free"),
});

export type SeedTestUsersData = z.infer<typeof seedTestUsersSchema>;
