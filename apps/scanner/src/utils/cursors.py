"""Shared cursor validation for crawler scripts."""

import structlog

log = structlog.get_logger(module=__name__)


def validate_cursor_dict(cursors: dict | None) -> dict:
    """Filter out cursor entries with invalid types (not str/int/None).

    Returns a new dict with only valid cursor values, logging warnings
    for any skipped entries.
    """
    if not cursors or not isinstance(cursors, dict):
        return cursors or {}
    validated = {}
    for key, value in cursors.items():
        if value is not None and not isinstance(value, (str, int)):
            log.warning("invalid_cursor_skipped", key=key, cursor_type=type(value).__name__)
            continue
        validated[key] = value
    return validated
