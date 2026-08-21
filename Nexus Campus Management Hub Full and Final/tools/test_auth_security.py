"""
tools/test_auth_security.py  --  black-box security tests for the login and
data-isolation rules (specification section 49).

Talks to a RUNNING dev server over HTTP, exactly like a browser -- or an
attacker with curl -- would.  Nothing here imports the app, so it proves the
behaviour of the real request path (session cookie included) rather than the
intent of the code.

Run:   python tools/test_auth_security.py [base-url]
Exit:  0 = every test passed, 1 = at least one failure.
"""
import json
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5000").rstrip("/")

ADMIN_PWD      = "admin123"
STUDENT_PWD    = "1234"
TEACHER_PWD    = "teach123"
BS_TEACHER_PWD = "teach1"

_passed, _failed = 0, 0
_failures = []


class Client:
    """One browser: its own cookie jar, so sessions never bleed between tests."""

    def __init__(self):
        self.jar = CookieJar()
        self.op  = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req  = urllib.request.Request(BASE + path, data=data, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
        try:
            with self.op.open(req, timeout=20) as r:
                raw, code = r.read().decode("utf-8", "replace"), r.status
        except urllib.error.HTTPError as e:
            raw, code = e.read().decode("utf-8", "replace"), e.code
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"_raw": raw[:200]}
        return code, payload

    def get(self, p):           return self.call("GET", p)
    def post(self, p, b=None):  return self.call("POST", p, {} if b is None else b)
    def put(self, p, b=None):   return self.call("PUT", p, {} if b is None else b)
    def delete(self, p):        return self.call("DELETE", p)

    def login(self, role, username, password, department=None, campus=None):
        return self.post("/api/login", {
            "role": role, "username": username, "password": password,
            "department": department, "campus": campus,
        })


def check(name, condition, detail=""):
    global _passed, _failed
    if condition:
        _passed += 1
        print("  PASS  " + name)
    else:
        _failed += 1
        _failures.append(name)
        print("  FAIL  " + name + ("   -> " + str(detail)[:220] if detail else ""))


def denied(code, payload, label):
    """A denial must be 401/403 and must not hand back a session or a user."""
    check(label + ": rejected (401/403)", code in (401, 403),
          "HTTP %s %s" % (code, payload))
    check(label + ": no success flag", not payload.get("success"), payload)
    check(label + ": no user object", "user" not in payload, payload)


def rows_of(payload):
    """The list endpoints return either a bare array or {"key": [...]}"""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for v in payload.values():
            if isinstance(v, list):
                return v
    return []


# ================================================================
print("\n--- 1. CREDENTIAL VERIFICATION -------------------------------")

denied(*Client().login("teacher", "zzz-not-a-user", "whatever", "INTER", "BOYS"),
       label="random username/password (teacher)")
denied(*Client().login("student", "nobody", "hunter2", "INTER", "BOYS"),
       label="random username/password (student)")
denied(*Client().login("admin", "nobody", "hunter2", "INTER", "BOYS"),
       label="random username/password (admin)")
denied(*Client().login("teacher", "ITB-001", "wrong-password", "INTER", "BOYS"),
       label="real teacher + wrong password")
denied(*Client().login("student", "INT-B-001", "wrong-password", "INTER", "BOYS"),
       label="real student + wrong password")
denied(*Client().login("admin", "admin", "wrong-password", "INTER", "BOYS"),
       label="admin + wrong password")

code, p = Client().login("teacher", "ITB-001", "", "INTER", "BOYS")
check("empty password is rejected",
      code in (400, 401, 403) and not p.get("success"), "HTTP %s %s" % (code, p))

code, p = Client().login("teacher", "ITB-001", TEACHER_PWD, "INTER", "BOYS")
check("valid teacher CAN log in", code == 200 and p.get("success"),
      "HTTP %s %s" % (code, p))

code, p = Client().login("student", "INT-G-001", STUDENT_PWD, "INTER", "GIRLS")
check("valid student CAN log in", code == 200 and p.get("success"),
      "HTTP %s %s" % (code, p))


print("\n--- 2. NO CREDENTIAL DISCLOSURE (section 13) -----------------")
for role, user in (("teacher", "ITB-001"), ("student", "INT-B-001"), ("admin", "admin")):
    code, p = Client().login(role, user, "wrong-password", "INTER", "BOYS")
    err = str(p.get("error", ""))
    check("%s failure hands out no sample credentials" % role,
          "Try" not in err and "001" not in err
          and TEACHER_PWD not in err and STUDENT_PWD not in err
          and ADMIN_PWD not in err, err)
    check("%s failure does not say which field was wrong" % role,
          err.strip().lower() == "invalid username or password", err)

