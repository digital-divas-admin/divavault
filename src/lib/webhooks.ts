import { createServiceClient } from "@/lib/supabase/server";

export type WebhookEventType =
  | "contributor.onboarded"
  | "contributor.consent_updated"
  | "contributor.opted_out"
  | "contributor.photos_added"
  | "bounty.created"
  | "bounty.submission_reviewed"
  | "registry.identity_created"
  | "registry.consent_updated"
  | "registry.consent_revoked";

async function buildSignature(
  secret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function dispatchWebhook(
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = await createServiceClient();

  // Find all active endpoints subscribed to this event
  const { data: endpoints, error } = await supabase
    .from("platform_webhook_endpoints")
    .select("id, url, secret, events, api_key_id")
    .eq("is_active", true);

  if (error || !endpoints) return;

  const subscribedEndpoints = endpoints.filter((ep) =>
    (ep.events as string[]).includes(eventType)
  );

  if (subscribedEndpoints.length === 0) return;

  const body = JSON.stringify({
    event: eventType,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  for (const endpoint of subscribedEndpoints) {
    // Create delivery record
    const { data: delivery } = await supabase
      .from("platform_webhook_deliveries")
      .insert({
        endpoint_id: endpoint.id,
        event_type: eventType,
        payload: { event: eventType, data: payload },
        status: "pending",
        attempts: 0,
      })
      .select("id")
      .single();

    if (!delivery) continue;

    // Fire and forget — don't block the request
    sendWebhook(endpoint.url, endpoint.secret, body, delivery.id).catch(
      (err) => console.error("Webhook dispatch error:", err)
    );
  }
}

async function sendWebhook(
  url: string,
  secret: string,
  body: string,
  deliveryId: string
): Promise<void> {
  const supabase = await createServiceClient();
  const signature = await buildSignature(secret, body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Id": deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    await supabase
      .from("platform_webhook_deliveries")
      .update({
        status: response.ok ? "delivered" : "failed",
        response_status: response.status,
        response_body: (await response.text()).slice(0, 1000),
        delivered_at: new Date().toISOString(),
        attempts: 1,
        next_retry_at: response.ok
          ? null
          : new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("id", deliveryId);
  } catch (err) {
    await supabase
      .from("platform_webhook_deliveries")
      .update({
        status: "failed",
        response_body: err instanceof Error ? err.message : "Unknown error",
        attempts: 1,
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("id", deliveryId);
  }
}

export async function retryFailedDeliveries(): Promise<number> {
  const supabase = await createServiceClient();

  const { data: deliveries, error } = await supabase
    .from("platform_webhook_deliveries")
    .select("id, endpoint_id, payload, attempts")
    .eq("status", "failed")
    .lt("attempts", 5)
    .lte("next_retry_at", new Date().toISOString())
    .limit(50);

  if (error || !deliveries || deliveries.length === 0) return 0;

  let retried = 0;
  for (const delivery of deliveries) {
    const { data: endpoint } = await supabase
      .from("platform_webhook_endpoints")
      .select("url, secret, is_active")
      .eq("id", delivery.endpoint_id)
      .single();

    if (!endpoint || !endpoint.is_active) continue;

    const body = JSON.stringify(delivery.payload);
    const signature = await buildSignature(endpoint.secret, body);
    const attempt = (delivery.attempts as number) + 1;

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Id": delivery.id,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      // Exponential backoff: 1m, 5m, 30m, 2h
      const backoffMs = [60_000, 300_000, 1_800_000, 7_200_000][
        Math.min(attempt - 1, 3)
      ];

      await supabase
        .from("platform_webhook_deliveries")
        .update({
          status: response.ok ? "delivered" : "failed",
          response_status: response.status,
          response_body: (await response.text()).slice(0, 1000),
          delivered_at: response.ok ? new Date().toISOString() : null,
          attempts: attempt,
          next_retry_at: response.ok
            ? null
            : new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq("id", delivery.id);
    } catch (err) {
      const backoffMs = [60_000, 300_000, 1_800_000, 7_200_000][
        Math.min(attempt - 1, 3)
      ];
      await supabase
        .from("platform_webhook_deliveries")
        .update({
          status: "failed",
          response_body: err instanceof Error ? err.message : "Unknown error",
          attempts: attempt,
          next_retry_at:
            attempt >= 5
              ? null
              : new Date(Date.now() + backoffMs).toISOString(),
        })
        .eq("id", delivery.id);
    }

    retried++;
  }

  return retried;
}
