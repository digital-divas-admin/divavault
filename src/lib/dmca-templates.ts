/**
 * DMCA notice templates — TypeScript port of
 * apps/scanner/src/enforcement/templates.py
 */

export function generateDmcaNotice({
  contributorName,
  contributorEmail,
  infringingUrl,
  platform,
  originalWorkDescription = "facial likeness and identity",
}: {
  contributorName: string;
  contributorEmail: string;
  infringingUrl: string;
  platform: string;
  originalWorkDescription?: string;
}): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return `DMCA Takedown Notice

Date: ${date}

To: ${platform} Copyright Agent

I, ${contributorName}, am writing to notify you of an infringement of my rights under the Digital Millennium Copyright Act (DMCA), 17 U.S.C. Section 512(c).

IDENTIFICATION OF COPYRIGHTED WORK:
My ${originalWorkDescription}, which I have registered and consented to use only through authorized channels via the Made Of Us platform (madeofus.ai).

IDENTIFICATION OF INFRINGING MATERIAL:
The following URL contains unauthorized use of my likeness:
${infringingUrl}

I have a good faith belief that the use of my likeness as described above is not authorized by me, my agent, or the law.

I declare under penalty of perjury that the information in this notification is accurate and that I am the owner of the rights that are allegedly being infringed.

Contact Information:
Name: ${contributorName}
Email: ${contributorEmail}
Platform: Made Of Us (madeofus.ai)

Signature: /s/ ${contributorName}
Date: ${date}
`;
}

export function generatePlatformReport({
  contributorName,
  infringingUrl,
  platform,
  matchConfidence,
  isAiGenerated,
}: {
  contributorName: string;
  infringingUrl: string;
  platform: string;
  matchConfidence: string;
  isAiGenerated?: boolean | null;
}): string {
  const aiNote =
    isAiGenerated === true
      ? "\n\nNote: This content has been identified as AI-generated, which may constitute a deepfake or non-consensual AI likeness use."
      : "";

  return `Unauthorized Use of Likeness Report

Platform: ${platform}
Reporter: ${contributorName}
Content URL: ${infringingUrl}
Match Confidence: ${matchConfidence}

This report is to notify you that the above URL contains unauthorized use of my facial likeness. I have not consented to the creation or distribution of this content.

I am a registered contributor on the Made Of Us platform (madeofus.ai), where I have provided consent records and identity verification documenting my likeness rights.${aiNote}

I request that this content be reviewed and removed in accordance with your platform's policies regarding non-consensual use of likeness and/or deepfake content.
`;
}
