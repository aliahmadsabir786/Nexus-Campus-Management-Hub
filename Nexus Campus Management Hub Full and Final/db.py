"""
db.py  —  MySQL connection helper for NEXus CMS
Uses PyMySQL (pure Python, no system libs needed).
Install: pip install pymysql
"""

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
