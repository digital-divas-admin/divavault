/**
 * Registry service: core operations for identities and consent events.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { generateCID } from "./cid";
import { computeEventHash, deriveCurrentConsent, verifyChain } from "./consent-chain";
import type {
  ConsentScope,
  RegistryIdentity,
  RegistryConsentEvent,
  RegistryVerification,
  RegistryContact,
  RegistryIdentityStatus,
  ConsentEventType,
  ConsentSource,
} from "@/types/registry";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Identity operations
// ---------------------------------------------------------------------------

export async function createRegistryIdentity({
  contributorId,
  sumsubApplicantId,
  verifiedAt,
  metadata,
}: {
  contributorId: string;
  sumsubApplicantId?: string | null;
  verifiedAt: string;
  metadata?: Record<string, unknown>;
}): Promise<RegistryIdentity> {
  const supabase = await createServiceClient();
  const cid = await generateCID(contributorId);

  const hasSumsub = !!sumsubApplicantId;
  const identityHash = await sha256(
    hasSumsub
      ? `${contributorId}:${sumsubApplicantId}`
      : `${contributorId}:onboarding`
  );

  const { data: identity, error: identityError } = await supabase
    .from("registry_identities")
    .insert({
      cid,
      status: "verified",
      identity_hash: identityHash,
      verified_at: verifiedAt,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (identityError) throw identityError;

  const { error: verificationError } = await supabase
    .from("registry_verifications")
    .insert({
      cid,
      method: hasSumsub ? "sumsub_full" : "onboarding_complete",
      provider: hasSumsub ? "sumsub" : null,
      provider_session_id: sumsubApplicantId || null,
      result: "passed",
    });

  if (verificationError) throw verificationError;

  const { error: contributorError } = await supabase
    .from("contributors")
    .update({ cid })
    .eq("id", contributorId);

  if (contributorError) throw contributorError;

  return identity as RegistryIdentity;
}

export async function createClaimedIdentity({
  selfiePath,
  metadata,
}: {
  selfiePath: string;
  metadata?: Record<string, unknown>;
}): Promise<RegistryIdentity> {
  const supabase = await createServiceClient();
  const cid = await generateCID(crypto.randomUUID());
  const identityHash = await sha256(selfiePath);

  const { data: identity, error: identityError } = await supabase
    .from("registry_identities")
    .insert({
      cid,
      status: "claimed",
      identity_hash: identityHash,
      face_embedding: null,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (identityError) throw identityError;

  const { error: verificationError } = await supabase
    .from("registry_verifications")
    .insert({
      cid,
      method: "selfie_liveness",
      result: "passed",
    });

  if (verificationError) throw verificationError;

  return identity as RegistryIdentity;
}

export async function addRegistryContact(
  cid: string,
  email: string
): Promise<RegistryContact> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("registry_contacts")
    .upsert(
      {
        cid,
        contact_type: "email",
        contact_value: email,
      },
      { onConflict: "cid,contact_type" }
    )
    .select()
    .single();

  if (error) throw error;

  return data as RegistryContact;
}

export async function getIdentityByCID(
  cid: string
): Promise<RegistryIdentity | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("registry_identities")
    .select()
    .eq("cid", cid)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }

  return data as RegistryIdentity;
}

export async function getIdentityByContributorId(
  contributorId: string
): Promise<RegistryIdentity | null> {
  const supabase = await createServiceClient();

  const { data: contributor, error: contribError } = await supabase
    .from("contributors")
    .select("cid")
    .eq("id", contributorId)
    .single();

  if (contribError) {
    if (contribError.code === "PGRST116") return null;
    throw contribError;
  }

  if (!contributor?.cid) return null;

  return getIdentityByCID(contributor.cid);
}

export async function updateIdentityStatus(
  cid: string,
  status: RegistryIdentityStatus
): Promise<void> {
  const supabase = await createServiceClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "suspended") {
    updateData.suspended_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("registry_identities")
    .update(updateData)
    .eq("cid", cid);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Consent operations
// ---------------------------------------------------------------------------

export async function recordConsentEvent({
  cid,
  eventType,
  consentScope,
  source,
  ipAddress,
  userAgent,
  legacyConsentId,
}: {
  cid: string;
  eventType: ConsentEventType;
  consentScope: ConsentScope;
  source: ConsentSource;
  ipAddress?: string | null;
  userAgent?: string | null;
  legacyConsentId?: string | null;
}): Promise<RegistryConsentEvent> {
  const supabase = await createServiceClient();

  // Get the chain head (most recent event for this CID)
  const { data: headEvents } = await supabase
    .from("registry_consent_events")
    .select()
    .eq("cid", cid)
    .order("recorded_at", { ascending: false })
    .limit(1);

  const previousEvent = headEvents?.[0] as RegistryConsentEvent | undefined;
  const previousEventHash = previousEvent?.event_hash ?? null;
  const previousEventId = previousEvent?.event_id ?? null;

  const evidenceHash = await sha256(JSON.stringify(consentScope));

  const eventData: Record<string, unknown> = {
    cid,
    event_type: eventType,
    consent_scope: consentScope,
    evidence_hash: evidenceHash,
    source,
  };

  const eventHash = await computeEventHash(eventData, previousEventHash);

  const { data, error } = await supabase
    .from("registry_consent_events")
    .insert({
      cid,
      event_type: eventType,
      consent_scope: consentScope,
      evidence_hash: evidenceHash,
      previous_event_id: previousEventId,
      event_hash: eventHash,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
      source,
      legacy_consent_id: legacyConsentId ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  return data as RegistryConsentEvent;
}

export async function getConsentHistory(
  cid: string
): Promise<RegistryConsentEvent[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("registry_consent_events")
    .select()
    .eq("cid", cid)
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as RegistryConsentEvent[];
}

export async function getCurrentConsent(
  cid: string
): Promise<ConsentScope | null> {
  const history = await getConsentHistory(cid);
  return deriveCurrentConsent(history);
}

export async function verifyConsentChain(
  cid: string
): Promise<{ valid: boolean; errors: string[] }> {
  const history = await getConsentHistory(cid);
  return verifyChain(history);
}

// ---------------------------------------------------------------------------
// Consent Oracle
// ---------------------------------------------------------------------------

export interface ConsentCheckResult {
  allowed: boolean;
  cid: string;
  use_type: string | null;
  region: string | null;
  modality: string | null;
  consent_status: "active" | "revoked" | "not_found";
  checked_at: string;
  chain_verified: boolean;
}

export async function checkConsent(
  cid: string,
  useType?: string,
  region?: string,
  modality?: string,
  verifyChainIntegrity?: boolean
): Promise<ConsentCheckResult> {
  const now = new Date().toISOString();
  const base = {
    cid,
    use_type: useType ?? null,
    region: region ?? null,
    modality: modality ?? null,
    checked_at: now,
    chain_verified: false,
  };

  const identity = await getIdentityByCID(cid);
  if (!identity) {
    return { ...base, allowed: false, consent_status: "not_found" };
  }

  if (identity.status === "suspended" || identity.status === "revoked") {
    return { ...base, allowed: false, consent_status: "revoked" };
  }

  const currentScope = await getCurrentConsent(cid);
  if (!currentScope) {
    return { ...base, allowed: false, consent_status: "revoked" };
  }

  if (verifyChainIntegrity) {
    const chain = await verifyConsentChain(cid);
    base.chain_verified = chain.valid;
    if (!chain.valid) {
      return { ...base, allowed: false, consent_status: "active" };
    }
  }

  // Check use_type
  if (useType && currentScope.use_types) {
    const normalized = useType.toLowerCase();
    if (!(normalized in currentScope.use_types)) {
      return { ...base, allowed: false, consent_status: "active" };
    }
    if (!currentScope.use_types[normalized]) {
      return { ...base, allowed: false, consent_status: "active" };
    }
  }

  // Check region
  if (region && currentScope.geographic_scope) {
    const normalizedRegion = region.toUpperCase();
    const { type, regions } = currentScope.geographic_scope;
    if (type === "blocklist" && regions.map(r => r.toUpperCase()).includes(normalizedRegion)) {
      return { ...base, allowed: false, consent_status: "active" };
    }
    if (type === "allowlist" && !regions.map(r => r.toUpperCase()).includes(normalizedRegion)) {
      return { ...base, allowed: false, consent_status: "active" };
    }
  }

  // Check modality
  if (modality && currentScope.modalities) {
    const normalized = modality.toLowerCase();
    if (normalized in currentScope.modalities && !currentScope.modalities[normalized]) {
      return { ...base, allowed: false, consent_status: "active" };
    }
  }

  // Check temporal validity
  if (currentScope.temporal) {
    const validFrom = new Date(currentScope.temporal.valid_from);
    if (new Date() < validFrom) {
      return { ...base, allowed: false, consent_status: "active" };
    }
    if (currentScope.temporal.valid_until) {
      const validUntil = new Date(currentScope.temporal.valid_until);
      if (new Date() > validUntil && !currentScope.temporal.auto_renew) {
        return { ...base, allowed: false, consent_status: "active" };
      }
    }
  }

  return { ...base, allowed: true, consent_status: "active" };
}

// ---------------------------------------------------------------------------
// Bulk Operations
// ---------------------------------------------------------------------------

export interface BulkLookupResult {
  results: Record<string, { found: boolean; status?: string; consent_status?: "active" | "revoked" | "no_events" }>;
  meta: { total: number; found: number; not_found: number };
}

export async function bulkLookup(cids: string[]): Promise<BulkLookupResult> {
  const supabase = await createServiceClient();

  const { data: identities, error: idError } = await supabase
    .from("registry_identities")
    .select("cid, status")
    .in("cid", cids);

  if (idError) throw idError;

  const identityMap = new Map(
    (identities ?? []).map((i: { cid: string; status: string }) => [i.cid, i.status])
  );

  // Get latest consent event per found CID
  const foundCids = (identities ?? []).map((i: { cid: string }) => i.cid);
  let consentMap = new Map<string, string>();

  if (foundCids.length > 0) {
    const { data: events, error: evError } = await supabase
      .from("registry_consent_events")
      .select("cid, event_type, recorded_at")
      .in("cid", foundCids)
      .order("recorded_at", { ascending: false });

    if (!evError && events) {
      const seen = new Set<string>();
      for (const ev of events as { cid: string; event_type: string }[]) {
        if (!seen.has(ev.cid)) {
          seen.add(ev.cid);
          consentMap.set(ev.cid, ev.event_type);
        }
      }
    }
  }

  const results: BulkLookupResult["results"] = {};
  let found = 0;
  let notFound = 0;

  for (const cid of cids) {
    const status = identityMap.get(cid);
    if (status) {
      found++;
      const latestEvent = consentMap.get(cid);
      const consentStatus = latestEvent
        ? (latestEvent === "revoke" ? "revoked" : "active")
        : "no_events";
      results[cid] = { found: true, status, consent_status: consentStatus };
    } else {
      notFound++;
      results[cid] = { found: false };
    }
  }

  return { results, meta: { total: cids.length, found, not_found: notFound } };
}

export interface BulkConsentResult {
  results: Record<string, { allowed: boolean; consent_status: "active" | "revoked" | "not_found" }>;
  meta: { total: number; allowed: number; denied: number; not_found: number };
}

export async function bulkConsentCheck(
  cids: string[],
  useType?: string,
  region?: string,
  modality?: string
): Promise<BulkConsentResult> {
  const checks = await Promise.all(
    cids.map((cid) => checkConsent(cid, useType, region, modality, false))
  );

  const results: BulkConsentResult["results"] = {};
  let allowed = 0;
  let denied = 0;
  let notFound = 0;

  for (const check of checks) {
    results[check.cid] = {
      allowed: check.allowed,
      consent_status: check.consent_status,
    };
    if (check.consent_status === "not_found") notFound++;
    else if (check.allowed) allowed++;
    else denied++;
  }

  return {
    results,
    meta: { total: cids.length, allowed, denied, not_found: notFound },
  };
}

// ---------------------------------------------------------------------------
// Registry Stats
// ---------------------------------------------------------------------------

export interface RegistryStats {
  total_identities: number;
  verified_count: number;
  claimed_count: number;
  total_consent_events: number;
  active_consents: number;
  revoked_consents: number;
}

export async function getRegistryStats(): Promise<RegistryStats> {
  const supabase = await createServiceClient();

  const [
    { count: totalIdentities },
    { count: verifiedCount },
    { count: claimedCount },
    { count: totalEvents },
    { data: consentStats },
  ] = await Promise.all([
    supabase.from("registry_identities").select("*", { count: "exact", head: true }),
    supabase.from("registry_identities").select("*", { count: "exact", head: true }).eq("status", "verified"),
    supabase.from("registry_identities").select("*", { count: "exact", head: true }).eq("status", "claimed"),
    supabase.from("registry_consent_events").select("*", { count: "exact", head: true }),
    supabase.rpc("registry_consent_stats"),
  ]);

  const stats = (consentStats as { active_consents: number; revoked_consents: number }[] | null)?.[0];

  return {
    total_identities: totalIdentities ?? 0,
    verified_count: verifiedCount ?? 0,
    claimed_count: claimedCount ?? 0,
    total_consent_events: totalEvents ?? 0,
    active_consents: stats?.active_consents ?? 0,
    revoked_consents: stats?.revoked_consents ?? 0,
  };
}
