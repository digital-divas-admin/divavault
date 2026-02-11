"""Extract platform and handle from URLs for allowlist matching."""

import re
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass
class ParsedURL:
    platform: str | None
    handle: str | None
    domain: str


# Platform patterns: (domain_regex, handle_extraction_pattern)
PLATFORM_PATTERNS: list[tuple[str, str, re.Pattern]] = [
    # Instagram
    ("instagram", "instagram.com", re.compile(r"^/([A-Za-z0-9_.]+)/?$")),
    # Twitter / X
    ("twitter", "twitter.com", re.compile(r"^/([A-Za-z0-9_]+)/?$")),
    ("twitter", "x.com", re.compile(r"^/([A-Za-z0-9_]+)/?$")),
    # TikTok
    ("tiktok", "tiktok.com", re.compile(r"^/@?([A-Za-z0-9_.]+)/?$")),
    # Facebook
    ("facebook", "facebook.com", re.compile(r"^/([A-Za-z0-9.]+)/?$")),
    # LinkedIn
    ("linkedin", "linkedin.com", re.compile(r"^/in/([A-Za-z0-9_-]+)/?$")),
    # DeviantArt
    ("deviantart", "deviantart.com", re.compile(r"^/([A-Za-z0-9_-]+)/?.*$")),
    # Reddit
    ("reddit", "reddit.com", re.compile(r"^/user/([A-Za-z0-9_-]+)/?.*$")),
    # CivitAI
    ("civitai", "civitai.com", re.compile(r"^/user/([A-Za-z0-9_-]+)/?.*$")),
    # YouTube
    ("youtube", "youtube.com", re.compile(r"^/@?([A-Za-z0-9_-]+)/?$")),
]


def normalize_domain(domain: str) -> str:
    """Strip www., m., mobile. prefixes from a domain."""
    domain = domain.lower()
    for prefix in ("www.", "m.", "mobile."):
        if domain.startswith(prefix):
            domain = domain[len(prefix):]
    return domain


def parse_url(url: str) -> ParsedURL:
    """Extract platform and handle from a URL.

    Handles variations: www, mobile, trailing slashes, etc.
    """
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
    except Exception:
        return ParsedURL(platform=None, handle=None, domain="unknown")

    raw_domain = parsed.hostname or ""
    domain = normalize_domain(raw_domain)
    path = parsed.path or "/"

    # Strip trailing slash for consistent matching
    path_clean = path.rstrip("/")
    if not path_clean:
        path_clean = "/"

    for platform_name, pattern_domain, handle_re in PLATFORM_PATTERNS:
        if domain == pattern_domain or domain.endswith(f".{pattern_domain}"):
            match = handle_re.match(path)
            if match:
                return ParsedURL(
                    platform=platform_name,
                    handle=match.group(1).lower(),
                    domain=domain,
                )
            # Matched domain but couldn't extract handle
            return ParsedURL(platform=platform_name, handle=None, domain=domain)

    return ParsedURL(platform=None, handle=None, domain=domain)


def check_allowlist(
    page_url: str | None,
    known_accounts: list[dict],
) -> dict | None:
    """Check if a page_url matches any of a contributor's known accounts.

    Args:
        page_url: The URL where the match was found.
        known_accounts: List of dicts with 'platform', 'handle', 'domain', 'id' keys.

    Returns:
        The matching known account dict, or None.
    """
    if not page_url:
        return None

    parsed = parse_url(page_url)

    # Well-known social platform domains — domain-only matching is too broad for these.
    # Must match by platform + handle instead.
    SOCIAL_DOMAINS = {
        "instagram.com", "twitter.com", "x.com", "tiktok.com", "facebook.com",
        "linkedin.com", "youtube.com", "reddit.com", "deviantart.com", "civitai.com",
    }

    for account in known_accounts:
        # Match by platform + handle (for social platforms)
        if (
            parsed.platform
            and account.get("platform") == parsed.platform
            and account.get("handle")
            and parsed.handle
            and account["handle"].lower() == parsed.handle
        ):
            return account

        # Match by domain (for personal websites and custom domains only).
        # Skip domain matching for well-known social platforms to avoid
        # matching "instagram.com/impersonator" against a known "instagram.com" entry.
        if account.get("domain"):
            account_domain = normalize_domain(account["domain"])
            if account_domain in SOCIAL_DOMAINS:
                continue
            if parsed.domain == account_domain:
                return account

    return None
