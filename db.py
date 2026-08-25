"""
db.py  —  MySQL connection helper for NEXus CMS
Uses PyMySQL (pure Python, no system libs needed).
Install: pip install pymysql
"""

from contextlib import contextmanager

import pymysql
import pymysql.cursors

# ──────────────────────────────────────────────────────────────
#  🔧  APNA MySQL USERNAME AUR PASSWORD YAHAN CHANGE KAREIN
# ──────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host":        "localhost",
    "user":        "root",          # apna MySQL username
    "password":    "123456",      # apna MySQL password yahan likho
    "database":    "nexus_cms",
    "cursorclass": pymysql.cursors.DictCursor,
    "charset":     "utf8mb4",
    "autocommit":  False,
}


def get_db():
    """Return a new MySQL connection."""
    return pymysql.connect(**DB_CONFIG)


def query(sql, args=None, one=False, commit=False):
    """
    Run a SQL query and return results.

    query("SELECT * FROM students")                         -> list of dicts
    query("SELECT * FROM students WHERE id=%s", ('S001',), one=True) -> single dict or None
    query("INSERT INTO ...", (...,), commit=True)           -> lastrowid
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args or ())
            if commit:
                conn.commit()
                return cur.lastrowid
            if one:
                return cur.fetchone()
            return cur.fetchall()
    except Exception as e:
        if commit:
            try:
                conn.rollback()
            except Exception:
                pass
        print(f"[DB ERROR] SQL: {sql} | Args: {args} | Error: {e}")
        raise
    finally:
        conn.close()


@contextmanager
def transaction():
    """
    Multi-statement transaction (spec §31 — promotion must be all-or-nothing).

    `query()` above commits (or rolls back) after every single statement, on
    its own connection — fine for the vast majority of routes, but wrong for
    an operation the spec explicitly describes as "BEGIN TRANSACTION ...
    steps ... COMMIT / if anything fails ROLLBACK". Use like:

        with transaction() as conn:
            tquery(conn, "UPDATE students SET ... WHERE id=%s", (sid,))
            tquery(conn, "UPDATE bs_enrollments SET ... WHERE id=%s", (eid,))
        # commits here only if every statement above ran without raising;
        # any exception rolls back everything and re-raises.
    """
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def tquery(conn, sql, args=None, one=False):
    """
    Run one statement against a connection opened by `transaction()`.

    Never commits or closes the connection itself — `transaction()` owns
    the commit/rollback for the whole block, exactly once, at the end.
    """
    with conn.cursor() as cur:
        cur.execute(sql, args or ())
        if one:
            return cur.fetchone()
        if cur.description is None:
            return cur.lastrowid
        return cur.fetchall()