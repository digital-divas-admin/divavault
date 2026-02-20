"""Scout runner — orchestrates platform discovery."""

import logging

from src.scout.base import ScoutSourceResult
from src.scout.assess import PlatformAssessor
from src.scout.queries import (
    create_run,
    complete_run,
    get_known_platforms,
    list_keywords,
    upsert_discovery,
    update_discovery_assessment,
    update_discovery_assessment_error,
)
from src.scout.sources import get_scout_sources

logger = logging.getLogger(__name__)


class ScoutRunner:
    """Orchestrate: discover -> dedup -> assess -> store."""

    async def run(self) -> dict:
        """Run all enabled scout sources, assess findings, store results.

        Returns summary dict.
        """
        sources = get_scout_sources()
        if not sources:
            return {"error": "No scout sources enabled"}

        # Load keywords and known platforms
        keywords = await list_keywords(enabled_only=True)
        known = await get_known_platforms()

        total_found = 0
        total_new = 0
        source_results: list[dict] = []

        for source in sources:
            run_id = await create_run(source.get_source_name())

            try:
                result: ScoutSourceResult = await source.discover(keywords)

                # Dedup against known platforms
                new_candidates = [
                    c for c in result.candidates
                    if c.domain not in known
                ]

                found = len(result.candidates)
                new = 0

                # Store discoveries
                discovery_ids: list[tuple] = []
                for candidate in new_candidates:
                    disc_id, is_new = await upsert_discovery(
                        domain=candidate.domain,
                        url=candidate.url,
                        source=source.get_source_name(),
                        name=candidate.name,
                        description=candidate.description,
                        source_query=candidate.source_query,
                        source_metadata=candidate.source_metadata,
                    )
                    if is_new:
                        new += 1
                        known.add(candidate.domain)
                        discovery_ids.append((disc_id, candidate.url))

                # Assess new discoveries
                if discovery_ids:
                    assessor = PlatformAssessor(keywords)
                    for disc_id, url in discovery_ids:
                        try:
                            assessment = await assessor.assess(url)
                            if "error" in assessment and not assessment.get("risk_factors"):
                                await update_discovery_assessment_error(
                                    disc_id, assessment["error"]
                                )
                            else:
                                await update_discovery_assessment(
                                    disc_id,
                                    risk_score=assessment["risk_score"],
                                    risk_factors=assessment["risk_factors"],
                                    name=assessment.get("title"),
                                    description=assessment.get("description"),
                                )
                        except Exception as e:
                            await update_discovery_assessment_error(
                                disc_id, str(e)[:500]
                            )

                total_found += found
                total_new += new

                await complete_run(
                    run_id,
                    domains_found=found,
                    domains_new=new,
                    metadata={
                        "queries_used": result.queries_used,
                        "errors": result.errors[:10],
                    },
                )

                source_results.append({
                    "source": source.get_source_name(),
                    "found": found,
                    "new": new,
                    "errors": len(result.errors),
                })

            except Exception as e:
                logger.exception(f"Scout source {source.get_source_name()} failed")
                await complete_run(run_id, 0, 0, error_message=str(e)[:500])
                source_results.append({
                    "source": source.get_source_name(),
                    "error": str(e)[:200],
                })

        return {
            "total_found": total_found,
            "total_new": total_new,
            "sources": source_results,
        }
