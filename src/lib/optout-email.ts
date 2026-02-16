import { generateConsentHash } from "@/lib/consent-hash";

// ---------------------------------------------------------------------------
// Opt-out notice generation
// ---------------------------------------------------------------------------

interface OptOutNoticeParams {
  userName: string;
  companyName: string;
  companySlug: string;
  date: string;
}

const TEMPLATE_VERSION = "v1.0";

/**
 * Hash arbitrary text content using SHA-256 via the consent hash utility.
 */
export async function hashContent(text: string): Promise<string> {
  return generateConsentHash({ content: text });
}

/**
 * Generate a reference number for an opt-out notice.
 * SHA-256 hash of slug + date, truncated to 16 hex characters.
 */
async function generateReferenceNumber(
  slug: string,
  date: string
): Promise<string> {
  const hash = await generateConsentHash({ slug, date });
  return hash.slice(0, 16).toUpperCase();
}

/**
 * Generate the email subject line for an opt-out notice.
 */
export function generateOptOutSubject(companyName: string): string {
  return `Formal Notice: Data Opt-Out and Deletion Request \u2014 ${companyName}`;
}

/**
 * Generate a formal plain-text opt-out notice referencing CCPA, BIPA, and GDPR Article 21.
 */
export async function generateOptOutNoticeText(
  params: OptOutNoticeParams
): Promise<string> {
  const { userName, companyName, companySlug, date } = params;
  const refNumber = await generateReferenceNumber(companySlug, date);

  return `FORMAL NOTICE: DATA OPT-OUT AND DELETION REQUEST
Reference: ${refNumber}
Template Version: ${TEMPLATE_VERSION}
Date: ${date}

To: ${companyName} — Privacy / Data Protection Team

From: ${userName}

Dear ${companyName} Privacy Team,

I am writing to formally exercise my rights under the following data protection regulations:

  - California Consumer Privacy Act (CCPA) — Right to Delete (Cal. Civ. Code 1798.105) and Right to Opt-Out of Sale/Sharing (Cal. Civ. Code 1798.120)
  - Biometric Information Privacy Act (BIPA) — 740 ILCS 14/15, requiring informed written consent prior to collection of biometric identifiers
  - General Data Protection Regulation (GDPR) Article 21 — Right to Object to processing of personal data

I hereby request the following:

1. REMOVAL OF BIOMETRIC AND FACIAL DATA
   Remove all biometric data, facial images, facial embeddings, and any derived biometric identifiers associated with my person from all training datasets, model weights (where technically feasible), and data pipelines used for AI model development.

2. EXCLUSION FROM FUTURE DATA COLLECTION
   Permanently exclude my biometric data, facial images, and likeness from any future data collection, scraping, or training data compilation activities.

3. CONFIRMATION OF COMPLIANCE
   Provide written confirmation that the above actions have been completed within thirty (30) calendar days of receipt of this notice, as required under applicable law.

4. THIRD-PARTY DISCLOSURE
   Identify any third parties with whom my biometric data, facial images, or derived data have been shared, licensed, or transferred, and confirm that those parties have also been notified of this opt-out request.

This notice is issued via the Consented AI platform (https://www.consentedai.com) on behalf of the undersigned individual. Failure to comply within the statutory timeframe may result in further legal action under the applicable regulations cited above.

Sincerely,
${userName}

---
Reference Number: ${refNumber}
Issued via Consented AI | Template ${TEMPLATE_VERSION}
This document constitutes a legally binding data subject request.`;
}

/**
 * Generate an HTML version of the formal opt-out notice suitable for email delivery.
 */
