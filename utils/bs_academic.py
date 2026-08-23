"""
utils/bs_academic.py  —  shared plumbing for the BS academic architecture.

Everything the two BS academic blueprints (routes/bs_curriculum.py and
routes/bs_offerings.py) need in common lives here, so neither the guards nor
the serializers are written twice (spec §33 — reuse relationships, do not
duplicate).

THE MODEL THIS SUPPORTS
-----------------------
    BS PROGRAM
      -> CURRICULUM VERSION      what is *normally* required
           -> CURRICULUM COURSE  course + RECOMMENDED semester
      -> BATCH                   a cohort, pinned to one curriculum version
    ACADEMIC SESSION             Fall 2027, Spring 2028 ...
      -> COURSE OFFERING         course + session + ACTUAL semester
           -> OFFERING SECTION   A / B / C of the SAME course
                -> TEACHING ASSIGNMENT   teacher teaches this section
                -> ENROLLMENT            student takes this section
                -> TIMETABLE SLOT        weekly lectures

A course is never hard-coded to a semester.  The recommended semester lives
on the curriculum mapping; the actual semester lives on the offering.  Both
coexist, which is what lets a course be offered "off-plan" in one session
without rewriting the curriculum (spec §9).

AUTHORIZATION
-------------
`bs_read` / `bs_write` are the only two decorators the routes use.  Both
pin the caller to the BS department at the backend, so a signed-in
Intermediate admin cannot reach these endpoints even by crafting the
request by hand (spec §39 — never rely on frontend hiding).
"""

from functools import wraps

from flask import jsonify
from flask_login import current_user

from db import query
from utils.auth import perm_required
from utils.context import ctx_clause, require_context, write_context

# Grade point scale used for GPA / CGPA.  Kept in one place so the admin UI,
# the transcript and the progress endpoint can never disagree.
GRADE_POINTS = {
    "A+": 4.00, "A": 4.00, "A-": 3.67,
    "B+": 3.33, "B": 3.00, "B-": 2.67,
    "C+": 2.33, "C": 2.00, "C-": 1.67,
    "D+": 1.33, "D": 1.00,
    "F":  0.00,
}

# A course attempt only counts toward earned credit hours in these states.
PASSED_STATES = ("passed",)

OFFERING_STATUSES = ("planned", "open", "ongoing", "completed", "cancelled")


# ================================================================
# AUTHORIZATION DECORATORS
# ================================================================
def bs_read(f):
    """
    Read access to the BS academic structure.

    Any authenticated user whose validated context is the BS department:
    admins, sub-admins, teachers and students all need to read parts of the
    catalogue.  Row-level scoping is still done by ``ctx_clause()`` in every
    query, and the personal endpoints narrow further to the caller.
    """
    return require_context(department="BS")(f)


def bs_write(perm="classes"):
    """
    Structural write access (create/update/delete curriculum, offerings,
    sections, assignments, enrollments).

    Deliberately stricter than ``perm_required`` alone: ``can_access()``
    returns True for any non-admin role, so a *teacher's* session would sail
    through ``perm_required`` untouched.  Requiring ``role="admin"`` as well
    means only full admins and permitted sub-admins can reshape the
    academic structure.
    """
    def decorator(f):
        return require_context(department="BS", role="admin")(perm_required(perm)(f))
    return decorator


def bs_teacher_only(f):
    """A teacher's own-data endpoint (spec §31)."""
    return require_context(department="BS", role="teacher")(f)


def bs_student_only(f):
    """A student's own-data endpoint (spec §32)."""
    return require_context(department="BS", role="student")(f)


# ================================================================
# CONTEXT HELPERS
# ================================================================
def bs_write_context():
    """
    ``(department_id, campus_id, error_response)`` for a new BS row.

    ``error_response`` is a ready-to-return tuple when the session has no
    usable context, so callers stay a single ``if`` long.
    """
    dept_id, campus_id = write_context()
    if not dept_id:
        return None, None, (jsonify({
            "error": "No institution context - please sign in again"
        }), 403)
    return dept_id, campus_id, None