code, p = Client().login("teacher", "definitely-not-a-teacher", "x", "INTER", "BOYS")
err_missing = str(p.get("error", ""))
code, p = Client().login("teacher", "ITB-001", "definitely-not-the-password", "INTER", "BOYS")
err_wrongpw = str(p.get("error", ""))
check("unknown user and wrong password are indistinguishable",
      err_missing == err_wrongpw, "%r vs %r" % (err_missing, err_wrongpw))


print("\n--- 3. DEPARTMENT ISOLATION: BS <-> INTERMEDIATE -------------")
denied(*Client().login("teacher", "T001", BS_TEACHER_PWD, "INTER", "BOYS"),
       label="BS teacher claiming Intermediate/Boys")
denied(*Client().login("teacher", "ITB-001", TEACHER_PWD, "BS", None),
       label="Intermediate teacher claiming BS")
denied(*Client().login("student", "S004", STUDENT_PWD, "INTER", "GIRLS"),
       label="BS student claiming Intermediate/Girls")
denied(*Client().login("student", "INT-B-001", STUDENT_PWD, "BS", None),
       label="Intermediate student claiming BS")


print("\n--- 4. CAMPUS ISOLATION: BOYS <-> GIRLS ----------------------")
denied(*Client().login("teacher", "ITB-001", TEACHER_PWD, "INTER", "GIRLS"),
       label="Boys teacher claiming Girls campus")
denied(*Client().login("teacher", "ITG-001", TEACHER_PWD, "INTER", "BOYS"),
       label="Girls teacher claiming Boys campus")
denied(*Client().login("student", "INT-G-001", STUDENT_PWD, "INTER", "BOYS"),
       label="Girls student claiming Boys campus")
denied(*Client().login("student", "INT-B-001", STUDENT_PWD, "INTER", "GIRLS"),
       label="Boys student claiming Girls campus")


print("\n--- 5. CONTEXT CLAIM VALIDATION ------------------------------")
for label, dept, campus in (("missing department", None, None),
                            ("Intermediate without a campus", "INTER", None),
                            ("unknown department", "MADE-UP-DEPT", "BOYS"),
                            ("campus of another department", "BS", "GIRLS"),
                            ("inactive/unknown campus code", "INTER", "NOPE")):
    code, p = Client().login("teacher", "ITB-001", TEACHER_PWD, dept, campus)
    check("%s is rejected" % label,
          code in (400, 403) and not p.get("success"), "HTTP %s %s" % (code, p))

code, p = Client().login("cleaner", "ITB-001", TEACHER_PWD, "INTER", "BOYS")
check("unknown role is rejected", code == 400 and not p.get("success"),
      "HTTP %s %s" % (code, p))


print("\n--- 6. UNAUTHENTICATED ACCESS (section 10) -------------------")
anon = Client()
for path in ("/api/students", "/api/teachers", "/api/classes", "/api/exams",
             "/api/notices", "/api/assignments", "/api/me",
             "/api/complaints", "/api/subadmins", "/api/dashboard",
             "/api/fees", "/api/attendance", "/api/grades",
             "/api/reports/attendance", "/api/system-info",
             "/api/classes/dropdown", "/api/context"):
    code, p = anon.get(path)
    check("GET %s without a session -> 401" % path, code == 401,
          "HTTP %s %s" % (code, p))
code, p = anon.delete("/api/students/INT-B-001")
check("DELETE without a session -> 401", code == 401, "HTTP %s %s" % (code, p))
code, p = anon.post("/api/students", {"name": "X"})
check("POST without a session -> 401", code == 401, "HTTP %s %s" % (code, p))
code, p = anon.post("/api/context/switch", {"department": "INTER", "campus": "GIRLS"})
check("context switch without a session -> 401", code == 401,
      "HTTP %s %s" % (code, p))
code, p = anon.get("/api/institutions")
check("the department list stays public (pre-login screen)", code == 200,
      "HTTP %s" % code)
check("the public department list leaks no records",
      not any("student" in str(k).lower() or "password" in str(k).lower()
              for d in rows_of(p) for k in d), rows_of(p)[:1])


