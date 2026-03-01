import { NextRequest, NextResponse } from "next/server";
import {
  sendClaimConfirmation,
  sendMatchAlert,
  sendTakedownUpdate,
  sendScanComplete,
  sendSecurityAlert,
  sendLegalUpdate,
} from "@/lib/email";

/**
 * Test endpoint to verify all email templates send correctly.
 * POST /api/test-emails
 * Body: { "to": "email@example.com", "template": "all" | template_name }
 *
 * WARNING: This should be removed or protected before production.
 */
export async function POST(request: NextRequest) {
  let body: { to: string; template?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, template = "all" } = body;
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Valid 'to' email required" }, { status: 400 });
  }

  const results: Record<string, unknown> = {};

  const templates: Record<string, () => Promise<unknown>> = {
    claim_confirmation: () =>
      sendClaimConfirmation(to, "CID-1test000000000000"),

    match_alert: () =>
      sendMatchAlert(to, {
        platform: "CivitAI",
        confidence: "high",
        matchUrl: "https://civitai.com/example",
      }),

    takedown_update_completed: () =>
      sendTakedownUpdate(to, {
        platform: "DeviantArt",
        status: "completed",
      }),

    takedown_update_rejected: () =>
      sendTakedownUpdate(to, {
        platform: "Reddit",
        status: "rejected",
      }),

    scan_complete_matches: () =>
      sendScanComplete(to, {
        platformsScanned: 247,
        newMatches: 3,
      }),

    scan_complete_clear: () =>
      sendScanComplete(to, {
        platformsScanned: 247,
        newMatches: 0,
      }),

    security_alert: () =>
      sendSecurityAlert(to, {
        event: "Opt-out activated",
        description:
          "You have opted out of AI training. Your likeness will no longer be scanned or monitored. You can opt back in at any time from your privacy settings.",
      }),

    legal_update: () =>
      sendLegalUpdate(to, {
        state: "California",
        headline: "AB 2602 Signed Into Law",
        summary:
          "California Governor signed AB 2602, requiring explicit consent before using a person's digital likeness in AI-generated content. The law takes effect January 1, 2026.",
      }),
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (template === "all") {
    for (const [name, fn] of Object.entries(templates)) {
      try {
        const result = await fn();
        results[name] = { success: true, data: result };
      } catch (err) {
        results[name] = { success: false, error: String(err) };
      }
      // Resend free tier: 2 requests/second — space them out
      await delay(600);
    }
  } else if (templates[template]) {
    try {
      const result = await templates[template]();
      results[template] = { success: true, data: result };
    } catch (err) {
      results[template] = { success: false, error: String(err) };
    }
  } else {
    return NextResponse.json(
      { error: `Unknown template: ${template}. Available: ${Object.keys(templates).join(", ")}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ results });
}
