"""
utils/migrate.py  —  Additive schema migration runner
=====================================================
Applies every ``migrations/*.sql`` file, in filename order, to the live
database.  Used by ``app.py`` at startup so a developer never has to run
SQL by hand, and so existing installations converge on the new schema
WITHOUT dropping or recreating the database.

Design notes
------------
* Each migration file is written to be **idempotent** (see
  ``migrations/001_departments_campuses.sql``), so re-running is safe.
* Applied files are still recorded in ``schema_migrations`` (name +
  SHA-256) so ordinary startups skip the work entirely.  If a migration
  file is edited its checksum changes and it is applied again.
* The whole file runs on ONE connection: the migrations use MySQL user
  variables (``SET @sql := ...``) plus ``PREPARE`` / ``EXECUTE``, which
  are session-scoped.  ``db.query()`` opens a fresh connection per call
  and therefore cannot be used here.
"""

import hashlib
import os

from db import get_db

# migrations/ lives next to app.py, i.e. one level above utils/
_PROJECT_ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS_DIR = os.path.join(_PROJECT_ROOT, "migrations")

_TRACKER_DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    filename    VARCHAR(190) NOT NULL UNIQUE,
    checksum    CHAR(64)     NOT NULL,
    applied_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bookkeeping for applied migrations/*.sql files'
"""


def _split_statements(sql_text):
    """
    Split a migration file into executable statements.

    Full-line ``--`` comments and blank lines are dropped, then the text
    is split on semicolons.  Migration files are deliberately written
    without semicolons inside string literals so this stays correct
    (and avoids pulling in a SQL parser dependency).
    """
    lines = []
    for raw in sql_text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("--"):
            continue
        lines.append(raw)
    body = "\n".join(lines)
    return [s.strip() for s in body.split(";") if s.strip()]


def _applied_checksums(cur):
    """Return {filename: checksum} for migrations already applied."""
    cur.execute("SELECT filename, checksum FROM schema_migrations")
    return {r["filename"]: r["checksum"] for r in cur.fetchall()}


def run_migrations(verbose=True):
    """
    Apply all pending migrations.  Returns the list of filenames applied.

    Never raises on a missing migrations directory — a deployment may
    legitimately ship without one.  Genuine SQL errors ARE raised so a
    broken migration is not silently ignored.
    """
    if not os.path.isdir(MIGRATIONS_DIR):
        if verbose:
            print("[migrate] No migrations/ directory - nothing to do.")
        return []

    files = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.lower().endswith(".sql"))
    if not files:
        return []

    applied = []
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(_TRACKER_DDL)
            conn.commit()
            done = _applied_checksums(cur)

            for fname in files:
                path = os.path.join(MIGRATIONS_DIR, fname)
                with open(path, "r", encoding="utf-8") as fh:
                    sql_text = fh.read()
                checksum = hashlib.sha256(sql_text.encode("utf-8")).hexdigest()

                if done.get(fname) == checksum:
                    continue  # already applied, unchanged

                statements = _split_statements(sql_text)
                if verbose:
                    print(f"[migrate] Applying {fname} ({len(statements)} statements)...")

                for stmt in statements:
                    try:
                        cur.execute(stmt)
                        # Consume any result set so the connection stays usable
                        try:
                            cur.fetchall()
                        except Exception:
                            pass
                    except Exception as e:
                        conn.rollback()
                        print(f"[migrate] FAILED in {fname}: {e}\n  SQL: {stmt[:200]}")
                        raise

                cur.execute(
                    "INSERT INTO schema_migrations (filename, checksum) VALUES (%s, %s) "
                    "ON DUPLICATE KEY UPDATE checksum=VALUES(checksum), applied_at=CURRENT_TIMESTAMP",
                    (fname, checksum),
                )
                conn.commit()
                applied.append(fname)
                if verbose:
                    print(f"[migrate] OK {fname} applied.")

        if verbose and not applied:
            print("[migrate] Schema already up to date.")
    finally:
        conn.close()

    return applied
