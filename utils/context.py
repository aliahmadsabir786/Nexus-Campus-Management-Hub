"""
utils/context.py  —  Institution Context (Department + Campus) & Data Isolation
==============================================================================

    NCMH
     ├── BS DEPARTMENT              (independent, campus-less from the user's
     │                               point of view — rows still carry the
     │                               implicit "Main BS Campus")
     └── INTERMEDIATE DEPARTMENT
           ├── BOYS CAMPUS
           └── GIRLS CAMPUS

ONE codebase, ONE database, ONE implementation of every module — the data a
request may touch is decided *here*, from the authenticated session, and
nowhere else.

Security model
--------------
1. The department/campus a browser sends at login is only a **claim**.
   ``resolve_context()`` validates it against the ``departments`` /
   ``campuses`` tables, and ``authorize_user_context()`` then checks the
   authenticated account really belongs to that context.
2. Once validated, the context is written into ``session["user_info"]``
   (server-side session payload, signed cookie) and is the ONLY source used
   afterwards.  Nothing in a request body / query string / localStorage can
   change it, so tampering with JavaScript cannot switch BOYS → GIRLS.
3. Every institution-specific query appends the clause produced by
   ``ctx_and()`` / ``ctx_clause()`` (or the ``in_context_subquery()`` form
   for child tables).  If a session somehow carries no context the clause
   degrades to ``1=0`` — fail closed, never fail open.
4. Rows outside the caller's context are reported as *not found* rather than
   *forbidden*, so one campus cannot even probe for the existence of
   another campus's records.

Which tables own a context column
---------------------------------
Owned   : students, teachers, classes, exams, assignments, notices, sub_admins
Inherited via FKs (no duplicated columns):
          sections, class_students        → classes
          attendance, grades, complaints,
          fee_vouchers, fee_plans,
          fee_installments                → students
          teacher_assignments, timetables → teachers
          submissions                     → assignments
"""

from flask import jsonify, request, session
from flask_login import current_user, login_required
from functools import wraps

from config import (
    CAMPUS_BOYS,
    CAMPUS_GIRLS,
    DEFAULT_LOGOS,
    DEPARTMENTS_REQUIRING_CAMPUS,
    DEPT_BS,
    DEPT_INTER,
    ID_PREFIXES,
    INSTITUTION_NAME,
)
from db import query

# Logical department names exposed to the session / frontend (spec §13:
# session["user_info"]["department"] == "INTERMEDIATE").
_LOGICAL_DEPARTMENT = {
    DEPT_BS:    "BS",
    DEPT_INTER: "INTERMEDIATE",
}

# ...and the reverse, so a caller may send either the database code ("INTER")
# or the logical name it sees in the context badge ("INTERMEDIATE").  Accepting
# both is a convenience only: the value is still looked up in `departments`
# before it means anything.
_DEPARTMENT_ALIASES = {
    logical: code for code, logical in _LOGICAL_DEPARTMENT.items()
}


# ================================================================
# HIERARCHY LOOKUPS  (read-only reference data)
# ================================================================
def _logo_for(row, code):
    """Row-level logo_path wins; otherwise fall back to the configured path."""
    return (row.get("logo_path") or DEFAULT_LOGOS.get(str(code).upper()) or None)


def department_requires_campus(dept_row):
    """True when a campus MUST be chosen before login (Intermediate)."""
    if not dept_row:
        return False
    if dept_row.get("has_campuses"):
        return True
    return str(dept_row.get("code", "")).upper() in {
        str(c).upper() for c in DEPARTMENTS_REQUIRING_CAMPUS
    }


def get_department_by_code(code):
    if not code:
        return None
    wanted = str(code).strip().upper()
    wanted = _DEPARTMENT_ALIASES.get(wanted, wanted)
    return query(
        "SELECT * FROM departments WHERE UPPER(code)=%s",
        (wanted,), one=True
    )


