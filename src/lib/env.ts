// Validated at build time (available via NEXT_PUBLIC_ prefix)
const buildTime = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

for (const key of buildTime) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Validated at runtime only (server secrets aren't available during static build)
export function validateServerEnv() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
}
