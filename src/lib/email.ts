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

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
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

export function wrapHtml(body: string): string {
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
  const statusUrl = `https://www.consentedai.com/registry/${cid}`;
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
      <p>You can check your status anytime:</p>
      <a href="${statusUrl}" class="cta">Check Status &rarr;</a>
      <p style="margin-top: 24px;">Want automated DMCA takedowns when matches are found?</p>
      <a href="https://www.consentedai.com/signup" style="color: #DC2626; text-decoration: none; font-weight: 600;">Get Full Protection &rarr;</a>
    `),
    text: `Your face is registered on the Consented Identity Registry.\n\nYour CID: ${cid}\n\nCheck your status: ${statusUrl}\n\nWe'll scan AI platforms and notify you if we find matches.\n\nGet full protection: https://www.consentedai.com/signup`,
  });
}

/** Sent when a registry match is found for a claim user. */
export async function sendRegistryMatchAlert(
  to: string,
  data: {
    cid: string;
    platform: string;
    confidence: string;
    statusUrl: string;
  }
) {
  const confidenceClass =
    data.confidence === "high"
      ? "danger"
      : data.confidence === "medium"
        ? "warning"
        : "";
  return sendEmail({
    to,
    subject: `Match detected — your face was found on ${data.platform}`,
    html: wrapHtml(`
      <h1>Match Detected</h1>
      <p>We found a potential use of your likeness on <strong class="highlight">${data.platform}</strong>.</p>
      <div class="card">
        <p class="card-label">Confidence</p>
        <p class="card-value ${confidenceClass}">${data.confidence.toUpperCase()}</p>
      </div>
      <div class="card">
        <p class="card-label">Registry ID</p>
        <p class="card-value">${data.cid}</p>
      </div>
      <p>Check your registry status for details:</p>
      <a href="${data.statusUrl}" class="cta">View Status &rarr;</a>
      <p style="margin-top: 24px;">Want evidence screenshots, AI detection, and automated DMCA takedowns?</p>
      <a href="https://www.consentedai.com/signup" style="color: #DC2626; text-decoration: none; font-weight: 600;">Get Full Protection &rarr;</a>
    `),
    text: `Match detected on ${data.platform} (${data.confidence} confidence).\n\nYour CID: ${data.cid}\n\nCheck status: ${data.statusUrl}\n\nGet full protection: https://www.consentedai.com/signup`,
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

/** Sent to the team when someone submits a case inquiry. */
export async function sendInquiryAlert(data: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  case_type: string;
  message?: string;
}) {
  const caseLabel = data.case_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return sendEmail({
    to: "hello@consentedai.com",
    subject: `New case inquiry from ${data.name}`,
    html: wrapHtml(`
      <h1>New Case Inquiry</h1>
      <p>Someone submitted a case inquiry through the website.</p>
      <div class="card">
        <p class="card-label">Name</p>
        <p class="card-value">${data.name}</p>
      </div>
      <div class="card">
        <p class="card-label">Email</p>
        <p class="card-value">${data.email}</p>
      </div>
      ${data.phone ? `<div class="card"><p class="card-label">Phone</p><p class="card-value">${data.phone}</p></div>` : ""}
      ${data.company ? `<div class="card"><p class="card-label">Company</p><p class="card-value">${data.company}</p></div>` : ""}
      <div class="card">
        <p class="card-label">Case Type</p>
        <p class="card-value">${caseLabel}</p>
      </div>
      ${data.message ? `<div class="card"><p class="card-label">Message</p><p class="card-value" style="font-family: inherit; white-space: pre-wrap;">${data.message}</p></div>` : ""}
      <a href="https://www.consentedai.com/admin/inquiries" class="cta">View Inquiries &rarr;</a>
    `),
    text: `New case inquiry from ${data.name}\n\nEmail: ${data.email}${data.phone ? `\nPhone: ${data.phone}` : ""}${data.company ? `\nCompany: ${data.company}` : ""}\nCase Type: ${caseLabel}${data.message ? `\nMessage: ${data.message}` : ""}\n\nView: https://www.consentedai.com/admin/inquiries`,
  });
}

/** Sent to the person who submitted a case inquiry to confirm receipt. */
export async function sendInquiryConfirmation(data: {
  name: string;
  email: string;
  case_type: string;
}) {
  const caseLabel = data.case_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return sendEmail({
    to: data.email,
    subject: "We received your inquiry",
    html: wrapHtml(`
      <h1>Thank You, ${data.name}</h1>
      <p>We've received your <strong>${caseLabel}</strong> inquiry and a member of our team will be in touch shortly.</p>
      <div class="card">
        <p class="card-label">What happens next?</p>
        <p class="card-value" style="font-family: inherit;">A specialist from our team will review your inquiry and reach out within 1–2 business days to discuss how we can help.</p>
      </div>
      <p>In the meantime, if you have any questions you can reply to this email or reach us at <a href="mailto:hello@consentedai.com" style="color: #DC2626; text-decoration: none;">hello@consentedai.com</a>.</p>
    `),
    text: `Thank you, ${data.name}.\n\nWe've received your ${caseLabel} inquiry and a member of our team will be in touch within 1–2 business days.\n\nIf you have any questions, reach us at hello@consentedai.com.`,
  });
}

// ---------------------------------------------------------------------------
// Opt-out email functions
// ---------------------------------------------------------------------------

export const OPTOUT_FROM_ADDRESS = "Consented AI Legal <legal@consentedai.com>";

/** Send a formal opt-out notice email to an AI company. */
export async function sendOptOutNotice({
  to,
  subject,
  html,
  text,
}: SendEmailParams & { from?: string }) {
  const resend = getResend();
  if (!resend) return null;
  try {
    const { data, error } = await resend.emails.send({
      from: OPTOUT_FROM_ADDRESS,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[email] Opt-out send error:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[email] Opt-out unexpected error:", err);
    return null;
  }
}

/** Notify a user about an opt-out status change from a company. */
export async function sendOptOutStatusUpdate(
  to: string,
  data: { companyName: string; status: string; details?: string }
) {
  const statusLabel =
    data.status === "confirmed"
      ? "confirmed your opt-out"
      : data.status === "denied"
        ? "denied your request"
        : `responded (${data.status})`;
  return sendEmail({
    to,
    subject: `Opt-out update: ${data.companyName} ${statusLabel}`,
    html: wrapHtml(`
      <h1>Opt-Out Update</h1>
      <p><strong class="highlight">${data.companyName}</strong> has <strong>${statusLabel}</strong>.</p>
      ${data.details ? `<div class="card"><p class="card-label">Details</p><p class="card-value">${data.details}</p></div>` : ""}
      <a href="https://www.consentedai.com/dashboard/opt-outs" class="cta">View Details &rarr;</a>
    `),
    text: `Opt-out update: ${data.companyName} ${statusLabel}.${data.details ? `\n\nDetails: ${data.details}` : ""}\n\nView: https://www.consentedai.com/dashboard/opt-outs`,
  });
}
