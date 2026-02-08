/**
 * Generate a SHA-256 hash of the consent data for tamper-proof audit trail.
 * Uses Web Crypto API (available in both browser and Node.js 18+).
 */
export async function generateConsentHash(
  consentData: Record<string, unknown>
): Promise<string> {
  const sorted = JSON.stringify(consentData, Object.keys(consentData).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(sorted);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
