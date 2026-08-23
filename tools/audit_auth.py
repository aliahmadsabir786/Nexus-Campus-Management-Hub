"""
tools/audit_auth.py  --  read-only audit of every credential-bearing row.

Answers, for the security pass:
  * does every account carry a department AND a campus?  (a NULL campus is a
    cross-campus login hole while authorize_user_context() skips the check)
  * is every stored secret a real Werkzeug hash, or is anything plaintext?
Run:  python tools/audit_auth.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from db import query

KNOWN_METHODS = ("scrypt:", "pbkdf2:", "argon2", "$2b$", "$2a$", "$2y$")

def hash_kind(h):
    if h is None:            return "NULL  <-- no secret stored"
    if not str(h).strip():   return "EMPTY <-- no secret stored"
    s = str(h)
    for m in KNOWN_METHODS:
        if s.startswith(m):
            return "hash(" + s.split("$")[0][:16] + ")"
    return "PLAINTEXT? " + repr(s[:24])

app = create_app()
with app.app_context():
    print("== departments ==")
    for d in query("SELECT id, code, name, has_campuses, status FROM departments ORDER BY id"):
        print("  %-3s %-8s %-26s has_campuses=%s status=%s"
              % (d["id"], d["code"], d["name"], d["has_campuses"], d["status"]))

    print("== campuses ==")
    for c in query("SELECT id, department_id, code, name, status FROM campuses ORDER BY id"):
        print("  %-3s dept=%-3s %-9s %-18s status=%s"
              % (c["id"], c["department_id"], c["code"], c["name"], c["status"]))

    for table, idcol, extra in (("teachers", "id", "portal"),
                                ("students", "id", "portal"),
                                ("sub_admins", "id", "portal")):
        rows = query("SELECT * FROM %s ORDER BY %s" % (table, idcol))
        print("== %s (%d rows) ==" % (table, len(rows)))
        for r in rows:
            uname = r.get("username") or r.get(idcol)
            print("  %-12s dept=%-5s campus=%-5s %-8s %s"
                  % (uname, r.get("department_id"), r.get("campus_id"),
                     r.get(extra), hash_kind(r.get("password_hash"))))

    cfg = query("SELECT * FROM admin_config", )
    print("== admin_config (%d rows) ==" % len(cfg))
    for r in cfg:
        print("  id=%s %s" % (r.get("id"), hash_kind(r.get("password_hash"))))

    print("== NULL-context accounts (cross-context login risk) ==")
    for table in ("teachers", "students", "sub_admins"):
        n = query("SELECT COUNT(*) c FROM %s WHERE department_id IS NULL OR campus_id IS NULL" % table, one=True)
        print("  %-11s %s" % (table, n["c"]))