def json_error(msg, code=400):
    return jsonify({"error": msg}), code


def parse_int(value, default=None):
    """Lenient int parse — form values arrive as strings, blanks as ''."""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def clean(value, upper=False):
    s = str(value or "").strip()
    return s.upper() if upper else s


# ================================================================
# SERIALIZERS  (snake_case DB -> camelCase JSON, matching the existing API)
# ================================================================
def safe_program(r):
    return {
        "id":                  r["id"],
        "name":                r["name"],
        "code":                r["code"],
        "degreeType":          r.get("degree_type") or "BS",
        "durationYears":       float(r.get("duration_years") or 4),
        "totalSemesters":      r.get("total_semesters") or 8,
        "requiredCreditHours": r.get("required_credit_hours") or 0,
        "status":              r.get("status") or "active",
        "createdAt":           str(r.get("created_at") or ""),
    }


def safe_session(r):
    return {
        "id":           r["id"],
        "name":         r["name"],
        "term":         r.get("term") or "",
        "academicYear": r.get("academic_year") or "",
        "startDate":    str(r["start_date"]) if r.get("start_date") else "",
        "endDate":      str(r["end_date"]) if r.get("end_date") else "",
        "status":       r.get("status") or "planned",
        "createdAt":    str(r.get("created_at") or ""),
    }


def safe_course(r):
    return {
        "id":          r["id"],
        "programId":   r.get("program_id"),
        "programName": r.get("program_name"),
        "programCode": r.get("program_code"),
        "code":        r["code"],
        "name":        r["name"],
        "creditHours": r.get("credit_hours") or 0,
        "courseType":  r.get("course_type") or "theory",
        "description": r.get("description") or "",
        "status":      r.get("status") or "active",
        "createdAt":   str(r.get("created_at") or ""),
    }


def safe_curriculum(r):
    return {
        "id":          r["id"],
        "programId":   r["program_id"],
        "name":        r["name"],
        "versionYear": r.get("version_year"),
        "status":      r.get("status") or "active",
        "isDefault":   bool(r.get("is_default")),
        "programName": r.get("program_name") or "",
        "programCode": r.get("program_code") or "",
        "createdAt":   str(r.get("created_at") or ""),
    }


def safe_curriculum_course(r):
    return {
        "id":                  r["id"],
        "curriculumId":        r["curriculum_id"],
        "courseId":            r["course_id"],
        "recommendedSemester": r["recommended_semester"],
        "classification":      r.get("classification") or "core",
        "isCompulsory":        bool(r.get("is_compulsory")),
        "electiveGroup":       r.get("elective_group") or "",
        # Credit hours may be overridden per curriculum; fall back to the course.
        "creditHours":         r.get("credit_hours") or r.get("course_credit_hours") or 0,
        "courseCode":          r.get("course_code") or "",
        "courseName":          r.get("course_name") or "",
        "courseType":          r.get("course_type") or "theory",
    }


def safe_batch(r):
    return {
        "id":                 r["id"],
        "programId":          r["program_id"],
        "curriculumId":       r["curriculum_id"],
        "admissionSessionId": r.get("admission_session_id"),
        "name":               r["name"],
        "currentSemester":    r.get("current_semester") or 1,
        "status":             r.get("status") or "active",
        "programName":        r.get("program_name") or "",
        "curriculumName":     r.get("curriculum_name") or "",
        "sessionName":        r.get("session_name") or "",
        "studentCount":       r.get("student_count", 0),
        "createdAt":          str(r.get("created_at") or ""),
    }


