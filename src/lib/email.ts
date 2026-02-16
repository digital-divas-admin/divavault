/**
 * Email service using Resend.
 *
 * All transactional emails go through this module.
 * The `RESEND_API_KEY` env var must be set for emails to send.
 * If missing, emails are silently skipped (dev-friendly).
 */

import { Resend } from "resend";

const FROM_ADDRESS = "Consented AI <noreply@updates.consentedai.com>";

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return null;
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const resend = getResend();
  if (!resend) return null;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[email] Send error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[email] Unexpected error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared HTML wrapper
// ---------------------------------------------------------------------------

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #F0F4FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .logo { color: #DC2626; font-size: 20px; font-weight: 700; margin-bottom: 32px; }
    h1 { color: #0C1424; font-size: 22px; margin: 0 0 12px; }
    p { color: #3A5070; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .cta { display: inline-block; background: #DC2626; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin: 8px 0 24px; }
    .card { background: #FFFFFF; border: 1px solid #D0D8E6; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .card-label { color: #6A80A0; font-size: 12px; margin: 0 0 4px; }
    .card-value { color: #0C1424; font-size: 14px; font-family: monospace; margin: 0; word-break: break-all; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #D0D8E6; }
    .footer p { color: #71717A; font-size: 12px; }
    .highlight { color: #DC2626; }
    .success { color: #22C55E; }
    .warning { color: #F59E0B; }
    .danger { color: #EF4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">consentedai</div>
    ${body}
    <div class="footer">
      <p>Consented AI &mdash; AI Likeness Protection<br />
      <a href="https://www.consentedai.com" style="color: #DC2626; text-decoration: none;">www.consentedai.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

/** Sent when a free claim is registered and user provided an email. */
export async function sendClaimConfirmation(to: string, cid: string) {
  return sendEmail({
    to,
    subject: "Your face is registered on the Consented Identity Registry",
    html: wrapHtml(`
      <h1>Your Face is Registered</h1>
      <p>Your selfie has been submitted to the Consented Identity Registry. We'll scan AI platforms for unauthorized use of your likeness and notify you if we find any matches.</p>
      <div class="card">
        <p class="card-label">Your Registry ID (CID)</p>
        <p class="card-value">${cid}</p>
      </div>
      <p>Want automated DMCA takedowns when matches are found?</p>
      <a href="https://www.consentedai.com/signup" class="cta">Get Full Protection &rarr;</a>
    `),
    text: `Your face is registered on the Consented Identity Registry.\n\nYour CID: ${cid}\n\nWe'll scan AI platforms and notify you if we find matches.\n\nGet full protection: https://www.consentedai.com/signup`,
  });
}

/** Sent when a match is detected for a contributor. */
export async function sendMatchAlert(
  to: string,
  data: {
    platform: string;
    confidence: string;
    matchUrl?: string;
  }
) {
  return sendEmail({
    to,
    subject: `Match detected on ${data.platform}`,
    html: wrapHtml(`
      <h1>Match Detected</h1>
      <p>We found a potential use of your likeness on <strong class="highlight">${data.platform}</strong>.</p>
      <div class="card">
        <p class="card-label">Confidence</p>
        <p class="card-value ${data.confidence === "high" ? "danger" : data.confidence === "medium" ? "warning" : ""}">${data.confidence.toUpperCase()}</p>
      </div>
      <p>Review the match in your dashboard to take action.</p>
      <a href="https://www.consentedai.com/dashboard/matches" class="cta">View Match &rarr;</a>
    `),
    text: `Match detected on ${data.platform} (${data.confidence} confidence).\n\nReview it: https://www.consentedai.com/dashboard/matches`,
  });
}

/** Sent when a DMCA takedown status changes. */
export async function sendTakedownUpdate(
  to: string,
  data: {
    platform: string;
    status: string;
  }
) {
  const statusLabel =
    data.status === "completed"
      ? "successfully removed"
      : data.status === "rejected"
        ? "rejected by platform"
        : data.status;

  return sendEmail({
    to,
    subject: `Takedown ${statusLabel} — ${data.platform}`,
    html: wrapHtml(`
      <h1>Takedown Update</h1>
      <p>Your DMCA takedown request for content on <strong class="highlight">${data.platform}</strong> has been <strong class="${data.status === "completed" ? "success" : "warning"}">${statusLabel}</strong>.</p>
      <a href="https://www.consentedai.com/dashboard/matches" class="cta">View Details &rarr;</a>
    `),
    text: `Takedown ${statusLabel} on ${data.platform}.\n\nDetails: https://www.consentedai.com/dashboard/matches`,
  });
}

/** Sent when a scan completes for a contributor. */
export async function sendScanComplete(
  to: string,
  data: {
    platformsScanned: number;
    newMatches: number;
  }
) {
  return sendEmail({
    to,
    subject: `Scan complete — ${data.newMatches} new match${data.newMatches !== 1 ? "es" : ""}`,
    html: wrapHtml(`
      <h1>Scan Complete</h1>
      <p>We scanned <strong>${data.platformsScanned}</strong> platforms and found <strong class="${data.newMatches > 0 ? "warning" : "success"}">${data.newMatches} new match${data.newMatches !== 1 ? "es" : ""}</strong>.</p>
      ${data.newMatches > 0 ? '<a href="https://www.consentedai.com/dashboard/matches" class="cta">Review Matches &rarr;</a>' : '<p style="color: #22C55E;">All clear — no new unauthorized uses found.</p>'}
    `),
    text: `Scan complete: ${data.platformsScanned} platforms scanned, ${data.newMatches} new matches.\n\nDashboard: https://www.consentedai.com/dashboard`,
  });
}

/** Sent for security events (opt-out, consent changes, login from new device). */
export async function sendSecurityAlert(
  to: string,
  data: {
    event: string;
    description: string;
  }
) {
  return sendEmail({
    to,
    subject: `Security alert: ${data.event}`,
    html: wrapHtml(`
      <h1>Security Alert</h1>
      <p>${data.description}</p>
      <a href="https://www.consentedai.com/dashboard/privacy" class="cta">Review Settings &rarr;</a>
    `),
    text: `Security alert: ${data.event}\n\n${data.description}\n\nReview: https://www.consentedai.com/dashboard/privacy`,
  });
}

/** Sent when a bounty matches a contributor's profile. */
export async function sendBountyMatch(
  to: string,
  data: {
    title: string;
    compensation: string;
  }
) {
  return sendEmail({
    to,
    subject: `New paid photo request matches your profile`,
    html: wrapHtml(`
      <h1>New Bounty Match</h1>
      <p>A paid photo request matches your profile:</p>
      <div class="card">
        <p class="card-label">${data.title}</p>
        <p class="card-value success">${data.compensation}</p>
      </div>
      <a href="https://www.consentedai.com/dashboard" class="cta">View Request &rarr;</a>
    `),
    text: `New bounty match: ${data.title} (${data.compensation}).\n\nView: https://www.consentedai.com/dashboard`,
  });
}

/** Sent for legal landscape notification subscribers. */
export async function sendLegalUpdate(
  to: string,
  data: {
    state: string;
    headline: string;
    summary: string;
  }
) {
  return sendEmail({
    to,
    subject: `Legal update: ${data.state} — ${data.headline}`,
    html: wrapHtml(`
      <h1>Legal Update</h1>
      <p><strong class="highlight">${data.state}</strong>: ${data.headline}</p>
      <p>${data.summary}</p>
      <a href="https://www.consentedai.com/legal-landscape" class="cta">View Full Details &rarr;</a>
    `),
    text: `Legal update for ${data.state}: ${data.headline}\n\n${data.summary}\n\nDetails: https://www.consentedai.com/legal-landscape`,
  });
}
