"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";

const sections = [
  { id: "auth", label: "Authentication" },
  { id: "consent-oracle", label: "Consent Oracle" },
  { id: "bulk-lookup", label: "Bulk Lookup" },
  { id: "bulk-consent", label: "Bulk Consent" },
  { id: "single-identity", label: "Single Identity" },
  { id: "single-consent", label: "Single Consent" },
  { id: "stats", label: "Registry Stats" },
  { id: "webhooks", label: "Webhooks" },
  { id: "consent-spec", label: "Consent Spec v0.1" },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-900 rounded-lg p-4 font-mono text-sm overflow-x-auto text-zinc-300">
      <code>{children}</code>
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return method === "GET" ? (
    <Badge
      variant="outline"
      className="bg-green-500/10 text-green-400 border-green-500/20"
    >
      GET
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="bg-blue-500/10 text-blue-400 border-blue-500/20"
    >
      POST
    </Badge>
  );
}

function ParamRow({
  name,
  type,
  required,
  description,
}: {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-zinc-800 last:border-b-0">
      <div className="flex items-center gap-2 sm:w-48 shrink-0">
        <InlineCode>{name}</InlineCode>
        {required && (
          <span className="text-xs text-red-400 font-medium">required</span>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        <span className="text-zinc-500 mr-2">{type}</span>
        {description}
      </div>
    </div>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl text-foreground scroll-mt-24"
    >
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  Section content renderers                                          */
/* ------------------------------------------------------------------ */

function AuthSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="auth">Authentication</SectionHeading>
      <p className="text-muted-foreground">
        All API requests must include an API key in the{" "}
        <InlineCode>Authorization</InlineCode> header using the Bearer scheme.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>API Key Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock>{`mou_live_{64 hex characters}`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            API keys are issued per-platform and scoped to specific permissions.
            Store them securely and never expose them in client-side code.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authorization Header</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock>{`Authorization: Bearer mou_live_a1b2c3d4e5f6...`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Scopes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-3 py-2 border-b border-zinc-800">
              <InlineCode>registry:read</InlineCode>
              <span className="text-sm text-muted-foreground">
                Look up identities and registry statistics
              </span>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-zinc-800">
              <InlineCode>registry:consent:read</InlineCode>
              <span className="text-sm text-muted-foreground">
                Check consent status for a given identity
              </span>
            </div>
            <div className="flex items-start gap-3 py-2">
              <InlineCode>webhooks:manage</InlineCode>
              <span className="text-sm text-muted-foreground">
                Create, update, and delete webhook subscriptions
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentOracleSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="consent-oracle">Consent Oracle</SectionHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method="GET" />
        <InlineCode>/api/platform/v1/registry/consent/check</InlineCode>
      </div>
      <p className="text-muted-foreground">
        The primary endpoint for checking whether a specific identity has granted
        consent for a given use case. Use this before training on or generating
        content with a person&apos;s likeness.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Query Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <ParamRow
            name="cid"
            type="string"
            required
            description="The contributor identity ID to check consent for."
          />
          <ParamRow
            name="use_type"
            type="string"
            description='Type of use: "commercial", "editorial", "entertainment", or "elearning".'
          />
          <ParamRow
            name="region"
            type="string"
            description='ISO 3166-1 alpha-2 region code (e.g. "US", "GB").'
          />
          <ParamRow
            name="modality"
            type="string"
            description='Content modality: "face", "voice", or "body".'
          />
          <ParamRow
            name="verify"
            type="boolean"
            description="When true, performs on-chain consent verification. Defaults to false."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Example Request</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`curl -X GET \\
  "https://api.madeofus.ai/api/platform/v1/registry/consent/check?cid=cid_abc123&use_type=commercial&region=US&modality=face" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "allowed": true,
  "cid": "cid_abc123",
  "use_type": "commercial",
  "region": "US",
  "modality": "face",
  "consent_status": "active",
  "checked_at": "2025-01-15T10:30:00Z",
  "chain_verified": false
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function BulkLookupSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="bulk-lookup">Bulk Lookup</SectionHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method="POST" />
        <InlineCode>/api/platform/v1/registry/batch/lookup</InlineCode>
      </div>
      <p className="text-muted-foreground">
        Look up multiple identities in a single request. Useful for batch
        processing pipelines that need to verify whether identities exist in the
        registry.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Request Body</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock>{`{
  "cids": ["cid_abc123", "cid_def456", "cid_ghi789"]
}`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            Maximum of <strong>100</strong> CIDs per request.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "results": {
    "cid_abc123": {
      "found": true,
      "status": "verified",
      "consent_status": "active"
    },
    "cid_def456": {
      "found": true,
      "status": "pending",
      "consent_status": "not_set"
    },
    "cid_ghi789": {
      "found": false
    }
  },
  "meta": {
    "total": 3,
    "found": 2,
    "not_found": 1
  }
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function BulkConsentSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="bulk-consent">Bulk Consent Check</SectionHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method="POST" />
        <InlineCode>/api/platform/v1/registry/batch/consent</InlineCode>
      </div>
      <p className="text-muted-foreground">
        Check consent for multiple identities at once. Accepts optional
        filtering by use type, region, and modality applied uniformly across all
        CIDs.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Request Body</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock>{`{
  "cids": ["cid_abc123", "cid_def456"],
  "use_type": "commercial",
  "region": "US",
  "modality": "face"
}`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            Maximum of <strong>100</strong> CIDs per request. The{" "}
            <InlineCode>use_type</InlineCode>,{" "}
            <InlineCode>region</InlineCode>, and{" "}
            <InlineCode>modality</InlineCode> fields are optional.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "results": {
    "cid_abc123": {
      "allowed": true,
      "consent_status": "active"
    },
    "cid_def456": {
      "allowed": false,
      "consent_status": "revoked"
    }
  },
  "meta": {
    "total": 2,
    "allowed": 1,
    "denied": 1,
    "not_found": 0
  }
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function SingleIdentitySection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="single-identity">Single Identity</SectionHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method="GET" />
        <InlineCode>{`/api/registry/identity/{cid}`}</InlineCode>
      </div>
      <p className="text-muted-foreground">
        Retrieve details for a single registered identity, including
        verification status and timestamps.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Example Request</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`curl -X GET \\
  "https://api.madeofus.ai/api/registry/identity/cid_abc123" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "cid": "cid_abc123",
  "status": "verified",
  "created_at": "2025-01-10T08:00:00Z",
  "verified_at": "2025-01-10T08:15:00Z",
  "updated_at": "2025-01-12T14:30:00Z"
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function SingleConsentSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="single-consent">Single Consent</SectionHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method="GET" />
        <InlineCode>{`/api/registry/identity/{cid}/consent`}</InlineCode>
      </div>
      <p className="text-muted-foreground">
        Retrieve the current consent scope and event history summary for a
        specific identity.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Example Request</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`curl -X GET \\
  "https://api.madeofus.ai/api/registry/identity/cid_abc123/consent" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "cid": "cid_abc123",
  "consent_status": "active",
  "scope": {
    "use_types": {
      "commercial": true,
      "editorial": true,
      "entertainment": false,
      "elearning": true
    },
    "geographic_scope": {
      "type": "allowlist",
      "regions": ["US", "GB", "CA"]
    },
    "modalities": {
      "face": true,
      "voice": false,
      "body": true
    }
  },
  "event_count": 4,
  "last_updated": "2025-01-14T12:00:00Z"
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="stats">Registry Stats</SectionHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method="GET" />
        <InlineCode>/api/platform/v1/registry/stats</InlineCode>
      </div>
      <p className="text-muted-foreground">
        Returns aggregate statistics about the registry, including total
        identities, verification counts, and consent event totals.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Example Request</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`curl -X GET \\
  "https://api.madeofus.ai/api/platform/v1/registry/stats" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "total_identities": 12847,
  "verified_count": 11203,
  "claimed_count": 1644,
  "total_consent_events": 38291,
  "active_consents": 10856,
  "revoked_consents": 347
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function WebhooksSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="webhooks">Webhooks</SectionHeading>
      <p className="text-muted-foreground">
        Subscribe to real-time events from the registry. Webhooks are delivered
        as <InlineCode>POST</InlineCode> requests to your specified endpoint
        with an HMAC-SHA256 signature for verification.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-3 py-2 border-b border-zinc-800">
              <InlineCode>registry.identity_created</InlineCode>
              <span className="text-sm text-muted-foreground">
                A new identity has been registered in the system
              </span>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-zinc-800">
              <InlineCode>registry.consent_updated</InlineCode>
              <span className="text-sm text-muted-foreground">
                An identity&apos;s consent scope has been modified
              </span>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-zinc-800">
              <InlineCode>registry.consent_revoked</InlineCode>
              <span className="text-sm text-muted-foreground">
                An identity has revoked their consent entirely
              </span>
            </div>
            <div className="flex items-start gap-3 py-2 border-b border-zinc-800">
              <InlineCode>contributor.verified</InlineCode>
              <span className="text-sm text-muted-foreground">
                A contributor has completed identity verification
              </span>
            </div>
            <div className="flex items-start gap-3 py-2">
              <InlineCode>contributor.onboarded</InlineCode>
              <span className="text-sm text-muted-foreground">
                A contributor has completed the full onboarding flow
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signature Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Every webhook request includes an{" "}
            <InlineCode>X-Webhook-Signature</InlineCode> header containing an
            HMAC-SHA256 signature of the request body. Verify this signature
            using your webhook secret to ensure the request originated from Made
            Of Us.
          </p>
          <CodeBlock>{`const crypto = require("crypto");

function verifyWebhookSignature(body, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscribe to Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <MethodBadge method="POST" />
            <InlineCode>/api/platform/v1/webhooks</InlineCode>
          </div>
          <CodeBlock>{`curl -X POST \\
  "https://api.madeofus.ai/api/platform/v1/webhooks" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-platform.com/webhooks/madeofus",
    "events": [
      "registry.consent_updated",
      "registry.consent_revoked"
    ],
    "secret": "your_webhook_secret_here"
  }'`}</CodeBlock>
          <CodeBlock>{`{
  "id": "wh_abc123",
  "url": "https://your-platform.com/webhooks/madeofus",
  "events": [
    "registry.consent_updated",
    "registry.consent_revoked"
  ],
  "active": true,
  "created_at": "2025-01-15T10:00:00Z"
}`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentSpecSection() {
  return (
    <div className="space-y-6">
      <SectionHeading id="consent-spec">Consent Spec v0.1</SectionHeading>
      <p className="text-muted-foreground">
        The <InlineCode>ConsentScope</InlineCode> object defines the full
        structure of a contributor&apos;s consent preferences. This is the
        canonical format used across all API responses and webhook payloads.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>ConsentScope Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`{
  "spec_version": "0.1",
  "use_types": {
    "commercial": true,
    "editorial": true,
    "entertainment": false,
    "elearning": true
  },
  "geographic_scope": {
    "type": "allowlist",   // "allowlist" | "blocklist"
    "regions": ["US", "GB", "CA", "AU"]
  },
  "content_exclusions": [
    "adult",
    "political",
    "tobacco"
  ],
  "modalities": {
    "face": true,
    "voice": false,
    "body": true
  },
  "temporal": {
    "valid_from": "2025-01-01T00:00:00Z",
    "valid_until": "2026-01-01T00:00:00Z",
    "auto_renew": true
  }
}`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Field Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <ParamRow
              name="spec_version"
              type="string"
              required
              description='The version of the consent spec. Currently "0.1".'
            />
            <ParamRow
              name="use_types"
              type="object"
              required
              description="Boolean flags for each allowed use category: commercial, editorial, entertainment, elearning."
            />
            <ParamRow
              name="geographic_scope"
              type="object"
              required
              description='Defines allowed or blocked regions. "type" is either "allowlist" or "blocklist". "regions" is an array of ISO 3166-1 alpha-2 codes.'
            />
            <ParamRow
              name="content_exclusions"
              type="string[]"
              required
              description="Categories of content the contributor has explicitly excluded (e.g. adult, political, tobacco, gambling)."
            />
            <ParamRow
              name="modalities"
              type="object"
              required
              description="Boolean flags indicating which likeness modalities are consented: face, voice, body."
            />
            <ParamRow
              name="temporal"
              type="object"
              required
              description="Time-bound consent window. Includes valid_from (ISO 8601), valid_until (ISO 8601), and auto_renew (boolean)."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section map                                                        */
/* ------------------------------------------------------------------ */

const sectionComponents: Record<string, React.FC> = {
  auth: AuthSection,
  "consent-oracle": ConsentOracleSection,
  "bulk-lookup": BulkLookupSection,
  "bulk-consent": BulkConsentSection,
  "single-identity": SingleIdentitySection,
  "single-consent": SingleConsentSection,
  stats: StatsSection,
  webhooks: WebhooksSection,
  "consent-spec": ConsentSpecSection,
};

/* ------------------------------------------------------------------ */
/*  Full API reference as markdown (for copy / download)               */
/* ------------------------------------------------------------------ */

const FULL_API_MARKDOWN = `# Made Of Us — API Reference

## Authentication

All API requests must include an API key in the \`Authorization\` header using the Bearer scheme.

### API Key Format

\`\`\`
mou_live_{64 hex characters}
\`\`\`

API keys are issued per-platform and scoped to specific permissions. Store them securely and never expose them in client-side code.

### Authorization Header

\`\`\`
Authorization: Bearer mou_live_a1b2c3d4e5f6...
\`\`\`

### Available Scopes

| Scope | Description |
|-------|-------------|
| \`registry:read\` | Look up identities and registry statistics |
| \`registry:consent:read\` | Check consent status for a given identity |
| \`webhooks:manage\` | Create, update, and delete webhook subscriptions |

---

## Consent Oracle

**GET** \`/api/platform/v1/registry/consent/check\`

The primary endpoint for checking whether a specific identity has granted consent for a given use case. Use this before training on or generating content with a person's likeness.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`cid\` | string | Yes | The contributor identity ID to check consent for |
| \`use_type\` | string | No | Type of use: "commercial", "editorial", "entertainment", or "elearning" |
| \`region\` | string | No | ISO 3166-1 alpha-2 region code (e.g. "US", "GB") |
| \`modality\` | string | No | Content modality: "face", "voice", or "body" |
| \`verify\` | boolean | No | When true, performs on-chain consent verification. Defaults to false |

### Example Request

\`\`\`bash
curl -X GET \\
  "https://api.madeofus.ai/api/platform/v1/registry/consent/check?cid=CID-1a8f3e2b7c9d0f14&use_type=commercial&region=US&modality=face" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."
\`\`\`

### Response

\`\`\`json
{
  "allowed": true,
  "cid": "CID-1a8f3e2b7c9d0f14",
  "use_type": "commercial",
  "region": "US",
  "modality": "face",
  "consent_status": "active",
  "checked_at": "2025-01-15T10:30:00Z",
  "chain_verified": false
}
\`\`\`

---

## Bulk Lookup

**POST** \`/api/platform/v1/registry/batch/lookup\`

**Scope:** \`registry:read\`

Look up multiple identities in a single request. Useful for batch processing pipelines that need to verify whether identities exist in the registry.

### Request Body

\`\`\`json
{
  "cids": ["CID-1a8f3e2b7c9d0f14", "CID-1def456789abcdef", "CID-1ghi789012345678"]
}
\`\`\`

Maximum of 100 CIDs per request.

### Response

\`\`\`json
{
  "results": {
    "CID-1a8f3e2b7c9d0f14": {
      "found": true,
      "status": "verified",
      "consent_status": "active"
    },
    "CID-1def456789abcdef": {
      "found": true,
      "status": "claimed",
      "consent_status": "no_events"
    },
    "CID-1ghi789012345678": {
      "found": false
    }
  },
  "meta": {
    "total": 3,
    "found": 2,
    "not_found": 1
  }
}
\`\`\`

---

## Bulk Consent Check

**POST** \`/api/platform/v1/registry/batch/consent\`

**Scope:** \`registry:consent:read\`

Check consent for multiple identities at once. Accepts optional filtering by use type, region, and modality applied uniformly across all CIDs.

### Request Body

\`\`\`json
{
  "cids": ["CID-1a8f3e2b7c9d0f14", "CID-1def456789abcdef"],
  "use_type": "commercial",
  "region": "US",
  "modality": "face"
}
\`\`\`

Maximum of 100 CIDs per request. The \`use_type\`, \`region\`, and \`modality\` fields are optional.

### Response

\`\`\`json
{
  "results": {
    "CID-1a8f3e2b7c9d0f14": {
      "allowed": true,
      "consent_status": "active"
    },
    "CID-1def456789abcdef": {
      "allowed": false,
      "consent_status": "revoked"
    }
  },
  "meta": {
    "total": 2,
    "allowed": 1,
    "denied": 1,
    "not_found": 0
  }
}
\`\`\`

---

## Single Identity

**GET** \`/api/registry/identity/{cid}\`

**Scope:** \`registry:read\`

Retrieve details for a single registered identity, including verification status and timestamps.

### Example Request

\`\`\`bash
curl -X GET \\
  "https://api.madeofus.ai/api/registry/identity/CID-1a8f3e2b7c9d0f14" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."
\`\`\`

### Response

\`\`\`json
{
  "cid": "CID-1a8f3e2b7c9d0f14",
  "status": "verified",
  "created_at": "2025-01-10T08:00:00Z",
  "verified_at": "2025-01-10T08:15:00Z",
  "updated_at": "2025-01-12T14:30:00Z"
}
\`\`\`

---

## Single Consent

**GET** \`/api/registry/identity/{cid}/consent\`

**Scope:** \`registry:consent:read\`

Retrieve the current consent scope and event history summary for a specific identity.

### Example Request

\`\`\`bash
curl -X GET \\
  "https://api.madeofus.ai/api/registry/identity/CID-1a8f3e2b7c9d0f14/consent" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."
\`\`\`

### Response

\`\`\`json
{
  "cid": "CID-1a8f3e2b7c9d0f14",
  "consent_status": "active",
  "scope": {
    "use_types": {
      "commercial": true,
      "editorial": true,
      "entertainment": false,
      "elearning": true
    },
    "geographic_scope": {
      "type": "allowlist",
      "regions": ["US", "GB", "CA"]
    },
    "modalities": {
      "face": true,
      "voice": false,
      "body": true
    }
  },
  "event_count": 4,
  "last_updated": "2025-01-14T12:00:00Z"
}
\`\`\`

---

## Registry Stats

**GET** \`/api/platform/v1/registry/stats\`

**Scope:** \`registry:read\`

Returns aggregate statistics about the registry, including total identities, verification counts, and consent event totals.

### Example Request

\`\`\`bash
curl -X GET \\
  "https://api.madeofus.ai/api/platform/v1/registry/stats" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..."
\`\`\`

### Response

\`\`\`json
{
  "total_identities": 12847,
  "verified_count": 11203,
  "claimed_count": 1644,
  "total_consent_events": 38291,
  "active_consents": 10856,
  "revoked_consents": 347
}
\`\`\`

---

## Webhooks

Subscribe to real-time events from the registry. Webhooks are delivered as POST requests to your specified endpoint with an HMAC-SHA256 signature for verification.

### Event Types

| Event | Description |
|-------|-------------|
| \`registry.identity_created\` | A new identity has been registered in the system |
| \`registry.consent_updated\` | An identity's consent scope has been modified |
| \`registry.consent_revoked\` | An identity has revoked their consent entirely |
| \`contributor.verified\` | A contributor has completed identity verification |
| \`contributor.onboarded\` | A contributor has completed the full onboarding flow |

### Signature Verification

Every webhook request includes an \`X-Webhook-Signature\` header containing an HMAC-SHA256 signature of the request body. Verify this signature using your webhook secret.

\`\`\`javascript
const crypto = require("crypto");

function verifyWebhookSignature(body, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
\`\`\`

### Subscribe to Webhooks

**POST** \`/api/platform/v1/webhooks\`

**Scope:** \`webhooks:manage\`

\`\`\`bash
curl -X POST \\
  "https://api.madeofus.ai/api/platform/v1/webhooks" \\
  -H "Authorization: Bearer mou_live_a1b2c3d4e5f6..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-platform.com/webhooks/madeofus",
    "events": [
      "registry.consent_updated",
      "registry.consent_revoked"
    ],
    "secret": "your_webhook_secret_here"
  }'
\`\`\`

### Response

\`\`\`json
{
  "id": "wh_abc123",
  "url": "https://your-platform.com/webhooks/madeofus",
  "events": [
    "registry.consent_updated",
    "registry.consent_revoked"
  ],
  "active": true,
  "created_at": "2025-01-15T10:00:00Z"
}
\`\`\`

---

## Consent Spec v0.1

The \`ConsentScope\` object defines the full structure of a contributor's consent preferences. This is the canonical format used across all API responses and webhook payloads.

### ConsentScope Structure

\`\`\`json
{
  "spec_version": "0.1",
  "use_types": {
    "commercial": true,
    "editorial": true,
    "entertainment": false,
    "elearning": true
  },
  "geographic_scope": {
    "type": "allowlist",
    "regions": ["US", "GB", "CA", "AU"]
  },
  "content_exclusions": [
    "adult",
    "political",
    "tobacco"
  ],
  "modalities": {
    "face": true,
    "voice": false,
    "body": true
  },
  "temporal": {
    "valid_from": "2025-01-01T00:00:00Z",
    "valid_until": "2026-01-01T00:00:00Z",
    "auto_renew": true
  }
}
\`\`\`

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| \`spec_version\` | string | The version of the consent spec. Currently "0.1" |
| \`use_types\` | object | Boolean flags for each allowed use category: commercial, editorial, entertainment, elearning |
| \`geographic_scope\` | object | Defines allowed or blocked regions. "type" is "allowlist" or "blocklist". "regions" is an array of ISO 3166-1 alpha-2 codes |
| \`content_exclusions\` | string[] | Categories of content the contributor has explicitly excluded (e.g. adult, political, tobacco, gambling) |
| \`modalities\` | object | Boolean flags indicating which likeness modalities are consented: face, voice, body |
| \`temporal\` | object | Time-bound consent window. Includes valid_from (ISO 8601), valid_until (ISO 8601), and auto_renew (boolean) |
`;

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ApiReference() {
  const [activeSection, setActiveSection] = useState("auth");
  const [copied, setCopied] = useState(false);

  const handleNavClick = useCallback(
    (id: string) => {
      setActiveSection(id);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    []
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(FULL_API_MARKDOWN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([FULL_API_MARKDOWN], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "madeofus-api-reference.md";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* LLM-friendly export bar */}
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Feed this entire API reference to your LLM
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Copy or download the full docs as markdown — paste into ChatGPT, Claude, or any AI assistant for integration help.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy All"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download .md
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile horizontal nav */}
      <div className="lg:hidden mb-8 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max pb-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleNavClick(section.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeSection === section.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-zinc-800/50 text-muted-foreground hover:text-foreground border border-zinc-700/50"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-10">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              API Reference
            </p>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleNavClick(section.id)}
                className={`block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activeSection === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-zinc-800/50"
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-16">
          {sections.map((section) => {
            const Component = sectionComponents[section.id];
            return Component ? <Component key={section.id} /> : null;
          })}
        </div>
      </div>
    </div>
  );
}
