"""Write a consistent SQLite snapshot using the project's configured database."""
from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import sqlite3
import tempfile
from contextlib import closing

from .db import engine


def backup_sqlite() -> Path | None:
    if engine.url.get_backend_name() != "sqlite" or not engine.url.database:
        return None
    source = Path(engine.url.database).resolve()
    if not source.is_file():
        return None

    project_key = hashlib.sha256(os.fsencode(source)).hexdigest()[:12]
    local_data = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".local" / "share")
    directory = local_data / "AgriSphere" / "database-backups" / project_key
    directory.mkdir(mode=0o700, exist_ok=True, parents=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    destination = directory / f"agrisphere-{stamp}.sqlite3"
    fd, staging_path = tempfile.mkstemp(prefix="agrisphere-", suffix=".tmp", dir=directory)
    os.close(fd)
    staging = Path(staging_path)
    try:
        with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as original, \
             closing(sqlite3.connect(staging)) as snapshot:
            original.backup(snapshot)
        os.replace(staging, destination)
        return destination
    finally:
        staging.unlink(missing_ok=True)


if __name__ == "__main__":
    result = backup_sqlite()
    if result is not None:
        print(f"Database backup: {result}")
