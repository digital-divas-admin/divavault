export interface SsoClient {
  clientId: string;
  clientSecretHash: string;
  allowedRedirectUris: string[];
  name: string;
  logoUrl: string;
}

async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClients(): SsoClient[] {
  const castmiSecret = process.env.CASTMI_CLIENT_SECRET;
  const castmiUrl = process.env.NEXT_PUBLIC_CASTMI_URL || "https://castmi.ai";

  if (!castmiSecret) return [];

  return [
    {
      clientId: process.env.CASTMI_CLIENT_ID || "castmi",
      // Secret is hashed at startup comparison time, not stored as plaintext
      clientSecretHash: "", // populated at verification time
      allowedRedirectUris: [
        `${castmiUrl}/api/auth/callback/madeofus`,
        `${castmiUrl}/auth/callback`,
      ],
      name: "castmi.ai",
      logoUrl: `${castmiUrl}/logo.svg`,
    },
  ];
}

export async function verifySsoClient(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<SsoClient | null> {
  const expectedSecret = process.env.CASTMI_CLIENT_SECRET;
  if (!expectedSecret) return null;

  const clients = getClients();
  const client = clients.find((c) => c.clientId === clientId);
  if (!client) return null;

  // Verify secret using constant-time comparison via hash
  const providedHash = await hashSecret(clientSecret);
  const expectedHash = await hashSecret(expectedSecret);
  if (providedHash !== expectedHash) return null;

  // Verify redirect URI is allowed
  if (!client.allowedRedirectUris.includes(redirectUri)) return null;

  return client;
}

export function getSsoClientByIdForDisplay(clientId: string): { name: string; logoUrl: string } | null {
  const clients = getClients();
  const client = clients.find((c) => c.clientId === clientId);
  if (!client) return null;
  return { name: client.name, logoUrl: client.logoUrl };
}

export function isValidRedirectUri(clientId: string, redirectUri: string): boolean {
  const clients = getClients();
  const client = clients.find((c) => c.clientId === clientId);
  if (!client) return false;
  return client.allowedRedirectUris.includes(redirectUri);
}
