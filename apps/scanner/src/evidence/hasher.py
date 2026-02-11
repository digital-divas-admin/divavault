"""SHA-256 evidence hashing for integrity verification."""

import hashlib
from pathlib import Path


def hash_file(path: Path) -> str:
    """Compute SHA-256 hash of a file. Returns hex digest."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def hash_bytes(data: bytes) -> str:
    """Compute SHA-256 hash of bytes. Returns hex digest."""
    return hashlib.sha256(data).hexdigest()