print("\n--- 7. CROSS-CONTEXT DATA ACCESS (sections 11, 12) -----------")
boys = Client()
code, p = boys.login("admin", "admin", ADMIN_PWD, "INTER", "BOYS")
check("admin can enter Intermediate/Boys", code == 200 and p.get("success"),
      "HTTP %s %s" % (code, p))

code, p   = boys.get("/api/students")
students  = rows_of(p)
ids       = [s.get("id") for s in students]
check("Boys session lists only Boys students",
      bool(ids) and all(str(i).startswith("INT-B") for i in ids), ids)
check("student list carries no password field",
      not any("password" in str(k).lower() for s in students for k in s),
      [k for s in students[:1] for k in s])

code, p2 = boys.get("/api/students?campus=GIRLS&department=BS")
check("query-string campus/department tampering is ignored",
      [s.get("id") for s in rows_of(p2)] == ids, [s.get("id") for s in rows_of(p2)])

code, p3 = boys.get("/api/teachers")
tids = [t.get("id") for t in rows_of(p3)]
check("Boys session lists only Boys teachers",
      bool(tids) and all(str(i).startswith("ITB") for i in tids), tids)
check("teacher list carries no password field",
      not any("password" in str(k).lower() for t in rows_of(p3) for k in t), tids)

for path in ("/api/students/INT-G-001", "/api/students/S004",
             "/api/teachers/ITG-001", "/api/teachers/T001"):
    code, p = boys.get(path)
    check("GET %s from a Boys session is not readable" % path,
          code in (403, 404), "HTTP %s %s" % (code, p))

for path in ("/api/students/INT-G-001", "/api/teachers/ITG-001"):
    code, p = boys.delete(path)
    check("DELETE %s from a Boys session is refused" % path,
          code in (403, 404), "HTTP %s %s" % (code, p))

code, p = boys.put("/api/students/INT-G-001", {"name": "Tampered"})
check("PUT another campus's student is refused", code in (403, 404, 405),
      "HTTP %s %s" % (code, p))
code, p = boys.put("/api/teachers/ITG-001", {"name": "Tampered"})
check("PUT another campus's teacher is refused", code in (403, 404, 405),
      "HTTP %s %s" % (code, p))


print("\n--- 8. SESSION HYGIENE ---------------------------------------")
code, p = boys.get("/api/me")
check("/api/me works while logged in", code == 200, "HTTP %s %s" % (code, p))
check("/api/me returns no password",
      not any("password" in str(k).lower() for k in (p or {})), p)
check("/api/me reports the validated context",
      (p.get("context") or {}).get("campus") == "BOYS", p.get("context"))

code, p = boys.post("/api/logout")
check("logout succeeds", code == 200 and p.get("success"), "HTTP %s %s" % (code, p))
for path in ("/api/me", "/api/students", "/api/teachers"):
    code, p = boys.get(path)
    check("%s after logout -> 401" % path, code == 401, "HTTP %s %s" % (code, p))


print("\n--- 9. DISABLED ACCOUNT (section 2: verify account status) ----")
admin_b = Client()
admin_b.login("admin", "admin", ADMIN_PWD, "INTER", "BOYS")
code, p = admin_b.post("/api/portal/teacher/ITB-002", {"portal": "inactive"})
if code != 200:
    check("could disable a teacher for the test", False, "HTTP %s %s" % (code, p))
else:
    code, p = Client().login("teacher", "ITB-002", TEACHER_PWD, "INTER", "BOYS")
    check("disabled teacher cannot log in even with the right password",
          code in (401, 403) and not p.get("success"), "HTTP %s %s" % (code, p))
    check("disabled teacher gets no session", "user" not in p, p)
    admin_b.post("/api/portal/teacher/ITB-002", {"portal": "active"})
    code, p = Client().login("teacher", "ITB-002", TEACHER_PWD, "INTER", "BOYS")
    check("re-enabled teacher can log in again", code == 200 and p.get("success"),
          "HTTP %s %s" % (code, p))


print("\n--- 10. SAME USERNAME IN TWO INSTITUTIONS (section 5) --------")
# The Boys and Girls campuses each create an "office1" sub-admin with a
# DIFFERENT password.  Login must resolve the account by the selected
# institution, not by whichever row the database returns first.
admin_g = Client()
admin_g.login("admin", "admin", ADMIN_PWD, "INTER", "GIRLS")