def get_campus_by_code(code, department_id=None):
    if not code:
        return None
    if department_id:
        return query(
            "SELECT * FROM campuses WHERE UPPER(code)=%s AND department_id=%s",
            (str(code).strip().upper(), department_id), one=True
        )
    return query(
        "SELECT * FROM campuses WHERE UPPER(code)=%s",
        (str(code).strip().upper(),), one=True
    )


def get_campuses(department_id, active_only=True):
    sql  = "SELECT * FROM campuses WHERE department_id=%s"
    args = [department_id]
    if active_only:
        sql += " AND status='active'"
    sql += " ORDER BY sort_order, id"
    return query(sql, args)


def default_campus_id(department_id):
    """
    The campus new rows are filed under when the session has no campus
    (i.e. the BS department, which the user never picks a campus for).
    """
    row = query(
        "SELECT id FROM campuses WHERE department_id=%s AND status='active' "
        "ORDER BY sort_order, id LIMIT 1",
        (department_id,), one=True
    )
    return row["id"] if row else None


def list_institutions(active_only=True):
    """
    Department tree for the selection screens.  Public (pre-login) data:
    names, descriptions, logo paths and whether a campus choice is needed.
    Never includes counts or any record-level information.
    """
    sql = "SELECT * FROM departments"
    if active_only:
        sql += " WHERE status='active'"
    sql += " ORDER BY sort_order, id"

    out = []
    for d in query(sql):
        campuses = get_campuses(d["id"], active_only=active_only)
        out.append({
            "id":             d["id"],
            "code":           d["code"],
            "name":           d["name"],
            "description":    d.get("description") or "",
            "logo":           _logo_for(d, d["code"]),
            "requiresCampus": department_requires_campus(d),
            "campuses": [{
                "id":          c["id"],
                "code":        c["code"],
                "name":        c["name"],
                "description": c.get("description") or "",
                "logo":        _logo_for(c, c["code"]),
            } for c in campuses],
        })
    return out


# ================================================================
# CONTEXT OBJECT
# ================================================================
def build_context(dept_row, campus_row=None):
    """Normalise a (department, campus) pair into the session context dict."""
    code = str(dept_row["code"]).upper()
    logical = _LOGICAL_DEPARTMENT.get(code, code)

    dept_short = dept_row["name"].replace(" Department", "").strip()
    if campus_row:
        label = f"{dept_short} • {campus_row['name']}"
        title = f"{dept_short} — {campus_row['name']}"
    else:
        label = dept_row["name"]
        title = dept_row["name"]

    return {
        "department":      logical,                 # "BS" | "INTERMEDIATE"
        "department_id":   dept_row["id"],
        "department_code": code,
        "department_name": dept_row["name"],
        "campus":          str(campus_row["code"]).upper() if campus_row else None,
        "campus_id":       campus_row["id"] if campus_row else None,
        "campus_code":     str(campus_row["code"]).upper() if campus_row else None,
        "campus_name":     campus_row["name"] if campus_row else None,
        "label":           label,                   # header badge
        "title":           title,                   # dashboard heading
        "institution":     INSTITUTION_NAME,
        "logo":            _logo_for(campus_row or dept_row,
                                    (campus_row or dept_row)["code"]),
    }


def resolve_context(dept_code, campus_code=None):
    """
    Validate a **claimed** department/campus pair against the database.

    Returns ``(context_dict, None)`` on success or ``(None, error_message)``.
    Called at login time — never trusts the incoming values for anything
    beyond looking them up.
    """
    code = str(dept_code or "").strip().upper()
    if not code:
        return None, "Please select a department first"

    dept = get_department_by_code(code)
    if not dept:
        return None, "Unknown department selected"
    if dept.get("status") != "active":
        return None, f"{dept['name']} is currently inactive"

    needs_campus = department_requires_campus(dept)
    wanted       = str(campus_code or "").strip().upper() or None
    campus       = None

    if wanted:
        campus = get_campus_by_code(wanted, dept["id"])
        if not campus:
            # Either a bogus code, or a campus belonging to another department
            return None, "The selected campus does not belong to this department"
        if campus.get("status") != "active":
            return None, f"{campus['name']} is currently inactive"

    if needs_campus and not campus:
        return None, "Please select a campus first"
    if not needs_campus:
        # BS keeps campus = None in the session (spec §13)
        campus = None

    return build_context(dept, campus), None


