import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getIdentityByContributorId,
  getConsentHistory,
  recordConsentEvent,
  consentEventInputSchema,
} from "@/lib/registry";
import { dispatchWebhook } from "@/lib/webhooks";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const identity = await getIdentityByContributorId(user.id);

    if (!identity) {
      return NextResponse.json({ events: [] });
    }

    const events = await getConsentHistory(identity.cid);

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Registry consent history error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve consent history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = consentEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const identity = await getIdentityByContributorId(user.id);

    if (!identity) {
      return NextResponse.json(
        { error: "No registry identity found" },
        { status: 404 }
      );
    }

    // Verify the CID in the request matches the user's CID
    if (parsed.data.cid !== identity.cid) {
      return NextResponse.json(
        { error: "CID does not match your identity" },
        { status: 403 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const event = await recordConsentEvent({
      ...parsed.data,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    dispatchWebhook(
      parsed.data.eventType === "revoke"
        ? "registry.consent_revoked"
        : "registry.consent_updated",
      {
        cid: parsed.data.cid,
        event_type: parsed.data.eventType,
        event_id: event.event_id,
      }
    ).catch((err) => console.error("Registry consent webhook error:", err));

    return NextResponse.json({ success: true, event });
  } catch (err) {
    console.error("Registry consent event error:", err);
    return NextResponse.json(
      { error: "Failed to record consent event" },
      { status: 500 }
    );
  }
}
