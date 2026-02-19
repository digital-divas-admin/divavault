"""DeviantArt taxonomy mapper — discovers content sections via hybrid RSS + HTML probes."""

import re
import xml.etree.ElementTree as ET

import aiohttp

from src.config import settings
from src.intelligence.mapper.base import BasePlatformMapper, PlatformMap, Section
from src.utils.logging import get_logger
from src.utils.rate_limiter import get_limiter
from src.utils.retry import retry_async

log = get_logger("deviantart_mapper")

DEVIANTART_RSS_URL = "https://backend.deviantart.com/rss.xml"
DEVIANTART_TAG_URL = "https://www.deviantart.com/tag"

# XML namespaces used in DeviantArt RSS
NS = {
    "media": "http://search.yahoo.com/mrss/",
    "atom": "http://www.w3.org/2005/Atom",
}

# Browser User-Agent — DeviantArt blocks requests without one
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Regex for counting images on HTML tag pages
_HTML_IMAGE_RE = re.compile(r'src="https://images-wixmp[^"]+"')

# ---------------------------------------------------------------------------
# Section definitions — comprehensive DeviantArt taxonomy for face/likeness
#
# IMPORTANT: DeviantArt tags are single concatenated words — no spaces, no
# hyphens. E.g. "aiportrait" not "ai portrait", "stablediffusion" not
# "stable diffusion". All probe_tags and search tags must follow this format.
# ---------------------------------------------------------------------------

