"""
tools/audit_schema.py  —  read-only schema dump for the BS academic audit.

Prints every table, its columns, and its row count so the new BS academic
architecture can be layered onto what already exists instead of guessing.
ASCII only: the Windows console here is cp1252.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import query, DB_CONFIG  # noqa: E402

DB = DB_CONFIG["database"]


def main():
    tables = [r["t"] for r in query(
        "SELECT TABLE_NAME AS t FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA=%s ORDER BY TABLE_NAME", (DB,))]

    print("=" * 70)
    print(f"  DATABASE: {DB}   ({len(tables)} tables)")
    print("=" * 70)

    cols = query(
        "SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS ty, "
        "       IS_NULLABLE AS nu, COLUMN_KEY AS k, COLUMN_DEFAULT AS d, EXTRA AS e "
        "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s "
        "ORDER BY TABLE_NAME, ORDINAL_POSITION", (DB,))

    fks = query(
        "SELECT TABLE_NAME AS t, COLUMN_NAME AS c, "
        "       REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc "
        "FROM information_schema.KEY_COLUMN_USAGE "
        "WHERE TABLE_SCHEMA=%s AND REFERENCED_TABLE_NAME IS NOT NULL "
        "ORDER BY TABLE_NAME", (DB,))

    by_table = {}
    for c in cols:
        by_table.setdefault(c["t"], []).append(c)
    fk_by_table = {}
    for f in fks:
        fk_by_table.setdefault(f["t"], []).append(f)

    for t in tables:
        try:
            n = query(f"SELECT COUNT(*) AS n FROM `{t}`", one=True)["n"]
        except Exception:
            n = "?"
        print(f"\n--- {t}  ({n} rows)")
        for c in by_table.get(t, []):
            flags = []
            if c["k"] == "PRI":
                flags.append("PK")
            elif c["k"] == "UNI":
                flags.append("UQ")
            elif c["k"] == "MUL":
                flags.append("IDX")
            if c["nu"] == "NO":
                flags.append("NOT NULL")
            if c["e"]:
                flags.append(str(c["e"]))
            if c["d"] is not None:
                flags.append(f"default={c['d']}")
            tail = ("  [" + ", ".join(flags) + "]") if flags else ""
            print(f"      {c['c']:<26} {c['ty']}{tail}")
        for f in fk_by_table.get(t, []):
            print(f"      FK  {f['c']} -> {f['rt']}.{f['rc']}")


if __name__ == "__main__":
    main()