made = {}
for label, client in (("BOYS", admin_b), ("GIRLS", admin_g)):
    code, p = client.post("/api/subadmins", {
        "name": "Office " + label, "username": "office1",
        "password": "pw-" + label.lower(), "permissions": ["students"],
    })
    check("%s campus can create the sub-admin 'office1'" % label,
          code in (200, 201) and p.get("success"), "HTTP %s %s" % (code, p))
    made[label] = p.get("id")

if all(made.values()):
    check("the two 'office1' accounts are different rows",
          made["BOYS"] != made["GIRLS"], made)

    code, p = Client().login("admin", "office1", "pw-boys", "INTER", "BOYS")
    check("Boys office1 logs into Boys", code == 200 and p.get("success"),
          "HTTP %s %s" % (code, p))
    check("Boys office1 gets the Boys row",
          (p.get("user") or {}).get("id") == made["BOYS"], p.get("user"))

    code, p = Client().login("admin", "office1", "pw-girls", "INTER", "GIRLS")
    check("Girls office1 logs into Girls", code == 200 and p.get("success"),
          "HTTP %s %s" % (code, p))
    check("Girls office1 gets the Girls row",
          (p.get("user") or {}).get("id") == made["GIRLS"], p.get("user"))

    denied(*Client().login("admin", "office1", "pw-boys", "INTER", "GIRLS"),
           label="Boys office1 password on the Girls campus")
    denied(*Client().login("admin", "office1", "pw-girls", "INTER", "BOYS"),
           label="Girls office1 password on the Boys campus")
    denied(*Client().login("admin", "office1", "pw-boys", "BS", None),
           label="Boys office1 in the BS department")

    # A Boys admin must not be able to delete the Girls campus's sub-admin.
    code, p = admin_b.delete("/api/subadmins/" + str(made["GIRLS"]))
    check("Boys admin cannot delete the Girls sub-admin", code in (403, 404),
          "HTTP %s %s" % (code, p))

    # Clean up: each institution removes its own.
    for label, client in (("BOYS", admin_b), ("GIRLS", admin_g)):
        code, p = client.delete("/api/subadmins/" + str(made[label]))
        check("%s campus can delete its own sub-admin" % label,
              code == 200 and p.get("success"), "HTTP %s %s" % (code, p))
    code, p = Client().login("admin", "office1", "pw-boys", "INTER", "BOYS")
    check("a deleted sub-admin can no longer log in",
          code in (401, 403) and not p.get("success"), "HTTP %s %s" % (code, p))


print("\n--- 11. DEEP CROSS-CONTEXT PROBES (sections 11, 12) ----------")
# ids 9/10/11 are the Girls campus classes, 1..5 belong to BS;
# sections 13..16 hang off the Girls classes.
probe = Client()
probe.login("admin", "admin", ADMIN_PWD, "INTER", "BOYS")
for method, path in (
        ("GET",    "/api/classes/9/sections"),
        ("PUT",    "/api/classes/9"),
        ("DELETE", "/api/classes/9"),
        ("PATCH",  "/api/classes/9/status"),
        ("GET",    "/api/sections/13/students"),
        ("PUT",    "/api/sections/13"),
        ("DELETE", "/api/sections/13"),
        ("GET",    "/api/classes/1/sections"),
        ("GET",    "/api/attendance/student/INT-G-001"),
        ("GET",    "/api/grades/INT-G-001"),
        ("POST",   "/api/fees/INT-G-001/status"),
        ("POST",   "/api/fees/S004/status"),
        ("GET",    "/api/teacher/ITG-001/students"),
        ("GET",    "/api/timetable/ITG-001"),
        ("POST",   "/api/portal/student/INT-G-001"),
        ("POST",   "/api/portal/teacher/ITG-001")):
    code, p = probe.call(method, path, None if method == "GET" else {})
    check("%-6s %-38s is refused" % (method, path),
          code in (400, 403, 404, 405), "HTTP %s %s" % (code, p))

code, p = probe.get("/api/classes")
cids = [c.get("id") for c in rows_of(p)]
check("class list holds only this campus's classes",
      set(cids) <= {6, 7, 8}, cids)
code, p = probe.get("/api/dashboard")
check("dashboard counts only this campus's students",
      isinstance(p, dict) and p.get("totalStudents") == 4,
      p if not isinstance(p, dict) else p.get("totalStudents"))
probe.post("/api/logout")


print("\n=============================================================")
print("  %d passed, %d failed" % (_passed, _failed))
if _failures:
    print("  failing checks:")
    for f in _failures:
        print("    - " + f)
print("=============================================================")
sys.exit(1 if _failed else 0)