def safe_offering(r):
    """
    Note both semesters are exposed:
      recommendedSemester — what the curriculum says (may be None)
      actualSemester      — what this session actually offers (authoritative)
    The UI shows a "shifted" badge when they differ (spec §9).
    """
    rec = r.get("recommended_semester")
    return {
        "id":                  r["id"],
        "courseId":            r["course_id"],
        "sessionId":           r["session_id"],
        "programId":           r.get("program_id"),
        "curriculumId":        r.get("curriculum_id"),
        "actualSemester":      r["actual_semester"],
        "recommendedSemester": rec,
        "isShifted":           bool(rec is not None and rec != r["actual_semester"]),
        "status":              r.get("status") or "planned",
        "courseCode":          r.get("course_code") or "",
        "courseName":          r.get("course_name") or "",
        "courseType":          r.get("course_type") or "theory",
        "creditHours":         r.get("credit_hours") or 0,
        "sessionName":         r.get("session_name") or "",
        "programName":         r.get("program_name") or "",
        "sectionCount":        r.get("section_count", 0),
        "enrolledCount":       r.get("enrolled_count", 0),
        "teacherCount":        r.get("teacher_count", 0),
        "createdAt":           str(r.get("created_at") or ""),
    }


def safe_offering_section(r):
    return {
        "id":            r["id"],
        "offeringId":    r["offering_id"],
        "name":          r["name"],
        "capacity":      r.get("capacity") or 0,
        "room":          r.get("room") or "",
        "enrolledCount": r.get("enrolled_count", 0),
        "courseCode":    r.get("course_code") or "",
        "courseName":    r.get("course_name") or "",
        "sessionName":   r.get("session_name") or "",
        "teachers":      r.get("teachers") or [],
        "createdAt":     str(r.get("created_at") or ""),
    }


def safe_teaching_assignment(r):
    return {
        "id":                r["id"],
        "teacherId":         r["teacher_id"],
        "offeringSectionId": r["offering_section_id"],
        "role":              r.get("role") or "lead",
        "teacherName":       r.get("teacher_name") or "",
        "sectionName":       r.get("section_name") or "",
        "courseCode":        r.get("course_code") or "",
        "courseName":        r.get("course_name") or "",
        "sessionName":       r.get("session_name") or "",
        "actualSemester":    r.get("actual_semester"),
        "creditHours":       r.get("credit_hours") or 0,
        "enrolledCount":     r.get("enrolled_count", 0),
    }


def safe_enrollment(r):
    return {
        "id":                r["id"],
        "studentId":         r["student_id"],
        "offeringSectionId": r["offering_section_id"],
        "batchId":           r.get("batch_id"),
        "status":            r.get("status") or "enrolled",
        "studentName":       r.get("student_name") or "",
        "rollNo":            r.get("roll_no") or "",
        "sectionName":       r.get("section_name") or "",
        "courseId":          r.get("course_id"),
        "courseCode":        r.get("course_code") or "",
        "courseName":        r.get("course_name") or "",
        "courseType":        r.get("course_type") or "theory",
        "creditHours":       r.get("credit_hours") or 0,
        "sessionName":       r.get("session_name") or "",
        "actualSemester":    r.get("actual_semester"),
        "teacherNames":      r.get("teacher_names") or "",
        "enrolledAt":        str(r.get("enrolled_at") or ""),
    }


def safe_attempt(r):
    return {
        "id":           r["id"],
        "studentId":    r["student_id"],
        "courseId":     r["course_id"],
        "offeringId":   r.get("offering_id"),
        "attemptNo":    r.get("attempt_no") or 1,
        "sessionLabel": r.get("session_label") or "",
        "status":       r.get("status") or "in_progress",
        "grade":        r.get("grade") or "",
        "gpaPoints":    float(r["gpa_points"]) if r.get("gpa_points") is not None else None,
        "courseCode":   r.get("course_code") or "",
        "courseName":   r.get("course_name") or "",
        "creditHours":  r.get("credit_hours") or 0,
        "createdAt":    str(r.get("created_at") or ""),
    }


