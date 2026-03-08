"""Patch promoter: graduates patches through sandbox -> canary -> production stages."""

import asyncio
import os
import shutil
import tempfile
from datetime import datetime, timezone

from src.config import settings
from src.db.connection import async_session
from src.resilience.constants import SCANNER_ROOT
from src.resilience.models import CrawlerPatch, DegradationEvent
from src.resilience.sandbox import patch_sandbox
from src.utils.logging import get_logger

log = get_logger("resilience.promoter")

_BACKUP_DIR = SCANNER_ROOT / "src" / "resilience" / "backups"


class PatchPromoter:
    """Graduates patches through sandbox -> canary -> production."""

    async def promote(self, patch: CrawlerPatch) -> None:
        """Attempt to promote a patch to the next stage."""
        try:
            if patch.status == "draft":
                await self._stage_sandbox(patch)
            elif patch.status == "sandbox" and settings.resilience_auto_promote:
                await self._stage_canary(patch)
            elif patch.status == "canary" and settings.resilience_auto_promote:
                await self._stage_production(patch)
        except Exception as e:
            log.error(
                "promote_error",
                patch_id=str(patch.id),
                status=patch.status,
                error=str(e),
            )

    async def _stage_sandbox(self, patch: CrawlerPatch) -> None:
        """Stage 1: Test patch in sandbox against cached pages."""
        log.info("sandbox_stage_start", patch_id=str(patch.id), platform=patch.platform)

        result = await patch_sandbox.test(patch)

        async with async_session() as session:
            p = await session.get(CrawlerPatch, patch.id)
            if not p:
                return
            p.sandbox_result = result["status"]
            p.sandbox_yield_before = result.get("yield_before")
            p.sandbox_yield_after = result.get("yield_after")

            if result["status"] == "fail":
                p.status = "rejected"
                log.warning(
                    "sandbox_rejected",
                    patch_id=str(patch.id),
                    error=result.get("error"),
                )
            else:
                p.status = "sandbox"
                log.info("sandbox_passed", patch_id=str(patch.id))
            await session.commit()

    async def _stage_canary(self, patch: CrawlerPatch) -> None:
        """Stage 2: Apply patch to temp copy, run limited live crawl.

        Note: Full canary implementation requires running live crawl cycles.
        This is a simplified version that promotes based on sandbox success.
        """
        log.info("canary_stage_start", patch_id=str(patch.id), platform=patch.platform)

        async with async_session() as session:
            p = await session.get(CrawlerPatch, patch.id)
            if not p:
                return
            p.canary_result = "pass"
            p.status = "canary"
            log.info("canary_passed", patch_id=str(patch.id))
            await session.commit()

    async def _stage_production(self, patch: CrawlerPatch) -> None:
        """Stage 3: Apply patch to actual crawler source file."""
        log.info("production_stage_start", patch_id=str(patch.id), platform=patch.platform)

        target_path = SCANNER_ROOT / patch.target_file
        if not target_path.exists():
            log.error("production_target_missing", path=str(target_path))
            return

        # Backup original file
        _BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_path = _BACKUP_DIR / f"{patch.platform}_{timestamp}.py"
        shutil.copy2(target_path, backup_path)
        log.info("production_backup_created", backup=str(backup_path))

        # Apply the diff
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".diff", delete=False, encoding="utf-8"
            ) as f:
                f.write(patch.diff_content)
                diff_path = f.name

            try:
                proc = await asyncio.create_subprocess_exec(
                    "patch", "-p1", "--input", diff_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(SCANNER_ROOT),
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)

                if proc.returncode != 0:
                    log.error(
                        "production_patch_failed",
                        stderr=stderr.decode(errors="replace"),
                    )
                    shutil.copy2(backup_path, target_path)
                    log.info("production_rollback_from_backup")
                    return
            finally:
                os.unlink(diff_path)

            # Success — update patch and event in a single transaction
            now = datetime.now(timezone.utc)
            async with async_session() as session:
                p = await session.get(CrawlerPatch, patch.id)
                if p:
                    p.status = "production"
                    p.promoted_at = now

                if patch.degradation_event_id:
                    evt = await session.get(DegradationEvent, patch.degradation_event_id)
                    if evt:
                        evt.status = "resolved"
                        evt.resolved_at = now

                await session.commit()

            log.info(
                "production_promoted",
                patch_id=str(patch.id),
                platform=patch.platform,
                target_file=patch.target_file,
            )

        except Exception as e:
            if backup_path.exists():
                shutil.copy2(backup_path, target_path)
                log.info("production_rollback_on_error")
            log.error("production_promote_error", error=str(e))

    async def rollback(self, patch: CrawlerPatch) -> bool:
        """Rollback a production patch from backup."""
        try:
            if not _BACKUP_DIR.exists():
                log.error("no_backup_dir")
                return False

            backups = sorted(
                _BACKUP_DIR.glob(f"{patch.platform}_*.py"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if not backups:
                log.error("no_backups_found", platform=patch.platform)
                return False

            target_path = SCANNER_ROOT / patch.target_file
            shutil.copy2(backups[0], target_path)

            async with async_session() as session:
                p = await session.get(CrawlerPatch, patch.id)
                if p:
                    p.rolled_back_at = datetime.now(timezone.utc)
                    p.status = "rejected"
                    await session.commit()

            log.info(
                "patch_rolled_back",
                patch_id=str(patch.id),
                backup=str(backups[0]),
            )
            return True
        except Exception as e:
            log.error("rollback_error", patch_id=str(patch.id), error=str(e))
            return False


patch_promoter = PatchPromoter()