DEVIANTART_SECTIONS: dict[str, dict] = {
    # --- AI-Generated Content ---
    "deviantart:ai_portrait": {
        "name": "AI Portrait",
        "probe_tag": "aiportrait",
        "tags": ["aiportrait", "aiphoto", "airender"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_art": {
        "name": "AI Art",
        "probe_tag": "aiart",
        "tags": ["aiart", "aiimage", "aidrawing", "aipainting"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_generated": {
        "name": "AI Generated",
        "probe_tag": "aigenerated",
        "tags": ["aigenerated", "generativeai", "texttoimage"],
        "content_types": ["deviation"],
    },
    "deviantart:stable_diffusion": {
        "name": "Stable Diffusion",
        "probe_tag": "stablediffusion",
        "tags": ["stablediffusion", "automatic1111", "comfyui"],
        "content_types": ["deviation"],
    },
    "deviantart:midjourney": {
        "name": "Midjourney",
        "probe_tag": "midjourney",
        "tags": ["midjourney"],
        "content_types": ["deviation"],
    },
    "deviantart:dalle": {
        "name": "DALL-E",
        "probe_tag": "dalle",
        "tags": ["dalle"],
        "content_types": ["deviation"],
    },
    "deviantart:flux": {
        "name": "Flux",
        "probe_tag": "flux",
        "tags": ["flux"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_face": {
        "name": "AI Face",
        "probe_tag": "aiface",
        "tags": ["aiface", "aicharacter"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_woman": {
        "name": "AI Woman",
        "probe_tag": "aiwoman",
        "tags": ["aiwoman", "aigirl", "aibeauty", "aimodel"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_man": {
        "name": "AI Man",
        "probe_tag": "aiman",
        "tags": ["aiman"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_realistic": {
        "name": "AI Realistic",
        "probe_tag": "airealistic",
        "tags": ["airealistic", "hyperrealistic", "photorealism"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_nsfw": {
        "name": "AI NSFW",
        "probe_tag": "ainsfw",
        "tags": ["ainsfw", "ainude", "aihentai"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_fantasy": {
        "name": "AI Fantasy",
        "probe_tag": "aifantasy",
        "tags": ["aifantasy"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_cosplay": {
        "name": "AI Cosplay",
        "probe_tag": "aicosplay",
        "tags": ["aicosplay"],
        "content_types": ["deviation"],
    },
    "deviantart:ai_celebrity": {
        "name": "AI Celebrity",
        "probe_tag": "aicelebrity",
        "tags": ["aicelebrity"],
        "content_types": ["deviation"],
    },
    # --- Deepfake / Manipulation ---
    "deviantart:deepfake": {
        "name": "Deepfake",
        "probe_tag": "deepfake",
        "tags": ["deepfake", "faceswap", "faceswapai"],
        "content_types": ["deviation"],
    },
    "deviantart:photomanipulation": {
        "name": "Photo Manipulation",
        "probe_tag": "photomanipulation",
        "tags": ["photomanipulation", "retouch", "retouching"],
        "content_types": ["deviation"],
    },
    "deviantart:celebfakes": {
        "name": "Celebrity Fakes",
        "probe_tag": "celebfakes",
        "tags": ["celebfakes", "celebrityfakes", "fakecelebrity"],
        "content_types": ["deviation"],
    },
    # --- Portrait Photography ---
    "deviantart:portrait": {
        "name": "Portrait",
        "probe_tag": "portrait",
        "tags": ["portrait", "portraitart", "portraitphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:headshot": {
        "name": "Headshot",
        "probe_tag": "headshot",
        "tags": ["headshot"],
        "content_types": ["deviation"],
    },
    "deviantart:face": {
        "name": "Face",
        "probe_tag": "face",
        "tags": ["face", "beautifulface", "prettyface", "faceclaim", "facemodel"],
        "content_types": ["deviation"],
    },
    "deviantart:selfie": {
        "name": "Selfie",
        "probe_tag": "selfie",
        "tags": ["selfie"],
        "content_types": ["deviation"],
    },
    # --- People / Gender ---
    "deviantart:woman": {
        "name": "Woman",
        "probe_tag": "woman",
        "tags": ["woman", "beautifulwoman", "hotwoman", "sexywoman", "gorgeouswoman"],
        "content_types": ["deviation"],
    },
    "deviantart:man": {
        "name": "Man",
        "probe_tag": "man",
        "tags": ["man"],
        "content_types": ["deviation"],
    },
    "deviantart:girl": {
        "name": "Girl",
        "probe_tag": "girl",
        "tags": ["girl", "beautifulgirl", "prettygirl", "cutegirl", "hotgirl", "stunninggirl"],
        "content_types": ["deviation"],
    },
    "deviantart:boy": {
        "name": "Boy",
        "probe_tag": "boy",
        "tags": ["boy"],
        "content_types": ["deviation"],
    },
    "deviantart:female": {
        "name": "Female",
        "probe_tag": "female",
        "tags": ["female", "nakedfemale", "nudefemale", "femalenude"],
        "content_types": ["deviation"],
    },
    "deviantart:male": {
        "name": "Male",
        "probe_tag": "male",
        "tags": ["male", "malenude"],
        "content_types": ["deviation"],
    },
    # --- Celebrity / Public Figure ---
    "deviantart:celebrity": {
        "name": "Celebrity",
        "probe_tag": "celebrity",
        "tags": ["celebrity", "hollywoodstar", "moviestar"],
        "content_types": ["deviation"],
    },
    "deviantart:actress": {
        "name": "Actress",
        "probe_tag": "actress",
        "tags": ["actress"],
        "content_types": ["deviation"],
    },
    "deviantart:actor": {
        "name": "Actor",
        "probe_tag": "actor",
        "tags": ["actor"],
        "content_types": ["deviation"],
    },
    "deviantart:singer": {
        "name": "Singer",
        "probe_tag": "singer",
        "tags": ["singer"],
        "content_types": ["deviation"],
    },
    "deviantart:kpop": {
        "name": "K-Pop",
        "probe_tag": "kpop",
        "tags": ["kpop", "koreanbeauty", "koreangirl"],
        "content_types": ["deviation"],
    },
    "deviantart:idol": {
        "name": "Idol",
        "probe_tag": "idol",
        "tags": ["idol", "japanesebeauty", "japanesegirl"],
        "content_types": ["deviation"],
    },
    "deviantart:supermodel": {
        "name": "Supermodel",
        "probe_tag": "supermodel",
        "tags": ["supermodel"],
        "content_types": ["deviation"],
    },
    "deviantart:influencer": {
        "name": "Influencer",
        "probe_tag": "influencer",
        "tags": ["influencer"],
        "content_types": ["deviation"],
    },
    # --- Fashion / Beauty / Glamour ---
    "deviantart:fashion": {
        "name": "Fashion",
        "probe_tag": "fashion",
        "tags": ["fashion", "fashionphotography", "lookbook"],
        "content_types": ["deviation"],
    },
    "deviantart:beauty": {
        "name": "Beauty",
        "probe_tag": "beauty",
        "tags": ["beauty", "beautyphotography", "stunningbeauty", "sexybeautiful"],
        "content_types": ["deviation"],
    },
    "deviantart:glamour": {
        "name": "Glamour",
        "probe_tag": "glamour",
        "tags": ["glamour", "glamourphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:model": {
        "name": "Model",
        "probe_tag": "model",
        "tags": ["model", "hotmodel", "modelphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:pinup": {
        "name": "Pin-Up",
        "probe_tag": "pinup",
        "tags": ["pinup"],
        "content_types": ["deviation"],
    },
    "deviantart:boudoir": {
        "name": "Boudoir",
        "probe_tag": "boudoir",
        "tags": ["boudoir", "boudoirphotography", "intimatephotography"],
        "content_types": ["deviation"],
    },
    "deviantart:editorial": {
        "name": "Editorial Photography",
        "probe_tag": "editorialphotography",
        "tags": ["editorialphotography"],
        "content_types": ["deviation"],
    },
    # --- NSFW / Figure / Nude ---
    "deviantart:nude": {
        "name": "Nude",
        "probe_tag": "nude",
        "tags": ["nude", "naked", "nudephotography"],
        "content_types": ["deviation"],
    },
    "deviantart:figure": {
        "name": "Figure",
        "probe_tag": "figure",
        "tags": ["figure"],
        "content_types": ["deviation"],
    },
    "deviantart:lingerie": {
        "name": "Lingerie",
        "probe_tag": "lingerie",
        "tags": ["lingerie"],
        "content_types": ["deviation"],
    },
    "deviantart:bikini": {
        "name": "Bikini",
        "probe_tag": "bikini",
        "tags": ["bikini"],
        "content_types": ["deviation"],
    },
    "deviantart:erotic": {
        "name": "Erotic",
        "probe_tag": "erotic",
        "tags": ["erotic", "eroticphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:sexy": {
        "name": "Sexy",
        "probe_tag": "sexy",
        "tags": ["sexy", "sexybody", "sexylegs", "sexyback"],
        "content_types": ["deviation"],
    },
    "deviantart:curves": {
        "name": "Curves",
        "probe_tag": "curves",
        "tags": ["curves", "curvywoman", "curvygirl", "voluptuous", "hourglass"],
        "content_types": ["deviation"],
    },
    "deviantart:body": {
        "name": "Body",
        "probe_tag": "body",
        "tags": ["body", "perfectbody", "thickbody", "thickgirl", "bigbooty"],
        "content_types": ["deviation"],
    },
    "deviantart:fit": {
        "name": "Fitness",
        "probe_tag": "fitgirl",
        "tags": ["fitgirl", "fitwoman", "musclewoman", "musclegirl", "athleticgirl", "sexymusclegirl"],
        "content_types": ["deviation"],
    },
    # --- Cosplay / Fan Art ---
    "deviantart:cosplay": {
        "name": "Cosplay",
        "probe_tag": "cosplay",
        "tags": ["cosplay", "cosplayer", "cosplaygirl", "cosplayphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:sexy_cosplay": {
        "name": "Sexy Cosplay",
        "probe_tag": "sexycosplay",
        "tags": ["sexycosplay", "hotcosplay"],
        "content_types": ["deviation"],
    },
    "deviantart:anime_cosplay": {
        "name": "Anime Cosplay",
        "probe_tag": "animecosplay",
        "tags": ["animecosplay", "gamecosplay"],
        "content_types": ["deviation"],
    },
    "deviantart:fanart": {
        "name": "Fan Art",
        "probe_tag": "fanart",
        "tags": ["fanart"],
        "content_types": ["deviation"],
    },
    # --- Photography Genres ---
    "deviantart:photography": {
        "name": "Photography",
        "probe_tag": "photography",
        "tags": ["photography", "artphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:photorealistic": {
        "name": "Photorealistic",
        "probe_tag": "photorealistic",
        "tags": ["photorealistic"],
        "content_types": ["deviation"],
    },
    "deviantart:realistic": {
        "name": "Realistic",
        "probe_tag": "realistic",
        "tags": ["realistic"],
        "content_types": ["deviation"],
    },
    "deviantart:street_photography": {
        "name": "Street Photography",
        "probe_tag": "streetphotography",
        "tags": ["streetphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:fine_art_photography": {
        "name": "Fine Art Photography",
        "probe_tag": "fineartphotography",
        "tags": ["fineartphotography"],
        "content_types": ["deviation"],
    },
    "deviantart:studio": {
        "name": "Studio Photography",
        "probe_tag": "studiophotography",
        "tags": ["studiophotography"],
        "content_types": ["deviation"],
    },
    # --- 3D / CGI / Digital Art ---
    "deviantart:3d_render": {
        "name": "3D Render",
        "probe_tag": "3drender",
        "tags": ["3drender", "blender3d", "unrealengine", "octanerender", "iray", "vray"],
        "content_types": ["deviation"],
    },
    "deviantart:daz3d": {
        "name": "DAZ 3D",
        "probe_tag": "daz3d",
        "tags": ["daz3d", "dazstudio", "poser"],
        "content_types": ["deviation"],
    },
    "deviantart:cgi": {
        "name": "CGI",
        "probe_tag": "cgi",
        "tags": ["cgi"],
        "content_types": ["deviation"],
    },
    "deviantart:digital_art": {
        "name": "Digital Art",
        "probe_tag": "digitalart",
        "tags": ["digitalart", "digitaldrawing", "digitalpainting"],
        "content_types": ["deviation"],
    },
    "deviantart:digital_portrait": {
        "name": "Digital Portrait",
        "probe_tag": "digitalportrait",
        "tags": ["digitalportrait", "portraitart"],
        "content_types": ["deviation"],
    },
    "deviantart:character_design": {
        "name": "Character Design",
        "probe_tag": "characterdesign",
        "tags": ["characterdesign"],
        "content_types": ["deviation"],
    },
    "deviantart:concept_art": {
        "name": "Concept Art",
        "probe_tag": "conceptart",
        "tags": ["conceptart", "fantasyart", "fantasyportrait", "scifiart", "darkfantasy"],
        "content_types": ["deviation"],
    },
    # --- Ethnicity / Diversity ---
    "deviantart:asian": {
        "name": "Asian",
        "probe_tag": "asian",
        "tags": ["asian", "asianwoman", "asiangirl", "asianbeauty"],
        "content_types": ["deviation"],
    },
    "deviantart:latina": {
        "name": "Latina",
        "probe_tag": "latina",
        "tags": ["latina", "latinamodel"],
        "content_types": ["deviation"],
    },
    "deviantart:african": {
        "name": "African",
        "probe_tag": "african",
        "tags": ["african", "blackwoman", "blackbeauty"],
        "content_types": ["deviation"],
    },
    "deviantart:indian": {
        "name": "Indian",
        "probe_tag": "indian",
        "tags": ["indian", "indianwoman", "indianbeauty"],
        "content_types": ["deviation"],
    },
    "deviantart:russian": {
        "name": "Russian",
        "probe_tag": "russianmodel",
        "tags": ["russianmodel", "russiangirl"],
        "content_types": ["deviation"],
    },
    # --- Stock / Commercial ---
    "deviantart:stock": {
        "name": "Stock",
        "probe_tag": "stock",
        "tags": ["stock", "stockphoto", "stockmodel", "freestock"],
        "content_types": ["deviation"],
    },
    "deviantart:reference": {
        "name": "Reference",
        "probe_tag": "reference",
        "tags": ["reference", "posereference", "anatomyreference", "facereference"],
        "content_types": ["deviation"],
    },
    "deviantart:bodyart": {
        "name": "Body Art",
        "probe_tag": "bodyart",
        "tags": ["bodyart", "bodypaint"],
        "content_types": ["deviation"],
    },
    # --- Mature / Fetish / Alt ---
    "deviantart:fetish": {
        "name": "Fetish",
        "probe_tag": "fetish",
        "tags": ["fetish", "latexfetish", "leatherfetish", "bootsfetish", "footfetish"],
        "content_types": ["deviation"],
    },
    "deviantart:bondage": {
        "name": "Bondage",
        "probe_tag": "bondage",
        "tags": ["bondage"],
        "content_types": ["deviation"],
    },
    "deviantart:latex": {
        "name": "Latex",
        "probe_tag": "latex",
        "tags": ["latex"],
        "content_types": ["deviation"],
    },
    "deviantart:goth": {
        "name": "Goth",
        "probe_tag": "goth",
        "tags": ["goth", "gothic", "gothgirl", "gothmodel"],
        "content_types": ["deviation"],
    },
    "deviantart:alt": {
        "name": "Alternative",
        "probe_tag": "altgirl",
        "tags": ["altgirl", "altmodel", "punkgirl", "emogirl"],
        "content_types": ["deviation"],
    },
    # --- Blonde / Specific Types (high face yield compound tags) ---
    "deviantart:blonde": {
        "name": "Blonde",
        "probe_tag": "sexyblondegirl",
        "tags": ["sexyblondegirl"],
        "content_types": ["deviation"],
    },
    "deviantart:cute": {
        "name": "Cute",
        "probe_tag": "cutegirl",
        "tags": ["cutegirl", "cutewoman"],
        "content_types": ["deviation"],
    },
}

# Maps section_id -> search tags the crawler should use for that section
SECTION_TO_SEARCH_TERMS: dict[str, list[str]] = {
    section_id: rule["tags"]
    for section_id, rule in DEVIANTART_SECTIONS.items()
}


class DeviantArtMapper(BasePlatformMapper):
    """Maps DeviantArt's content taxonomy via hybrid RSS + HTML probes."""

    def __init__(self) -> None:
        self._proxy: str | None = None

    def get_platform(self) -> str:
        return "deviantart"

    async def build_map(self) -> PlatformMap:
        """Probe each section via RSS/HTML to estimate content counts."""
        sections: list[Section] = []
        limiter = get_limiter("deviantart_mapper")
        self._proxy = settings.proxy_url or None

        async with aiohttp.ClientSession(
            headers={"User-Agent": USER_AGENT},
        ) as session:
            for section_id, rule in DEVIANTART_SECTIONS.items():
                try:
                    total = await self._probe_section(session, limiter, rule)
                    sections.append(
                        Section(
                            section_id=section_id,
                            section_name=rule["name"],
                            platform="deviantart",
                            total_content=total,
                            tags=rule["tags"],
                            content_types=rule["content_types"],
                        )
                    )
                    log.info("deviantart_section_probed", section=section_id, total=total)
                except Exception as e:
                    log.error("deviantart_section_probe_error", section=section_id, error=repr(e))
                    sections.append(
                        Section(
                            section_id=section_id,
                            section_name=rule["name"],
                            platform="deviantart",
                            total_content=0,
                            tags=rule["tags"],
                            content_types=rule["content_types"],
                        )
                    )

        log.info("deviantart_map_complete", sections=len(sections))
        return PlatformMap(platform="deviantart", sections=sections)

    @retry_async(max_attempts=3, min_wait=1.0, max_wait=30.0)
    async def _probe_section(
        self,
        session: aiohttp.ClientSession,
        limiter,
        rule: dict,
    ) -> int:
        """Probe a single section by querying its primary tag.

        Tries RSS first (60 items/page). Falls back to HTML scraping when
        RSS returns 403 (rate-limited).
        """
        tag = rule["probe_tag"]

        # --- Try RSS first ---
        count = await self._probe_via_rss(session, limiter, tag)
        if count >= 0:
            return count

        # --- RSS returned 403 — fall back to HTML ---
        log.info("deviantart_probe_rss_fallback", tag=tag)
        return await self._probe_via_html(session, limiter, tag)

    async def _probe_via_rss(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
    ) -> int:
        """Probe via RSS. Returns item count, or -1 if RSS is blocked (403)."""
        params = {
            "q": f"boost:popular tag:{tag}",
            "offset": "0",
        }

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(DEVIANTART_RSS_URL, params=params, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status == 403:
                return -1  # Signal to fall back to HTML
            if resp.status != 200:
                log.warning("deviantart_probe_error", status=resp.status, tag=tag)
                return 0

            xml_text = await resp.text()

        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            log.error("deviantart_probe_xml_error", tag=tag, error=repr(e))
            return 0

        channel = root.find("channel")
        if channel is None:
            return 0

        items_count = len(channel.findall("item"))

        # Check for next page link
        has_more = False
        for link in channel.findall("atom:link", NS):
            if link.get("rel") == "next":
                has_more = True
                break

        if has_more and items_count >= 60:
            return items_count * 20
        return items_count

    async def _probe_via_html(
        self,
        session: aiohttp.ClientSession,
        limiter,
        tag: str,
    ) -> int:
        """Probe via HTML tag page scraping as fallback for RSS 403."""
        tag_slug = tag.replace(" ", "-")
        url = f"{DEVIANTART_TAG_URL}/{tag_slug}"

        await limiter.acquire()
        ssl_check = False if self._proxy else None
        async with session.get(url, proxy=self._proxy, ssl=ssl_check) as resp:
            if resp.status != 200:
                log.warning("deviantart_html_probe_error", status=resp.status, tag=tag)
                return 0

            html = await resp.text()

        items_count = len(_HTML_IMAGE_RE.findall(html))

        # Check for page 2 link — indicates more content
        has_more = "page=2" in html

        if has_more and items_count >= 20:
            return items_count * 20
        return items_count

    async def discover_sections(self) -> list[Section]:
        """Discover new DeviantArt tags not in the hardcoded taxonomy.

        Strategy:
        1. Build candidate tags from risk keywords + common prefixes
        2. Filter out tags already in DEVIANTART_SECTIONS
        3. Probe each candidate with a lightweight HTML check
        4. Return sections for tags that have meaningful content
        """
        known_tags = {
            tag
            for rule in DEVIANTART_SECTIONS.values()
            for tag in rule["tags"]
        }
        known_tags.update(
            rule["probe_tag"] for rule in DEVIANTART_SECTIONS.values()
        )

        # Risk keyword seeds — if any of these appear as a tag, it's worth checking
        risk_seeds = [
            "aicelebfake", "aideepfake", "deepfakeai", "facegen", "facemaker",
            "ailikeness", "aiperson", "realfake", "fakenude", "undresser",
            "aibikini", "ailingerie", "aiboudoir", "aimodel2024",
            "aiportraitart", "aiglamour", "stablecelebrity", "sdxlperson",
            "fluxportrait", "fluxrealistic", "fluxwoman", "midjourneyphoto",
            "midjourneyportrait", "aiinfluencer", "aigirlfriend",
        ]

        # Cross-platform risk terms (injected by orchestrator if available)
        cross_risk: list[str] = getattr(self, "_cross_platform_risk_terms", [])
        for term in cross_risk:
            # DeviantArt tags are single words, no spaces
            tag_candidate = term.lower().replace(" ", "").replace("-", "")
            if tag_candidate not in known_tags and len(tag_candidate) > 2:
                risk_seeds.append(tag_candidate)

        # Filter to truly new candidates
        candidates = [t for t in risk_seeds if t not in known_tags]
        if not candidates:
            return []

        log.info("discover_sections_probing", candidates=len(candidates))

        discovered: list[Section] = []
        limiter = get_limiter("deviantart_mapper")
        self._proxy = settings.proxy_url or None

        async with aiohttp.ClientSession(
            headers={"User-Agent": USER_AGENT},
        ) as session:
            for tag in candidates[:30]:  # Cap probes to avoid rate limiting
                try:
                    count = await self._probe_via_html(session, limiter, tag)
                    if count > 0:
                        section_id = f"deviantart:discovered_{tag}"
                        discovered.append(
                            Section(
                                section_id=section_id,
                                section_name=f"Discovered: {tag}",
                                platform="deviantart",
                                total_content=count,
                                tags=[tag],
                                content_types=["deviation"],
                                metadata={"source": "discovery", "seed_tag": tag},
                            )
                        )
                        log.info("discover_section_found", tag=tag, count=count)
                except Exception as e:
                    log.error("discover_section_error", tag=tag, error=repr(e))

        log.info("discover_sections_complete", probed=len(candidates), found=len(discovered))
        return discovered