# ================================================================
# CURRENT (AUTHENTICATED) CONTEXT — the only trusted source
# ================================================================
def get_current_context():
    """
    Context of the logged-in user, read from the server-side session
    payload.  Returns ``{}`` when the session predates this feature or the
    user is not logged in — callers then fail closed.
    """
    ctx = getattr(current_user, "context", None)
    if isinstance(ctx, dict) and ctx.get("department_id"):
        return ctx
    info = session.get("user_info") or {}
    ctx  = info.get("context") or {}
    return ctx if isinstance(ctx, dict) else {}


def has_context():
    return bool(get_current_context().get("department_id"))


def get_current_department():
    """Logical department name of the caller: "BS" / "INTERMEDIATE" / None."""
    return get_current_context().get("department")


def get_current_campus():
    """Campus code of the caller: "BOYS" / "GIRLS" / None (BS)."""
    return get_current_context().get("campus")


def current_department_id():
    return get_current_context().get("department_id")


def current_campus_id():
    return get_current_context().get("campus_id")


def context_label():
    """Short badge label, e.g. "Intermediate • Girls Campus"."""
    return get_current_context().get("label") or ""


def context_title():
    """Dashboard heading, e.g. "NEXus Solution / Intermediate — Boys Campus"."""
    ctx = get_current_context()
    if not ctx:
        return INSTITUTION_NAME
    return f"{ctx.get('institution', INSTITUTION_NAME)} / {ctx.get('title', '')}".strip(" /")


def public_context():
    """Context subset that is safe to hand back to the browser."""
    ctx = get_current_context()
    if not ctx:
        return None
    return {
        "department":     ctx.get("department"),
        "departmentCode": ctx.get("department_code"),
        "departmentName": ctx.get("department_name"),
        "campus":         ctx.get("campus"),
        "campusName":     ctx.get("campus_name"),
        "label":          ctx.get("label"),
        "title":          ctx.get("title"),
        "institution":    ctx.get("institution", INSTITUTION_NAME),
        "logo":           ctx.get("logo"),
    }


# ================================================================
# LOGIN-TIME AUTHORIZATION
# ================================================================
# One message for every context refusal (spec §13).  Naming the department or
# campus an account *does* belong to would turn a failed login into a directory
# lookup, so the wording is identical whichever check failed.
CONTEXT_DENIED = "This account is not authorized for the selected department/campus."


def campus_ids_of(department_id):
    """Every campus id belonging to a department (any status)."""
    if not department_id:
        return set()
    return {c["id"] for c in query(
        "SELECT id FROM campuses WHERE department_id=%s", (department_id,))}


def account_in_context(row, ctx):
    """
    ``True`` only when the account row provably belongs to ``ctx``.

    Fail CLOSED at every step — a missing value is a refusal, never a pass:

    * no ``department_id`` on the row  → refuse.  An account that is not
      filed under a department cannot be shown to belong to the selected one.
    * different department             → refuse (BS ↔ Intermediate).
    * a campus was selected and the row's campus differs, or is missing
                                      → refuse (Boys ↔ Girls).  The earlier
      version skipped this check when the row's campus was NULL, which would
      have let one un-filed Intermediate account sign into both campuses.
    * no campus in the context (BS)   → the row's campus, if any, must still
      be one of that department's own campuses, so a mis-filed row cannot
      ride in on the department match alone.
    """
    if not isinstance(row, dict) or not isinstance(ctx, dict):
        return False

    row_dept   = row.get("department_id")
    row_campus = row.get("campus_id")
    sel_dept   = ctx.get("department_id")
    sel_campus = ctx.get("campus_id")

    if not row_dept or not sel_dept or row_dept != sel_dept:
        return False

    if sel_campus:
        return bool(row_campus) and row_campus == sel_campus

    # Department selected without a campus (BS): a campus on the row is
    # allowed only if it is one of this department's campuses.
    if row_campus and row_campus not in campus_ids_of(sel_dept):
        return False
    return True