def safe_slot(r):
    return {
        "id":                r["id"],
        "offeringSectionId": r["offering_section_id"],
        "day":               r.get("day_of_week") or "",
        "startTime":         str(r.get("start_time") or "")[:5],
        "endTime":           str(r.get("end_time") or "")[:5],
        "room":              r.get("room") or "",
        "courseCode":        r.get("course_code") or "",
        "courseName":        r.get("course_name") or "",
        "sectionName":       r.get("section_name") or "",
        "teacherNames":      r.get("teacher_names") or "",
        "sessionName":       r.get("session_name") or "",
    }


# ================================================================
# LOOKUPS SHARED BY BOTH BLUEPRINTS
# ================================================================
def offering_of_section(section_id):
    """The offering row a section belongs to (with course + session joined)."""
    return query("""
        SELECT o.*, c.code AS course_code, c.name AS course_name,
               c.credit_hours, c.course_type, s.name AS session_name,
               os.name AS section_name, os.capacity
        FROM   bs_offering_sections os
        JOIN   bs_course_offerings  o ON o.id = os.offering_id
        JOIN   bs_courses           c ON c.id = o.course_id
        JOIN   bs_academic_sessions s ON s.id = o.session_id
        WHERE  os.id = %s
    """, (section_id,), one=True)


def section_teacher_ids(section_id):
    """Teacher IDs assigned to one offering section."""
    return [r["teacher_id"] for r in query(
        "SELECT teacher_id FROM bs_teaching_assignments WHERE offering_section_id=%s",
        (section_id,)
    )]


def teacher_teaches_section(teacher_id, section_id):
    """
    True when this teacher holds a teaching assignment for this section.
    The authorization primitive behind every teacher write (spec §16, §39).
    """
    return bool(query(
        "SELECT id FROM bs_teaching_assignments "
        "WHERE teacher_id=%s AND offering_section_id=%s",
        (teacher_id, section_id), one=True
    ))


def teacher_section_ids(teacher_id):
    """Every offering section this teacher is assigned to."""
    return [r["offering_section_id"] for r in query(
        "SELECT offering_section_id FROM bs_teaching_assignments WHERE teacher_id=%s",
        (teacher_id,)
    )]


def student_section_ids(student_id):
    """Every offering section this student is actively enrolled in."""
    return [r["offering_section_id"] for r in query(
        "SELECT offering_section_id FROM bs_enrollments "
        "WHERE student_id=%s AND status IN ('enrolled','completed')",
        (student_id,)
    )]


def bs_student(student_id):
    """A BS-context student row, or None (context-scoped, fail closed)."""
    clause, params = ctx_clause()
    return query(
        f"SELECT * FROM students WHERE id=%s AND {clause}",
        [student_id] + params, one=True
    )


def bs_teacher(teacher_id):
    """A BS-context teacher row, or None (context-scoped, fail closed)."""
    clause, params = ctx_clause()
    return query(
        f"SELECT * FROM teachers WHERE id=%s AND {clause}",
        [teacher_id] + params, one=True
    )


# ================================================================
# BUSINESS RULES
# ================================================================
def enrollment_conflict(student_id, offering_id, exclude_section=None):
    """
    Guard for spec §42.5 / §17: a student may take many *sections* across the
    catalogue, but never two sections of the SAME offering (same course, same
    session).  Returns the conflicting row or None.
    """
    sql = """
        SELECT en.id, os.name AS section_name
        FROM   bs_enrollments en
        JOIN   bs_offering_sections os ON os.id = en.offering_section_id
        WHERE  en.student_id = %s AND os.offering_id = %s
               AND en.status IN ('enrolled','completed')
    """
    args = [student_id, offering_id]
    if exclude_section:
        sql += " AND en.offering_section_id <> %s"
        args.append(exclude_section)
    return query(sql, args, one=True)


def section_seats(section_id):
    """``(capacity, enrolled, has_room)`` for a section."""
    row = query("""
        SELECT os.capacity,
               (SELECT COUNT(*) FROM bs_enrollments en
                 WHERE en.offering_section_id = os.id
                   AND en.status = 'enrolled') AS enrolled
        FROM   bs_offering_sections os WHERE os.id=%s
    """, (section_id,), one=True)
    if not row:
        return 0, 0, False
    cap = int(row["capacity"] or 0)
    used = int(row["enrolled"] or 0)
    # A capacity of 0 is treated as "uncapped" rather than "closed".
    return cap, used, (cap == 0 or used < cap)


