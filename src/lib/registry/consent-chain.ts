/**
 * Consent chain: hash-linked event chain for tamper-proof consent history.
 */

import type {
  ConsentScope,
  RegistryConsentEvent,
  ConsentEventType,
} from "@/types/registry";

/** Flat consent form shape (from onboarding consent config) */
export interface ConsentFormLike {
  allowCommercial: boolean;
  allowEditorial: boolean;
  allowEntertainment: boolean;
  allowELearning: boolean;
  geoRestrictions: string[];
  contentExclusions: string[];
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute the hash for a consent event, chained to the previous event.
 * Hash = SHA-256(JSON.stringify(sorted eventData) + "|" + (previousHash || "GENESIS"))
 */
export async function computeEventHash(
  eventData: Record<string, unknown>,
  previousEventHash: string | null
): Promise<string> {
  const sorted = JSON.stringify(eventData, Object.keys(eventData).sort());
  const input = `${sorted}|${previousEventHash || "GENESIS"}`;
  return sha256(input);
}

/**
 * Map flat consent form data to a structured ConsentScope.
 */
export function buildConsentScope(consentData: ConsentFormLike): ConsentScope {
  return {
    spec_version: "0.1",
    use_types: {
      commercial: consentData.allowCommercial,
      editorial: consentData.allowEditorial,
      entertainment: consentData.allowEntertainment,
      elearning: consentData.allowELearning,
    },
    geographic_scope:
      consentData.geoRestrictions.length > 0
        ? { type: "blocklist", regions: consentData.geoRestrictions }
        : undefined,
    content_exclusions:
      consentData.contentExclusions.length > 0
        ? consentData.contentExclusions
        : undefined,
    modalities: {
      face: true,
      voice: true,
      body: true,
    },
    temporal: {
      valid_from: new Date().toISOString(),
      valid_until: null,
      auto_renew: true,
    },
  };
}

/**
 * Verify the integrity of a consent event chain.
 * Replays all events sorted by recorded_at and checks each event_hash.
 */
export async function verifyChain(
  events: RegistryConsentEvent[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  let previousHash: string | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    const eventData: Record<string, unknown> = {
      cid: event.cid,
      event_type: event.event_type,
      consent_scope: event.consent_scope,
      evidence_hash: event.evidence_hash,
      source: event.source,
    };

    const computed = await computeEventHash(eventData, previousHash);

    if (computed !== event.event_hash) {
      errors.push(
        `Event ${event.event_id} at index ${i}: hash mismatch (expected ${computed}, got ${event.event_hash})`
      );
    }

    previousHash = event.event_hash;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Derive the current effective consent by replaying all events chronologically.
 * Returns null if consent is fully revoked.
 */
export function deriveCurrentConsent(
  events: RegistryConsentEvent[]
): ConsentScope | null {
  const sorted = [...events].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  let currentScope: ConsentScope | null = null;

  for (const event of sorted) {
    const type: ConsentEventType = event.event_type;

    switch (type) {
      case "grant":
        currentScope = { ...event.consent_scope };
        break;

      case "modify":
        if (currentScope) {
          const base: ConsentScope = currentScope;
          currentScope = Object.assign({}, base, event.consent_scope, {
            use_types: Object.assign(
              {},
              base.use_types ?? {},
              event.consent_scope.use_types ?? {}
            ),
            modalities: Object.assign(
              {},
              base.modalities ?? {},
              event.consent_scope.modalities ?? {}
            ),
          });
        }
        break;

      case "restrict":
        if (currentScope) {
          // Narrow: only keep use_types that are true in both current and restriction
          const restrictedUseTypes: Record<string, boolean> = {};
          if (currentScope.use_types && event.consent_scope.use_types) {
            for (const key of Object.keys(currentScope.use_types)) {
              restrictedUseTypes[key] =
                currentScope.use_types[key] &&
                (event.consent_scope.use_types[key] ?? false);
            }
          }

          currentScope = Object.assign({}, currentScope, event.consent_scope, {
            use_types:
              Object.keys(restrictedUseTypes).length > 0
                ? restrictedUseTypes
                : currentScope.use_types,
          });
        }
        break;

      case "revoke":
        currentScope = null;
        break;

      case "reinstate":
        currentScope = { ...event.consent_scope };
        break;
    }
  }

  return currentScope;
}