def authorize_user_context(row, ctx):
    """
    Login-time gate: may this authenticated account operate inside ``ctx``?

    Returns ``(True, None)`` or ``(False, message)``.  This is what stops
    "Intermediate + Boys" credentials from being used to enter
    "Intermediate + Girls", and BS credentials from entering Intermediate.
    """
    if account_in_context(row, ctx):
        return True, None
    return False, CONTEXT_DENIED


# ================================================================
# REQUEST-TIME AUTHORIZATION  (spec §9, §10)
# ================================================================
# Endpoints that are reachable without a session, because they are what a
# visitor needs *before* one exists.  Everything else under /api/ is refused
# by install_api_guard() unless the session carries a validated context.
PUBLIC_API_PATHS = frozenset({
    "/api/login",          # the only way to obtain a session
    "/api/institutions",   # department/campus tree for the selection screens
    "/api/logout",         # must stay reachable so a broken session can be cleared
})


def _same_department(ctx, wanted):
    w = str(wanted).strip().upper()
    w = _DEPARTMENT_ALIASES.get(w, w)
    return w in {str(ctx.get("department_code") or "").upper(),
                 str(_DEPARTMENT_ALIASES.get(str(ctx.get("department") or "").upper(),
                                             ctx.get("department") or "")).upper()}