export async function generateOptOutNoticeHtml(
  params: OptOutNoticeParams
): Promise<string> {
  const { userName, companyName, companySlug, date } = params;
  const refNumber = await generateReferenceNumber(companySlug, date);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; background: #ffffff; font-family: 'Times New Roman', Times, Georgia, serif; color: #1a1a1a; line-height: 1.6;">
  <div style="max-width: 680px; margin: 0 auto; padding: 40px 32px;">

    <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        Formal Notice: Data Opt-Out and Deletion Request
      </h1>
      <table style="font-size: 13px; color: #555;">
        <tr><td style="padding-right: 12px; font-weight: 600;">Reference:</td><td>${refNumber}</td></tr>
        <tr><td style="padding-right: 12px; font-weight: 600;">Template Version:</td><td>${TEMPLATE_VERSION}</td></tr>
        <tr><td style="padding-right: 12px; font-weight: 600;">Date:</td><td>${date}</td></tr>
      </table>
    </div>

    <p style="margin: 0 0 4px;"><strong>To:</strong> ${companyName} &mdash; Privacy / Data Protection Team</p>
    <p style="margin: 0 0 24px;"><strong>From:</strong> ${userName}</p>

    <p>Dear ${companyName} Privacy Team,</p>

    <p>I am writing to formally exercise my rights under the following data protection regulations:</p>

    <ul style="margin: 12px 0; padding-left: 24px;">
      <li><strong>California Consumer Privacy Act (CCPA)</strong> &mdash; Right to Delete (Cal. Civ. Code &sect;1798.105) and Right to Opt-Out of Sale/Sharing (Cal. Civ. Code &sect;1798.120)</li>
      <li><strong>Biometric Information Privacy Act (BIPA)</strong> &mdash; 740 ILCS 14/15, requiring informed written consent prior to collection of biometric identifiers</li>
      <li><strong>General Data Protection Regulation (GDPR) Article 21</strong> &mdash; Right to Object to processing of personal data</li>
    </ul>

    <p>I hereby request the following:</p>

    <div style="margin: 16px 0; padding: 16px 20px; background: #f8f8f8; border-left: 3px solid #1a1a1a;">
      <p style="margin: 0 0 12px;"><strong>1. Removal of Biometric and Facial Data</strong></p>
      <p style="margin: 0 0 16px; font-size: 14px;">Remove all biometric data, facial images, facial embeddings, and any derived biometric identifiers associated with my person from all training datasets, model weights (where technically feasible), and data pipelines used for AI model development.</p>

      <p style="margin: 0 0 12px;"><strong>2. Exclusion from Future Data Collection</strong></p>
      <p style="margin: 0 0 16px; font-size: 14px;">Permanently exclude my biometric data, facial images, and likeness from any future data collection, scraping, or training data compilation activities.</p>

      <p style="margin: 0 0 12px;"><strong>3. Confirmation of Compliance</strong></p>
      <p style="margin: 0 0 16px; font-size: 14px;">Provide written confirmation that the above actions have been completed within thirty (30) calendar days of receipt of this notice, as required under applicable law.</p>

      <p style="margin: 0 0 12px;"><strong>4. Third-Party Disclosure</strong></p>
      <p style="margin: 0; font-size: 14px;">Identify any third parties with whom my biometric data, facial images, or derived data have been shared, licensed, or transferred, and confirm that those parties have also been notified of this opt-out request.</p>
    </div>

    <p>This notice is issued via the <a href="https://www.consentedai.com" style="color: #1a1a1a;">Consented AI</a> platform on behalf of the undersigned individual. Failure to comply within the statutory timeframe may result in further legal action under the applicable regulations cited above.</p>

    <p style="margin: 24px 0 4px;">Sincerely,</p>
    <p style="margin: 0; font-weight: 600;">${userName}</p>

    <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 12px; color: #777;">
      <p style="margin: 0;">Reference Number: ${refNumber}</p>
      <p style="margin: 4px 0 0;">Issued via <a href="https://www.consentedai.com" style="color: #777;">Consented AI</a> | Template ${TEMPLATE_VERSION}</p>
      <p style="margin: 4px 0 0;">This document constitutes a legally binding data subject request.</p>
    </div>

  </div>
</body>
</html>`;
}
