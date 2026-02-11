"""DMCA notice templates for takedown requests."""

from datetime import datetime, timezone


def generate_dmca_notice(
    contributor_name: str,
    contributor_email: str,
    infringing_url: str,
    platform: str,
    original_work_description: str = "facial likeness and identity",
) -> str:
    """Generate a DMCA takedown notice.

    Args:
        contributor_name: Legal name of the contributor.
        contributor_email: Contact email.
        infringing_url: URL of the infringing content.
        platform: Name of the hosting platform.
        original_work_description: Description of the original work.

    Returns:
        Formatted DMCA notice text.
    """
    date = datetime.now(timezone.utc).strftime("%B %d, %Y")

    return f"""DMCA Takedown Notice

Date: {date}

To: {platform} Copyright Agent

I, {contributor_name}, am writing to notify you of an infringement of my rights under the Digital Millennium Copyright Act (DMCA), 17 U.S.C. Section 512(c).

IDENTIFICATION OF COPYRIGHTED WORK:
My {original_work_description}, which I have registered and consented to use only through authorized channels via the Made Of Us platform (madeofus.ai).

IDENTIFICATION OF INFRINGING MATERIAL:
The following URL contains unauthorized use of my likeness:
{infringing_url}

I have a good faith belief that the use of my likeness as described above is not authorized by me, my agent, or the law.

I declare under penalty of perjury that the information in this notification is accurate and that I am the owner of the rights that are allegedly being infringed.

Contact Information:
Name: {contributor_name}
Email: {contributor_email}
Platform: Made Of Us (madeofus.ai)

Signature: /s/ {contributor_name}
Date: {date}
"""


def generate_platform_report(
    contributor_name: str,
    infringing_url: str,
    platform: str,
    match_confidence: str,
    is_ai_generated: bool | None = None,
) -> str:
    """Generate a platform-specific abuse report.

    Less formal than DMCA, for platforms with their own reporting systems.
    """
    ai_note = ""
    if is_ai_generated is True:
        ai_note = "\n\nNote: This content has been identified as AI-generated, which may constitute a deepfake or non-consensual AI likeness use."

    return f"""Unauthorized Use of Likeness Report

Platform: {platform}
Reporter: {contributor_name}
Content URL: {infringing_url}
Match Confidence: {match_confidence}

This report is to notify you that the above URL contains unauthorized use of my facial likeness. I have not consented to the creation or distribution of this content.

I am a registered contributor on the Made Of Us platform (madeofus.ai), where I have provided consent records and identity verification documenting my likeness rights.{ai_note}

I request that this content be reviewed and removed in accordance with your platform's policies regarding non-consensual use of likeness and/or deepfake content.
"""