def require_context(department=None, campus=None, role=None):
    """
    The one decorator every context-sensitive endpoint can use (spec §9).

    Composes the three questions a protected route has to ask, in order:

    1. is there a session at all?              → 401 (via ``login_required``)
    2. does it carry a *validated* context?     → 401, because a session
       without one cannot be scoped to any data
    3. is that context the one this endpoint
       is restricted to, and is the role
       allowed?                                → 403

    ``department`` accepts either the database code ("INTER") or the logical
    name ("INTERMEDIATE").  Omit both arguments to mean "any context, as long
    as it is a real one" — which is what most endpoints want, since the row
    filtering itself is done by ``ctx_clause()``.
    """
    roles = {role} if isinstance(role, str) else (set(role) if role else None)

    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            ctx = get_current_context()
            if not ctx.get("department_id"):
                return jsonify({
                    "error": "Your session has no institution context. Please sign in again.",
                    "authenticated": False,
                }), 401
            if roles and getattr(current_user, "role", None) not in roles:
                return jsonify({"error": "Not authorized for this action"}), 403
            if department and not _same_department(ctx, department):
                return jsonify({"error": CONTEXT_DENIED}), 403
            if campus and str(ctx.get("campus") or "").upper() != str(campus).strip().upper():
                return jsonify({"error": CONTEXT_DENIED}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def install_api_guard(app):
    """
    Single choke point in front of every /api/ endpoint (spec §10).

    The per-route decorators stay exactly as they are — this is the belt to
    their braces: if a new endpoint is ever added without a guard, or a
    session survives from before the department/campus split, the request is
    still answered with 401 instead of leaking a department's data.
    """
    @app.before_request
    def _guard_api():                                     # pragma: no cover
        path = request.path or ""
        if not path.startswith("/api/") or path in PUBLIC_API_PATHS:
            return None
        if not current_user.is_authenticated:
            return jsonify({"error": "Authentication required",
                            "authenticated": False}), 401
        if not get_current_context().get("department_id"):
            return jsonify({
                "error": "Your session has no institution context. Please sign in again.",
                "authenticated": False,
            }), 401
        return None


# ================================================================
# SQL SCOPING HELPERS
# ================================================================
def ctx_clause(alias=None):
    """
    Build the WHERE fragment isolating the caller's data.

    Returns ``(sql_fragment, params)``.  For the BS department the session
    carries no campus, so only the department is constrained (a department
    with a single campus needs nothing more).  For Intermediate both the
    department and the campus are constrained.

    With no context at all the fragment is ``1=0`` → the query can only
    return an empty set (fail closed).
    """
    ctx = get_current_context()
    dept_id, campus_id = ctx.get("department_id"), ctx.get("campus_id")
    p = f"{alias}." if alias else ""

    if not dept_id:
        return "1=0", []
    if campus_id:
        return f"{p}department_id=%s AND {p}campus_id=%s", [dept_id, campus_id]
    return f"{p}department_id=%s", [dept_id]


def ctx_and(alias=None):
    """``ctx_clause`` prefixed with " AND " — for "WHERE 1=1" style SQL."""
    clause, params = ctx_clause(alias)
    return f" AND {clause}", params


def apply_ctx(sql, args, alias=None):
    """
    Append the context filter to an existing "... WHERE 1=1 ..." query.
    Returns the new ``(sql, args)`` pair.
    """
    clause, params = ctx_and(alias)
    return sql + clause, list(args or []) + params


def in_context_subquery(table, id_col="id", alias=None):
    """
    ``(sql, params)`` for a sub-select of the in-context primary keys of a
    context-owning table.  Used to scope child tables that inherit their
    context through a foreign key, e.g.::

        sub, p = in_context_subquery("students")
        rows = query(f"SELECT * FROM attendance WHERE student_id IN ({sub})", p)
    """
    clause, params = ctx_clause(alias)
    return f"SELECT {id_col} FROM {table} WHERE {clause}", params


def context_student_ids():
    """All student IDs visible in the caller's context."""
    clause, params = ctx_clause()
    return [r["id"] for r in query(f"SELECT id FROM students WHERE {clause}", params)]


def context_teacher_ids():
    """All teacher IDs visible in the caller's context."""
    clause, params = ctx_clause()
    return [r["id"] for r in query(f"SELECT id FROM teachers WHERE {clause}", params)]


def write_context():
    """
    ``(department_id, campus_id)`` to stamp on rows the caller creates.
    BS sessions have no campus, so the department's default campus is used
    — every row stays fully qualified in the database.
    """
    ctx = get_current_context()
    dept_id   = ctx.get("department_id")
    campus_id = ctx.get("campus_id")
    if dept_id and not campus_id:
        campus_id = default_campus_id(dept_id)
    return dept_id, campus_id


# ================================================================
# ROW-LEVEL MEMBERSHIP CHECKS
# ================================================================
# How each table's context is obtained.  Tables that own the columns read
# them directly; child tables join up to their owner.
_CTX_SOURCE_SQL = {
    "students":    "SELECT department_id, campus_id FROM students WHERE id=%s",
    "teachers":    "SELECT department_id, campus_id FROM teachers WHERE id=%s",
    "classes":     "SELECT department_id, campus_id FROM classes WHERE id=%s",
    "exams":       "SELECT department_id, campus_id FROM exams WHERE id=%s",
    "assignments": "SELECT department_id, campus_id FROM assignments WHERE id=%s",
    "notices":     "SELECT department_id, campus_id FROM notices WHERE id=%s",
    "sub_admins":  "SELECT department_id, campus_id FROM sub_admins WHERE id=%s",
    "sections": (
        "SELECT c.department_id, c.campus_id FROM sections s "
        "JOIN classes c ON c.id = s.class_id WHERE s.id=%s"
    ),
    "class_students": (
        "SELECT c.department_id, c.campus_id FROM class_students cs "
        "JOIN sections s ON s.id = cs.section_id "
        "JOIN classes  c ON c.id = s.class_id WHERE cs.id=%s"
    ),
    "submissions": (
        "SELECT a.department_id, a.campus_id FROM submissions sb "
        "JOIN assignments a ON a.id = sb.assignment_id WHERE sb.id=%s"
    ),
    "complaints": (
        "SELECT s.department_id, s.campus_id FROM complaints cm "
        "JOIN students s ON s.id = cm.student_id WHERE cm.id=%s"
    ),

    # ---- BS academic architecture (migration 003) ----------------------
    # Aggregate-root tables own department_id/campus_id and are read direct.
    "bs_programs":          "SELECT department_id, campus_id FROM bs_programs WHERE id=%s",
    "bs_academic_sessions": "SELECT department_id, campus_id FROM bs_academic_sessions WHERE id=%s",
    "bs_courses":           "SELECT department_id, campus_id FROM bs_courses WHERE id=%s",
    "bs_curriculums":       "SELECT department_id, campus_id FROM bs_curriculums WHERE id=%s",
    "bs_batches":           "SELECT department_id, campus_id FROM bs_batches WHERE id=%s",
    "bs_course_offerings":  "SELECT department_id, campus_id FROM bs_course_offerings WHERE id=%s",
    # Child tables inherit context through their owner via a foreign key,
    # so the columns are never duplicated (spec §33).
    "bs_curriculum_courses": (
        "SELECT cu.department_id, cu.campus_id FROM bs_curriculum_courses cc "
        "JOIN bs_curriculums cu ON cu.id = cc.curriculum_id WHERE cc.id=%s"
    ),
    "bs_elective_groups": (
        "SELECT cu.department_id, cu.campus_id FROM bs_elective_groups eg "
        "JOIN bs_curriculums cu ON cu.id = eg.curriculum_id WHERE eg.id=%s"
    ),
    "bs_offering_sections": (
        "SELECT o.department_id, o.campus_id FROM bs_offering_sections os "
        "JOIN bs_course_offerings o ON o.id = os.offering_id WHERE os.id=%s"
    ),
    "bs_teaching_assignments": (
        "SELECT o.department_id, o.campus_id FROM bs_teaching_assignments ta "
        "JOIN bs_offering_sections os ON os.id = ta.offering_section_id "
        "JOIN bs_course_offerings o ON o.id = os.offering_id WHERE ta.id=%s"
    ),
    "bs_enrollments": (
        "SELECT o.department_id, o.campus_id FROM bs_enrollments en "
        "JOIN bs_offering_sections os ON os.id = en.offering_section_id "
        "JOIN bs_course_offerings o ON o.id = os.offering_id WHERE en.id=%s"
    ),
    "bs_course_attempts": (
        "SELECT c.department_id, c.campus_id FROM bs_course_attempts at "
        "JOIN bs_courses c ON c.id = at.course_id WHERE at.id=%s"
    ),
    "bs_timetable_slots": (
        "SELECT o.department_id, o.campus_id FROM bs_timetable_slots ts "
        "JOIN bs_offering_sections os ON os.id = ts.offering_section_id "
        "JOIN bs_course_offerings o ON o.id = os.offering_id WHERE ts.id=%s"
    ),
    "bs_attendance": (
        "SELECT o.department_id, o.campus_id FROM bs_attendance a "
        "JOIN bs_offering_sections os ON os.id = a.offering_section_id "
        "JOIN bs_course_offerings o ON o.id = os.offering_id WHERE a.id=%s"
    ),

    # ---- BS sessional marks (migration 005) -----------------------------
    "bs_sessional_components": (
        "SELECT o.department_id, o.campus_id FROM bs_sessional_components sc "
        "JOIN bs_course_offerings o ON o.id = sc.offering_id WHERE sc.id=%s"
    ),
    "bs_sessional_marks": (
        "SELECT o.department_id, o.campus_id FROM bs_sessional_marks sm "
        "JOIN bs_offering_sections os ON os.id = sm.offering_section_id "
        "JOIN bs_course_offerings o ON o.id = os.offering_id WHERE sm.id=%s"
    ),
}


def row_context(table, pk_value):
    """Context of one row, or ``None`` when the row does not exist."""
    sql = _CTX_SOURCE_SQL.get(table)
    if not sql:
        raise ValueError(f"No context source defined for table '{table}'")
    return query(sql, (pk_value,), one=True)


def in_context(table, pk_value):
    """
    ``True``  → row exists and belongs to the caller's context
    ``False`` → row exists but belongs to another department/campus
    ``None``  → row does not exist
    """
    ctx = get_current_context()
    if not ctx.get("department_id"):
        return False

    row = row_context(table, pk_value)
    if row is None:
        return None
    if row.get("department_id") != ctx["department_id"]:
        return False
    if ctx.get("campus_id") and row.get("campus_id") != ctx["campus_id"]:
        return False
    return True


def assert_in_context(table, pk_value, label="Record"):
    """
    Route-body guard.  Returns ``None`` when access is allowed, otherwise a
    ready-to-return ``(response, 404)`` tuple.

    404 (not 403) is deliberate: a record from another campus must be
    indistinguishable from a record that does not exist, so no one can
    enumerate the other campus's IDs.
    """
    ok = in_context(table, pk_value)
    if ok:
        return None
    return jsonify({"error": f"{label} not found"}), 404


def assert_student_in_context(sid):
    return assert_in_context("students", sid, "Student")


def assert_teacher_in_context(tid):
    return assert_in_context("teachers", tid, "Teacher")


def assert_class_in_context(cid):
    return assert_in_context("classes", cid, "Class")


def assert_section_in_context(sec_id):
    return assert_in_context("sections", sec_id, "Section")


# ================================================================
# CONTEXT-AWARE ID GENERATION
# ================================================================
def context_id_prefix(kind, ctx=None):
    """
    ID prefix for new records in a context, e.g. ``students`` → ``"S"`` for
    BS, ``"INT-B-"`` for Intermediate Boys.  Defaults to the caller's own
    context; pass ``ctx`` explicitly when no session exists yet (login
    hints).  Falls back to the legacy single-letter prefixes so BS keeps
    its historical ``S001`` / ``T001`` scheme.
    """
    legacy = {"students": "S", "teachers": "T"}
    ctx    = ctx if isinstance(ctx, dict) else get_current_context()
    dept   = ctx.get("department_code")
    campus = ctx.get("campus_code")

    for key in ((dept, campus), (dept, None)):
        table = ID_PREFIXES.get(key)
        if table and table.get(kind):
            return table[kind]

    if not dept:
        return legacy.get(kind, "X")
    # Unknown/newly added context — derive something readable and unique
    suffix = f"{campus[0]}-" if campus else ""
    return f"{str(dept)[:3].upper()}-{suffix}"


def next_context_id(table, kind):
    """
    Next sequential ID within the caller's context, e.g. ``INT-B-005``.
    Unlike ``utils.auth.next_id`` this understands multi-character
    prefixes, and counting only in-prefix rows keeps each context's
    numbering independent.
    """
    prefix = context_id_prefix(kind)
    rows   = query(f"SELECT id FROM {table} WHERE id LIKE %s", (prefix + "%",))
    n      = len(prefix)
    nums   = []
    for r in rows:
        tail = str(r["id"])[n:]
        if tail.isdigit():
            nums.append(int(tail))
    return prefix + str(max(nums, default=0) + 1).zfill(3)


# Convenience re-exports for route modules
__all__ = [
    "CAMPUS_BOYS", "CAMPUS_GIRLS", "DEPT_BS", "DEPT_INTER",
    "list_institutions", "resolve_context", "build_context",
    "department_requires_campus", "get_department_by_code", "get_campus_by_code",
    "get_campuses", "default_campus_id",
    "get_current_context", "has_context", "get_current_department",
    "get_current_campus", "current_department_id", "current_campus_id",
    "context_label", "context_title", "public_context",
    "authorize_user_context", "account_in_context", "campus_ids_of",
    "CONTEXT_DENIED", "require_context", "install_api_guard",
    "PUBLIC_API_PATHS",
    "ctx_clause", "ctx_and", "apply_ctx", "in_context_subquery",
    "context_student_ids", "context_teacher_ids", "write_context",
    "row_context", "in_context", "assert_in_context",
    "assert_student_in_context", "assert_teacher_in_context",
    "assert_class_in_context", "assert_section_in_context",
    "context_id_prefix", "next_context_id",
]