def next_attempt_no(student_id, course_id):
    """
    Attempt numbering for a repeat (spec §20).  A failed course is a NEW
    attempt row, never a second permanent course record.
    """
    row = query(
        "SELECT COALESCE(MAX(attempt_no),0) AS n FROM bs_course_attempts "
        "WHERE student_id=%s AND course_id=%s",
        (student_id, course_id), one=True
    )
    return int(row["n"] or 0) + 1


def student_progress(student_id):
    """
    Credit-hour based progress (spec §22) — the promotion rule is credit
    hours earned, NOT "semester number + 1".

    Returns attempted / earned / in-progress credit hours, CGPA computed
    from the LATEST attempt of each course (so a repeat replaces the F),
    and the curriculum's remaining requirement.
    """
    st = query("""
        SELECT s.*, b.name AS batch_name, b.current_semester AS batch_semester,
               p.name AS program_name, p.required_credit_hours,
               p.total_semesters, cu.name AS curriculum_name, cu.id AS curriculum_id
        FROM   students s
        LEFT JOIN bs_batches     b  ON b.id  = s.bs_batch_id
        LEFT JOIN bs_programs    p  ON p.id  = COALESCE(s.bs_program_id, b.program_id)
        LEFT JOIN bs_curriculums cu ON cu.id = COALESCE(s.bs_curriculum_id, b.curriculum_id)
        WHERE  s.id = %s
    """, (student_id,), one=True)
    if not st:
        return None

    attempts = query("""
        SELECT at.*, c.code AS course_code, c.name AS course_name,
               c.credit_hours
        FROM   bs_course_attempts at
        JOIN   bs_courses c ON c.id = at.course_id
        WHERE  at.student_id = %s
        ORDER  BY c.code, at.attempt_no
    """, (student_id,))

    # Latest attempt per course decides the current standing.
    latest = {}
    for a in attempts:
        latest[a["course_id"]] = a

    earned = attempted = in_progress = 0
    points = credits_graded = 0.0
    for a in latest.values():
        ch = int(a.get("credit_hours") or 0)
        if a["status"] in PASSED_STATES:
            earned += ch
            attempted += ch
        elif a["status"] in ("failed", "repeated"):
            attempted += ch
        elif a["status"] == "in_progress":
            in_progress += ch
        gp = a.get("gpa_points")
        if gp is None and a.get("grade"):
            gp = GRADE_POINTS.get(str(a["grade"]).upper())
        if gp is not None and a["status"] in ("passed", "failed"):
            points += float(gp) * ch
            credits_graded += ch

    required = int(st.get("required_credit_hours") or 0)
    cgpa = round(points / credits_graded, 2) if credits_graded else None

    return {
        "studentId":        student_id,
        "studentName":      st.get("name") or "",
        "rollNo":           st.get("roll_no") or "",
        "programName":      st.get("program_name") or "",
        "curriculumId":     st.get("curriculum_id"),
        "curriculumName":   st.get("curriculum_name") or "",
        "batchName":        st.get("batch_name") or "",
        "currentSemester":  st.get("bs_current_semester") or st.get("batch_semester") or 1,
        "totalSemesters":   st.get("total_semesters") or 8,
        "requiredCredits":  required,
        "earnedCredits":    earned,
        "attemptedCredits": attempted,
        "inProgressCredits": in_progress,
        "remainingCredits": max(0, required - earned) if required else None,
        "percentComplete":  round(earned * 100.0 / required, 1) if required else None,
        "cgpa":             cgpa,
        "attempts":         [safe_attempt(a) for a in attempts],
        # A failed course still owed by the student — drives the "repeat" UI.
        "pendingRepeats":   [safe_attempt(a) for a in latest.values()
                             if a["status"] == "failed"],
    }