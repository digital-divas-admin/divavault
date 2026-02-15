/**
 * CID (Consented Identity) generation and validation.
 * Format: CID-1 followed by 16 lowercase hex characters (e.g., CID-1a8f3e2b7c9d0f14).
 */

/**
 * Generate a CID from a seed string.
 * Uses SHA-256 of seed + timestamp + random bytes, takes first 16 hex chars.
 */
export async function generateCID(seed: string): Promise<string> {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const input = `${seed}${Date.now()}${randomHex}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fullHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `CID-1${fullHex.slice(0, 16)}`;
}

/**
 * Validate that a string matches the CID format.
 */
export function validateCID(cid: string): boolean {
  return /^CID-1[0-9a-f]{16}$/.test(cid);
}
