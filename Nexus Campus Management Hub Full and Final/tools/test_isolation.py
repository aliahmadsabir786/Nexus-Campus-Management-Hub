"""
tools/test_isolation.py  —  Backend data-isolation test harness
==============================================================
Covers spec section 28, tests 1-4:

  1. BS -> admin login -> only BS data
  2. Intermediate -> Boys -> only Boys data (no Girls records)
  3. Intermediate -> Girls -> only Girls data (no Boys records)
  4. Tampering: forged login context, forged session cookie values and
     direct-ID access to another campus's rows are all refused by the
     BACKEND, not the browser.

Run from the project root:

    python -m tools.test_isolation
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app          # noqa: E402
from db import query                # noqa: E402

FAILURES = []
CHECKS   = 0


def check(label, condition, detail=""):
    global CHECKS
    CHECKS += 1
    if condition:
        print(f"  [PASS] {label}")
    else:
        print(f"  [FAIL] {label}  {detail}")
        FAILURES.append(label)


def login(client, role, username, password, department, campus=None):
    return client.post("/api/login", json={
        "role": role, "username": username, "password": password,
        "department": department, "campus": campus,
    })


def ids(resp):
    data = resp.get_json(silent=True)
    if isinstance(data, dict):
        data = data.get("students") or data.get("teachers") or []
    if not isinstance(data, list):
        return []
    return [r.get("id") for r in data if isinstance(r, dict)]


def id_set(resp):
    """Set of ids from a plain list endpoint, [] on any error response."""
    return set(ids(resp))


def run():
    app = create_app()
    app.config["TESTING"] = True

    # ---------------------------------------------------------------
    # Reference data straight from the database
    # ---------------------------------------------------------------
    def db_ids(table, dept_code, campus_code=None):
        sql = (f"SELECT t.id FROM {table} t "
               "JOIN departments d ON d.id=t.department_id "
               "LEFT JOIN campuses c ON c.id=t.campus_id "
               "WHERE d.code=%s")
        args = [dept_code]
        if campus_code:
            sql += " AND c.code=%s"
            args.append(campus_code)
        return {r["id"] for r in query(sql, args)}

    bs_students    = db_ids("students", "BS")
    boys_students  = db_ids("students", "INTER", "BOYS")
    girls_students = db_ids("students", "INTER", "GIRLS")
    boys_teachers  = db_ids("teachers", "INTER", "BOYS")
    girls_teachers = db_ids("teachers", "INTER", "GIRLS")

    print(f"\nDB reference: BS={len(bs_students)} students, "
          f"BOYS={len(boys_students)}, GIRLS={len(girls_students)}")
    if not (bs_students and boys_students and girls_students):
        print("!! Sample data missing - run app.py once to seed, then re-run.")
        return 1

    girls_class = query(
        "SELECT c.id FROM classes c JOIN campuses cm ON cm.id=c.campus_id "
        "WHERE cm.code='GIRLS' LIMIT 1", one=True)
    boys_class = query(
        "SELECT c.id FROM classes c JOIN campuses cm ON cm.id=c.campus_id "
        "WHERE cm.code='BOYS' LIMIT 1", one=True)

    # ===============================================================
    # TEST 1 — BS admin sees only BS data
    # ===============================================================
    print("\nTEST 1 - BS Department admin")
    with app.test_client() as c:
        r = login(c, "admin", "admin", "admin123", "BS")
        check("BS admin login succeeds", r.status_code == 200 and r.get_json().get("success"),
              r.get_data(as_text=True)[:200])
        ctx = (r.get_json() or {}).get("user", {}).get("context", {})
        check("context reports BS", ctx.get("department") == "BS", str(ctx))
        check("context has no campus flag for BS", not ctx.get("requiresCampus", False), str(ctx))

        got = set(ids(c.get("/api/students?limit=100")))
        check("BS student list == BS rows only", got and got <= bs_students,
              f"unexpected: {sorted(got - bs_students)}")
        check("BS list excludes Boys+Girls",
              not (got & (boys_students | girls_students)))

        dash = c.get("/api/dashboard").get_json()
        check("dashboard totalStudents == BS count",
              dash.get("totalStudents") == len(bs_students),
              f"{dash.get('totalStudents')} != {len(bs_students)}")

    # ===============================================================
    # TEST 2 — Intermediate / Boys
    # ===============================================================
    print("\nTEST 2 - Intermediate / Boys Campus")
    with app.test_client() as c:
        r = login(c, "admin", "admin", "admin123", "INTERMEDIATE", "BOYS")
        check("Boys admin login succeeds", r.status_code == 200 and r.get_json().get("success"),
              r.get_data(as_text=True)[:200])
        ctx = (r.get_json() or {}).get("user", {}).get("context", {})
        check("context reports Intermediate/Boys",
              ctx.get("department") == "INTERMEDIATE" and ctx.get("campus") == "BOYS", str(ctx))

        got = set(ids(c.get("/api/students?limit=100")))
        check("Boys student list == Boys rows only", got and got <= boys_students,
              f"unexpected: {sorted(got - boys_students)}")
        check("Boys list excludes Girls students", not (got & girls_students))
        check("Boys list excludes BS students", not (got & bs_students))

        gott = set(ids(c.get("/api/teachers")))
        check("Boys teacher list == Boys rows only", gott and gott <= boys_teachers,
              f"unexpected: {sorted(gott - boys_teachers)}")

        cls_ids = id_set(c.get("/api/classes"))
        check("Boys classes exclude the Girls class",
              girls_class and girls_class["id"] not in cls_ids)

        dash = c.get("/api/dashboard").get_json()
        check("dashboard totalStudents == Boys count",
              dash.get("totalStudents") == len(boys_students),
              f"{dash.get('totalStudents')} != {len(boys_students)}")

        check("attendance report scoped to Boys",
              id_set(c.get("/api/reports/attendance")) <= boys_students)

    # ===============================================================
    # TEST 3 — Intermediate / Girls
    # ===============================================================
    print("\nTEST 3 - Intermediate / Girls Campus")
    with app.test_client() as c:
        r = login(c, "admin", "admin", "admin123", "INTERMEDIATE", "GIRLS")
        check("Girls admin login succeeds", r.status_code == 200 and r.get_json().get("success"))

        got = set(ids(c.get("/api/students?limit=100")))
        check("Girls student list == Girls rows only", got and got <= girls_students,
              f"unexpected: {sorted(got - girls_students)}")
        check("Girls list excludes Boys students", not (got & boys_students))

        gott = set(ids(c.get("/api/teachers")))
        check("Girls teacher list excludes Boys teachers", not (gott & boys_teachers))

        cls_ids = id_set(c.get("/api/classes"))
        check("Girls classes exclude the Boys class",
              boys_class and boys_class["id"] not in cls_ids)

    # ===============================================================
    # TEST 4 — Tamper resistance (backend enforcement)
    # ===============================================================
    print("\nTEST 4 - Tampering is refused server-side")

    boy_id  = sorted(boys_students)[0]
    girl_id = sorted(girls_students)[0]

    # 4a. A Boys teacher claiming the Girls campus at login
    bteacher = sorted(boys_teachers)[0]
    with app.test_client() as c:
        r = login(c, "teacher", bteacher, "teach123", "INTERMEDIATE", "GIRLS")
        check("Boys teacher cannot log into Girls campus",
              r.status_code in (401, 403) or not (r.get_json() or {}).get("success"),
              r.get_data(as_text=True)[:200])

    # 4b. Unknown / forged context codes
    with app.test_client() as c:
        r = login(c, "admin", "admin", "admin123", "INTERMEDIATE", "STAFF")
        check("forged campus code rejected", r.status_code == 400, str(r.status_code))
        r = login(c, "admin", "admin", "admin123", "HACKED")
        check("forged department code rejected", r.status_code == 400, str(r.status_code))
        r = login(c, "admin", "admin", "admin123", "INTERMEDIATE")   # campus omitted
        check("Intermediate login without a campus rejected", r.status_code == 400,
              str(r.status_code))

    # 4c. Direct-ID access across campuses (the ID is known, the row is not)
    with app.test_client() as c:
        login(c, "admin", "admin", "admin123", "INTERMEDIATE", "BOYS")
        for path, label in [
            (f"/api/students/{girl_id}",              "GET girl student"),
            (f"/api/attendance/student/{girl_id}",    "GET girl attendance"),
            (f"/api/grades/{girl_id}",                "GET girl grades"),
            (f"/api/fees/{girl_id}/status",           "POST girl fee status"),
        ]:
            resp = (c.post(path, json={"status": "paid"}) if path.endswith("status")
                    else c.get(path))
            check(f"Boys admin blocked: {label}", resp.status_code == 404,
                  f"got {resp.status_code}")

        # write attempts
        resp = c.put(f"/api/students/{girl_id}", json={"name": "TAMPERED"})
        check("Boys admin cannot edit a Girls student", resp.status_code == 404,
              f"got {resp.status_code}")
        resp = c.delete(f"/api/students/{girl_id}")
        check("Boys admin cannot delete a Girls student", resp.status_code == 404,
              f"got {resp.status_code}")
        resp = c.post("/api/attendance", json={"studentId": girl_id, "status": "present"})
        check("Boys admin cannot mark a Girls student present", resp.status_code == 404,
              f"got {resp.status_code}")
        resp = c.post("/api/grades", json={"studentId": girl_id, "subject": "Physics",
                                           "midterm": 10, "final": 10, "internal": 10})
        check("Boys admin cannot grade a Girls student", resp.status_code == 404,
              f"got {resp.status_code}")
        if girls_class:
            resp = c.post("/api/students", json={"name": "Smuggled",
                                                 "classId": girls_class["id"]})
            check("Boys admin cannot create a student in a Girls class",
                  resp.status_code == 404, f"got {resp.status_code}")
            resp = c.get(f"/api/classes/{girls_class['id']}/sections")
            check("Boys admin cannot read Girls sections", resp.status_code == 404,
                  f"got {resp.status_code}")
        check("Girls student untouched in DB",
              (query("SELECT name FROM students WHERE id=%s", (girl_id,), one=True) or {})
              .get("name") != "TAMPERED")

    # 4d. Rewriting the signed session cookie is not possible, but rewriting the
    #     CLIENT-side view of it must not matter: hit the API with no session at
    #     all and with a junk cookie.
    with app.test_client() as c:
        r = c.get("/api/students")
        check("no session -> no data", r.status_code in (302, 401),
              f"got {r.status_code}")
    with app.test_client() as c:
        c.set_cookie("session", "eyJjb250ZXh0Ijp7ImNhbXB1cyI6IkdJUkxTIn19.forged")
        r = c.get("/api/students")
        check("forged session cookie -> no data", r.status_code in (302, 401),
              f"got {r.status_code}")

    # 4e. A Girls student cannot reach Boys data through the student portal
    with app.test_client() as c:
        r = login(c, "student", girl_id, "1234", "INTERMEDIATE", "GIRLS")
        if r.status_code == 200 and (r.get_json() or {}).get("success"):
            resp = c.get(f"/api/attendance/student/{boy_id}")
            check("Girls student blocked from Boys attendance", resp.status_code == 404,
                  f"got {resp.status_code}")
        else:
            check("Girls student login succeeds", False, r.get_data(as_text=True)[:200])

    # 4f. Switching context must force re-authentication
    with app.test_client() as c:
        login(c, "admin", "admin", "admin123", "INTERMEDIATE", "BOYS")
        r = c.post("/api/context/switch", json={"department": "INTERMEDIATE",
                                               "campus": "GIRLS"})
        body = r.get_json() or {}
        check("switch context asks for re-login", body.get("requiresLogin") is True, str(body))
        r2 = c.get("/api/students")
        check("session dropped after switch", r2.status_code in (302, 401),
              f"got {r2.status_code}")

    # ===============================================================
    # TEST 5 — logout clears the context
    # ===============================================================
    print("\nTEST 5 - Logout clears session + context")
    with app.test_client() as c:
        login(c, "admin", "admin", "admin123", "INTERMEDIATE", "BOYS")
        check("logout returns success", c.post("/api/logout").get_json().get("success"))
        check("/api/me refused after logout", c.get("/api/me").status_code in (302, 401))
        check("/api/students refused after logout",
              c.get("/api/students").status_code in (302, 401))
        r = c.get("/api/institutions")
        check("/api/institutions is public (Department Selection reachable)",
              r.status_code == 200 and len(r.get_json()) >= 2)

    # ---------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"{CHECKS - len(FAILURES)}/{CHECKS} checks passed")
    if FAILURES:
        print("FAILED:")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print("All isolation checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
