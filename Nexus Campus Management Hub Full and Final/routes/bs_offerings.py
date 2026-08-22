"""
routes/bs_offerings.py  —  BS Department: the DELIVERY side of the model.

    "Course Offering defines what is actually offered in a particular
     academic session.  Student Enrollment defines what the student actually
     takes.  Teaching Assignment defines which teacher teaches that offering."

Where routes/bs_curriculum.py describes the *plan*, this blueprint runs the
*reality*: which courses a session actually offers, at which ACTUAL semester,
split into which sections, taught by which teacher, taken by which student,
timetabled when, attended, graded, and repeated when failed.

The relationships that make the whole design work, and are enforced here:

  * OFFERING  = course + session + actual_semester.  The actual semester is
    authoritative for that session and may differ from the curriculum's
    recommended semester, with no edit to the curriculum (spec §9, §11).
  * SECTION    belongs to an offering.  Sections A/B/C are the SAME course —
    there is no "OOP-A" course anywhere in the database (spec §13, §42.13).
  * TEACHER    is attached to a SECTION via a teaching assignment, never to a
    bare course (spec §14-§16).
  * STUDENT    enrolls into a SECTION, and never into two sections of the same
    offering (spec §17, §42.5).
  * REPEAT     is a new ATTEMPT row, never a duplicate course (spec §20).
  * PROGRESS   is measured in credit hours, not semester numbers (spec §22).

Endpoints
---------
  GET/POST     /api/bs/offerings                      PUT/DELETE/PATCH /api/bs/offerings/<id>
  GET          /api/bs/offerings/<id>                 full drill-down
  POST         /api/bs/sessions/<id>/generate-offerings   bulk from curriculum
  GET/POST     /api/bs/offerings/<id>/sections
  PUT/DELETE   /api/bs/offering-sections/<id>
  GET/POST     /api/bs/offering-sections/<id>/teachers
  DELETE       /api/bs/teaching-assignments/<id>
  GET          /api/bs/teachers/<id>/workload
  GET/POST     /api/bs/offering-sections/<id>/students     enroll
  PATCH/DELETE /api/bs/enrollments/<id>
  POST         /api/bs/batches/<id>/enroll                 bulk enrollment
  GET/POST     /api/bs/offering-sections/<id>/timetable
  DELETE       /api/bs/timetable-slots/<id>
  GET          /api/bs/timetable
  GET/POST     /api/bs/offering-sections/<id>/attendance
  POST         /api/bs/offering-sections/<id>/results      grade entry
  GET          /api/bs/students/<id>/progress              credit-hour progress
  GET          /api/bs/my/teaching                         teacher portal §31
  GET          /api/bs/my/enrollments                      student portal §32
  GET          /api/bs/my/timetable
"""

from datetime import date as _date

from flask import Blueprint, jsonify, request
from flask_login import current_user

from db import query
from utils.bs_academic import (
    GRADE_POINTS,
    bs_read,
    bs_student,
    bs_teacher,
    bs_write,
    bs_write_context,
    clean,
    enrollment_conflict,
    json_error,
    next_attempt_no,
    offering_of_section,
    parse_int,
    safe_attempt,
    safe_enrollment,
    safe_offering,
    safe_offering_section,
    safe_slot,
    safe_teaching_assignment,
    section_seats,
    student_progress,
    teacher_teaches_section,
)
from utils.context import (
    assert_in_context,
    assert_student_in_context,
    assert_teacher_in_context,
    ctx_clause,
    require_context,
)

bs_offerings_bp = Blueprint("bs_offerings", __name__)

# Admin *or* the teacher who owns the section may mark attendance / enter
# results.  Ownership itself is checked per-request by `_may_teach()`.
bs_mark = require_context(department="BS", role=("admin", "teacher"))

_OFFERING_JOIN = """
        FROM   bs_course_offerings o
        JOIN   bs_courses           c  ON c.id  = o.course_id
        JOIN   bs_academic_sessions s  ON s.id  = o.session_id
        LEFT JOIN bs_programs       p  ON p.id  = o.program_id
        LEFT JOIN bs_curriculum_courses cc
               ON cc.course_id = o.course_id AND cc.curriculum_id = o.curriculum_id
"""

_OFFERING_COLS = """
        SELECT o.*, c.code AS course_code, c.name AS course_name,
               c.course_type, c.credit_hours, s.name AS session_name,
               p.name AS program_name, cc.recommended_semester,
               (SELECT COUNT(*) FROM bs_offering_sections os
                 WHERE os.offering_id = o.id) AS section_count,
               (SELECT COUNT(*) FROM bs_enrollments en
                  JOIN bs_offering_sections os2 ON os2.id = en.offering_section_id
                 WHERE os2.offering_id = o.id AND en.status='enrolled') AS enrolled_count,
               (SELECT COUNT(*) FROM bs_teaching_assignments ta
                  JOIN bs_offering_sections os3 ON os3.id = ta.offering_section_id
                 WHERE os3.offering_id = o.id) AS teacher_count
"""


def _may_teach(section_id):
    """
    Authorization for a per-section action (attendance, results).

    Admins pass.  A teacher passes only for sections they actually hold a
    teaching assignment for — the backend check the frontend's hiding is
    never allowed to stand in for (spec §16, §39).
    """
    if current_user.role == "admin":
        return None
    if current_user.role == "teacher" and teacher_teaches_section(current_user.id, section_id):
        return None
    return json_error("You are not assigned to teach this section", 403)


# ================================================================
# COURSE OFFERINGS  (spec §11, §12, §19)
# ================================================================

@bs_offerings_bp.route("/api/bs/offerings", methods=["GET"])
@bs_read
def api_bs_offerings():
    clause, params = ctx_clause("o")
    sql  = _OFFERING_COLS + _OFFERING_JOIN + f" WHERE {clause}"
    args = list(params)

    for arg, col in [("session_id", "o.session_id"), ("program_id", "o.program_id"),
                     ("curriculum_id", "o.curriculum_id")]:
        val = parse_int(request.args.get(arg))
        if val:
            sql += f" AND {col}=%s"
            args.append(val)

    sem = parse_int(request.args.get("semester"))
    if sem:
        sql += " AND o.actual_semester=%s"
        args.append(sem)
    status = clean(request.args.get("status"))
    if status:
        sql += " AND o.status=%s"
        args.append(status)
    search = clean(request.args.get("search"))
    if search:
        sql += " AND (LOWER(c.code) LIKE %s OR LOWER(c.name) LIKE %s)"
        args += [f"%{search.lower()}%", f"%{search.lower()}%"]

    sql += " ORDER BY s.start_date DESC, o.actual_semester, c.code"
    return jsonify([safe_offering(r) for r in query(sql, args)])


@bs_offerings_bp.route("/api/bs/offerings/<int:oid>", methods=["GET"])
@bs_read
def api_bs_offering_detail(oid):
    """Full drill-down: the offering, its sections, their teachers and rosters."""
    guard = assert_in_context("bs_course_offerings", oid, "Course offering")
    if guard:
        return guard

    off = query(_OFFERING_COLS + _OFFERING_JOIN + " WHERE o.id=%s", (oid,), one=True)

    sections = query("""
        SELECT os.*,
               (SELECT COUNT(*) FROM bs_enrollments en
                 WHERE en.offering_section_id = os.id AND en.status='enrolled') AS enrolled_count
        FROM   bs_offering_sections os
        WHERE  os.offering_id=%s
        ORDER  BY os.name
    """, (oid,))

    out = []
    for sec in sections:
        d = safe_offering_section(sec)
        d["teachers"] = [safe_teaching_assignment(t) for t in query("""
            SELECT ta.*, t.name AS teacher_name
            FROM   bs_teaching_assignments ta
            JOIN   teachers t ON t.id = ta.teacher_id
            WHERE  ta.offering_section_id=%s
            ORDER  BY ta.role, t.name
        """, (sec["id"],))]
        d["timetable"] = [safe_slot(s) for s in query("""
            SELECT * FROM bs_timetable_slots WHERE offering_section_id=%s
            ORDER BY FIELD(day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), start_time
        """, (sec["id"],))]
        out.append(d)

    return jsonify({"offering": safe_offering(off), "sections": out})


@bs_offerings_bp.route("/api/bs/offerings", methods=["POST"])
@bs_write()
def api_bs_add_offering():
    """
    Offer a course in a session at an ACTUAL semester.

    The actual semester is deliberately free of the curriculum's recommended
    semester: offering CS-101 at semester 2 when the curriculum recommends 1
    is a normal, first-class operation and leaves the curriculum untouched
    (spec §9, §42.3).
    """
    data       = request.get_json(force=True, silent=True) or {}
    course_id  = parse_int(data.get("courseId"))
    session_id = parse_int(data.get("sessionId"))
    sem        = parse_int(data.get("actualSemester"))

    if not course_id:
        return json_error("Course is required")
    if not session_id:
        return json_error("Academic session is required")
    if not sem or sem < 1 or sem > 12:
        return json_error("Actual semester must be between 1 and 12")

    for table, pk, label in [("bs_courses", course_id, "Course"),
                             ("bs_academic_sessions", session_id, "Session")]:
        guard = assert_in_context(table, pk, label)
        if guard:
            return guard

    program_id    = parse_int(data.get("programId"))
    curriculum_id = parse_int(data.get("curriculumId"))
    if program_id:
        guard = assert_in_context("bs_programs", program_id, "Program")
        if guard:
            return guard
    if curriculum_id:
        guard = assert_in_context("bs_curriculums", curriculum_id, "Curriculum")
        if guard:
            return guard
        cur = query("SELECT program_id FROM bs_curriculums WHERE id=%s",
                    (curriculum_id,), one=True)
        if program_id and cur["program_id"] != program_id:
            return json_error("That curriculum belongs to a different program", 400)
        program_id = program_id or cur["program_id"]

    status = clean(data.get("status")) or "planned"
    if status not in ("planned", "open", "ongoing", "completed", "cancelled"):
        return json_error("Invalid offering status")

    # Same course + same session + same semester + same program = the same
    # offering.  Add a SECTION to it instead of a second offering (spec §19).
    dup = query("""
        SELECT id FROM bs_course_offerings
        WHERE course_id=%s AND session_id=%s AND actual_semester=%s
              AND ((program_id IS NULL AND %s IS NULL) OR program_id=%s)
    """, (course_id, session_id, sem, program_id, program_id), one=True)
    if dup:
        return json_error(
            "This course is already offered in that session at that semester. "
            "Add another section to the existing offering instead.", 409)

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    try:
        new_id = query("""
            INSERT INTO bs_course_offerings
                (course_id, session_id, program_id, curriculum_id, actual_semester,
                 status, department_id, campus_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (course_id, session_id, program_id, curriculum_id, sem, status,
              dept_id, campus_id), commit=True)

        # Convenience: create the first section(s) with the offering, since an
        # offering with no section can hold neither a teacher nor a student.
        count = parse_int(data.get("sections"), 1) or 1
        capacity = parse_int(data.get("capacity"), 50)
        for i in range(max(1, min(count, 12))):
            query("""INSERT INTO bs_offering_sections (offering_id, name, capacity, room)
                     VALUES (%s,%s,%s,%s)""",
                  (new_id, chr(ord("A") + i), capacity, clean(data.get("room")) or None),
                  commit=True)

        row = query(_OFFERING_COLS + _OFFERING_JOIN + " WHERE o.id=%s", (new_id,), one=True)
        return jsonify({"success": True, "offering": safe_offering(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create offering: {e}", 500)


@bs_offerings_bp.route("/api/bs/offerings/<int:oid>", methods=["PUT"])
@bs_write()
def api_bs_update_offering(oid):
    guard = assert_in_context("bs_course_offerings", oid, "Course offering")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []

    if "actualSemester" in data:
        sem = parse_int(data.get("actualSemester"))
        if not sem or sem < 1 or sem > 12:
            return json_error("Actual semester must be between 1 and 12")
        sets.append("actual_semester=%s")
        args.append(sem)
    if "status" in data:
        status = clean(data.get("status"))
        if status not in ("planned", "open", "ongoing", "completed", "cancelled"):
            return json_error("Invalid offering status")
        sets.append("status=%s")
        args.append(status)
    if "curriculumId" in data:
        cuid = parse_int(data.get("curriculumId"))
        if cuid:
            guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
            if guard:
                return guard
        sets.append("curriculum_id=%s")
        args.append(cuid)

    if sets:
        args.append(oid)
        try:
            query(f"UPDATE bs_course_offerings SET {','.join(sets)} WHERE id=%s",
                  args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update offering: {e}", 500)

    row = query(_OFFERING_COLS + _OFFERING_JOIN + " WHERE o.id=%s", (oid,), one=True)
    return jsonify({"success": True, "offering": safe_offering(row)})


@bs_offerings_bp.route("/api/bs/offerings/<int:oid>/status", methods=["PATCH"])
@bs_write()
def api_bs_offering_status(oid):
    guard = assert_in_context("bs_course_offerings", oid, "Course offering")
    if guard:
        return guard
    status = clean((request.get_json(force=True, silent=True) or {}).get("status"))
    if status not in ("planned", "open", "ongoing", "completed", "cancelled"):
        return json_error("Invalid offering status")
    query("UPDATE bs_course_offerings SET status=%s WHERE id=%s", (status, oid), commit=True)
    return jsonify({"success": True, "status": status})


@bs_offerings_bp.route("/api/bs/offerings/<int:oid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_offering(oid):
    guard = assert_in_context("bs_course_offerings", oid, "Course offering")
    if guard:
        return guard

    # Enrollment history is never destroyed silently — cancel instead.
    enrolled = query("""
        SELECT COUNT(*) AS n FROM bs_enrollments en
        JOIN bs_offering_sections os ON os.id = en.offering_section_id
        WHERE os.offering_id=%s
    """, (oid,), one=True)["n"]
    if enrolled:
        return json_error(
            f"{enrolled} student enrollment(s) exist for this offering. "
            "Set its status to 'cancelled' instead of deleting it.", 409)

    query("DELETE FROM bs_course_offerings WHERE id=%s", (oid,), commit=True)
    return jsonify({"success": True})


@bs_offerings_bp.route("/api/bs/sessions/<int:sid>/generate-offerings", methods=["POST"])
@bs_write()
def api_bs_generate_offerings(sid):
    """
    Bulk-open a whole curriculum semester in one session (spec §12).

    Reads the curriculum's RECOMMENDED semester to decide *which* courses to
    open, then writes them as offerings with an ACTUAL semester — so the
    normal case needs no manual work, and the exceptional case (a shifted
    course) is still a single edit on one offering afterwards.
    """
    guard = assert_in_context("bs_academic_sessions", sid, "Session")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    cuid = parse_int(data.get("curriculumId"))
    sem  = parse_int(data.get("semester"))
    if not cuid:
        return json_error("Curriculum version is required")
    if not sem or sem < 1 or sem > 12:
        return json_error("Semester must be between 1 and 12")

    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard

    cur = query("SELECT * FROM bs_curriculums WHERE id=%s", (cuid,), one=True)
    plan = query("""
        SELECT cc.*, c.code AS course_code, c.name AS course_name
        FROM   bs_curriculum_courses cc
        JOIN   bs_courses c ON c.id = cc.course_id
        WHERE  cc.curriculum_id=%s AND cc.recommended_semester=%s
        ORDER  BY c.code
    """, (cuid, sem))
    if not plan:
        return json_error(f"This curriculum has no courses in semester {sem}", 400)

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    sections_per = max(1, min(parse_int(data.get("sections"), 1) or 1, 12))
    capacity     = parse_int(data.get("capacity"), 50)
    status       = clean(data.get("status")) or "planned"
    actual       = parse_int(data.get("actualSemester")) or sem

    created, skipped = [], []
    try:
        for pc in plan:
            exists = query("""
                SELECT id FROM bs_course_offerings
                WHERE course_id=%s AND session_id=%s AND actual_semester=%s
                      AND ((program_id IS NULL AND %s IS NULL) OR program_id=%s)
            """, (pc["course_id"], sid, actual, cur["program_id"], cur["program_id"]),
                one=True)
            if exists:
                skipped.append(pc["course_code"])
                continue

            oid = query("""
                INSERT INTO bs_course_offerings
                    (course_id, session_id, program_id, curriculum_id, actual_semester,
                     status, department_id, campus_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (pc["course_id"], sid, cur["program_id"], cuid, actual, status,
                  dept_id, campus_id), commit=True)
            for i in range(sections_per):
                query("""INSERT INTO bs_offering_sections (offering_id, name, capacity)
                         VALUES (%s,%s,%s)""",
                      (oid, chr(ord("A") + i), capacity), commit=True)
            created.append(pc["course_code"])
    except Exception as e:
        return json_error(f"Failed to generate offerings: {e}", 500)

    return jsonify({
        "success": True,
        "created": created,
        "skipped": skipped,
        "message": f"{len(created)} offering(s) created"
                   + (f", {len(skipped)} already existed" if skipped else ""),
    }), 201


# ================================================================
# OFFERING SECTIONS  (spec §13)
# ================================================================

@bs_offerings_bp.route("/api/bs/offerings/<int:oid>/sections", methods=["GET"])
@bs_read
def api_bs_offering_sections(oid):
    guard = assert_in_context("bs_course_offerings", oid, "Course offering")
    if guard:
        return guard
    rows = query("""
        SELECT os.*, c.code AS course_code, c.name AS course_name, s.name AS session_name,
               (SELECT COUNT(*) FROM bs_enrollments en
                 WHERE en.offering_section_id=os.id AND en.status='enrolled') AS enrolled_count
        FROM   bs_offering_sections os
        JOIN   bs_course_offerings  o ON o.id = os.offering_id
        JOIN   bs_courses           c ON c.id = o.course_id
        JOIN   bs_academic_sessions s ON s.id = o.session_id
        WHERE  os.offering_id=%s ORDER BY os.name
    """, (oid,))
    out = []
    for r in rows:
        d = safe_offering_section(r)
        d["teachers"] = [safe_teaching_assignment(t) for t in query("""
            SELECT ta.*, t.name AS teacher_name FROM bs_teaching_assignments ta
            JOIN teachers t ON t.id=ta.teacher_id WHERE ta.offering_section_id=%s
        """, (r["id"],))]
        out.append(d)
    return jsonify(out)


@bs_offerings_bp.route("/api/bs/offerings/<int:oid>/sections", methods=["POST"])
@bs_write()
def api_bs_add_offering_section(oid):
    """
    Add a section to an existing offering.

    This is how a course with 150 students is split — ONE course, three
    sections.  No second course record is ever created (spec §13, §42.13).
    """
    guard = assert_in_context("bs_course_offerings", oid, "Course offering")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    name = clean(data.get("name"), upper=True)
    if not name:
        # Auto-name the next free letter, which is what the UI usually wants.
        used = {r["name"] for r in query(
            "SELECT name FROM bs_offering_sections WHERE offering_id=%s", (oid,))}
        for i in range(26):
            cand = chr(ord("A") + i)
            if cand not in used:
                name = cand
                break
        if not name:
            return json_error("Section name is required")

    if query("SELECT id FROM bs_offering_sections WHERE offering_id=%s AND name=%s",
             (oid, name), one=True):
        return json_error(f"Section {name} already exists for this offering", 409)

    try:
        new_id = query("""
            INSERT INTO bs_offering_sections (offering_id, name, capacity, room)
            VALUES (%s,%s,%s,%s)
        """, (oid, name, parse_int(data.get("capacity"), 50),
              clean(data.get("room")) or None), commit=True)
        row = query("SELECT * FROM bs_offering_sections WHERE id=%s", (new_id,), one=True)
        return jsonify({"success": True, "section": safe_offering_section(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create section: {e}", 500)


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>", methods=["PUT"])
@bs_write()
def api_bs_update_offering_section(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []
    for key, col in [("name", "name"), ("capacity", "capacity"), ("room", "room")]:
        if key in data:
            val = data[key]
            if key == "name":
                val = clean(val, upper=True)
            elif isinstance(val, str):
                val = val.strip() or None
            sets.append(f"{col}=%s")
            args.append(val)

    # Capacity may not be cut below the students already enrolled.
    if "capacity" in data:
        cap = parse_int(data.get("capacity"), 0) or 0
        _, used, _ = section_seats(sid)
        if cap and cap < used:
            return json_error(
                f"{used} student(s) are already enrolled - capacity cannot be below that", 400)

    if sets:
        args.append(sid)
        try:
            query(f"UPDATE bs_offering_sections SET {','.join(sets)} WHERE id=%s",
                  args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update section: {e}", 500)

    row = query("SELECT * FROM bs_offering_sections WHERE id=%s", (sid,), one=True)
    return jsonify({"success": True, "section": safe_offering_section(row)})


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_offering_section(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    enrolled = query("SELECT COUNT(*) AS n FROM bs_enrollments WHERE offering_section_id=%s",
                     (sid,), one=True)["n"]
    if enrolled:
        return json_error(
            f"{enrolled} student(s) are enrolled in this section. Move or remove them first.", 409)
    query("DELETE FROM bs_offering_sections WHERE id=%s", (sid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# TEACHING ASSIGNMENTS  (spec §14, §15, §16)
# ================================================================

@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/teachers", methods=["GET"])
@bs_read
def api_bs_section_teachers(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    rows = query("""
        SELECT ta.*, t.name AS teacher_name, os.name AS section_name,
               c.code AS course_code, c.name AS course_name, s.name AS session_name
        FROM   bs_teaching_assignments ta
        JOIN   teachers t ON t.id = ta.teacher_id
        JOIN   bs_offering_sections os ON os.id = ta.offering_section_id
        JOIN   bs_course_offerings  o  ON o.id  = os.offering_id
        JOIN   bs_courses           c  ON c.id  = o.course_id
        JOIN   bs_academic_sessions s  ON s.id  = o.session_id
        WHERE  ta.offering_section_id=%s ORDER BY ta.role, t.name
    """, (sid,))
    return jsonify([safe_teaching_assignment(r) for r in rows])


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/teachers", methods=["POST"])
@bs_write()
def api_bs_assign_teacher(sid):
    """
    Teacher -> Teaching Assignment -> Offering Section (spec §14).

    A teacher is never bound to a course in the abstract: the assignment is
    to one section of one offering in one session, which is exactly what
    makes "two teachers, same course, different sections" natural (§15).
    """
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    tid  = clean(data.get("teacherId"))
    if not tid:
        return json_error("Teacher is required")

    guard = assert_teacher_in_context(tid)
    if guard:
        return guard

    role = clean(data.get("role")) or "lead"
    if role not in ("lead", "co"):
        return json_error("Role must be 'lead' or 'co'")

    if query("""SELECT id FROM bs_teaching_assignments
                WHERE teacher_id=%s AND offering_section_id=%s""",
             (tid, sid), one=True):
        return json_error("This teacher is already assigned to this section", 409)

    off = offering_of_section(sid)
    if off and off["status"] == "cancelled":
        return json_error("This offering is cancelled - assign a teacher to an active one", 400)

    # Timetable sanity: warn when this teacher already teaches elsewhere at
    # the same time.  Reported, not blocked — the admin may be fixing a clash.
    clashes = query("""
        SELECT ts.day_of_week, ts.start_time, ts.end_time,
               c.code AS course_code, os.name AS section_name
        FROM   bs_timetable_slots ts
        JOIN   bs_offering_sections os ON os.id = ts.offering_section_id
        JOIN   bs_course_offerings  o  ON o.id  = os.offering_id
        JOIN   bs_courses           c  ON c.id  = o.course_id
        WHERE  ts.offering_section_id IN (
                   SELECT offering_section_id FROM bs_teaching_assignments WHERE teacher_id=%s)
           AND (ts.day_of_week, ts.start_time) IN (
                   SELECT day_of_week, start_time FROM bs_timetable_slots
                    WHERE offering_section_id=%s)
    """, (tid, sid))

    try:
        new_id = query("""
            INSERT INTO bs_teaching_assignments (teacher_id, offering_section_id, role)
            VALUES (%s,%s,%s)
        """, (tid, sid, role), commit=True)
        row = query("""
            SELECT ta.*, t.name AS teacher_name, os.name AS section_name,
                   c.code AS course_code, c.name AS course_name, s.name AS session_name
            FROM bs_teaching_assignments ta
            JOIN teachers t ON t.id=ta.teacher_id
            JOIN bs_offering_sections os ON os.id=ta.offering_section_id
            JOIN bs_course_offerings o ON o.id=os.offering_id
            JOIN bs_courses c ON c.id=o.course_id
            JOIN bs_academic_sessions s ON s.id=o.session_id
            WHERE ta.id=%s
        """, (new_id,), one=True)
        return jsonify({
            "success": True,
            "assignment": safe_teaching_assignment(row),
            "warnings": [f"{c['course_code']} {c['section_name']} on {c['day_of_week']} "
                         f"at {str(c['start_time'])[:5]}" for c in clashes],
        }), 201
    except Exception as e:
        return json_error(f"Failed to assign teacher: {e}", 500)


@bs_offerings_bp.route("/api/bs/teaching-assignments/<int:taid>", methods=["DELETE"])
@bs_write()
def api_bs_unassign_teacher(taid):
    guard = assert_in_context("bs_teaching_assignments", taid, "Teaching assignment")
    if guard:
        return guard
    query("DELETE FROM bs_teaching_assignments WHERE id=%s", (taid,), commit=True)
    return jsonify({"success": True})


@bs_offerings_bp.route("/api/bs/teachers/<tid>/workload", methods=["GET"])
@bs_read
def api_bs_teacher_workload(tid):
    """
    Everything one teacher teaches (spec §16, §29).  A teacher may hold many
    assignments across sessions; credit hours are summed for the workload view.
    """
    guard = assert_teacher_in_context(tid)
    if guard:
        return guard

    session_id = parse_int(request.args.get("session_id"))
    sql = """
        SELECT ta.*, t.name AS teacher_name, os.name AS section_name,
               c.code AS course_code, c.name AS course_name, c.credit_hours,
               s.name AS session_name, o.actual_semester,
               (SELECT COUNT(*) FROM bs_enrollments en
                 WHERE en.offering_section_id=os.id AND en.status='enrolled') AS enrolled_count
        FROM   bs_teaching_assignments ta
        JOIN   teachers t ON t.id = ta.teacher_id
        JOIN   bs_offering_sections os ON os.id = ta.offering_section_id
        JOIN   bs_course_offerings  o  ON o.id  = os.offering_id
        JOIN   bs_courses           c  ON c.id  = o.course_id
        JOIN   bs_academic_sessions s  ON s.id  = o.session_id
        WHERE  ta.teacher_id=%s
    """
    args = [tid]
    if session_id:
        sql += " AND o.session_id=%s"
        args.append(session_id)
    sql += " ORDER BY s.start_date DESC, c.code, os.name"

    rows = query(sql, args)
    return jsonify({
        "teacherId":        tid,
        "assignments":      [safe_teaching_assignment(r) for r in rows],
        "totalSections":    len(rows),
        "totalCreditHours": sum(int(r["credit_hours"] or 0) for r in rows),
        "totalStudents":    sum(int(r["enrolled_count"] or 0) for r in rows),
    })


# ================================================================
# STUDENT ENROLLMENT  (spec §17, §18)
# ================================================================

_ENROLL_COLS = """
        SELECT en.*, st.name AS student_name, st.roll_no,
               os.name AS section_name, o.course_id, o.actual_semester,
               c.code AS course_code, c.name AS course_name, c.course_type,
               c.credit_hours, s.name AS session_name,
               (SELECT GROUP_CONCAT(t.name SEPARATOR ', ')
                  FROM bs_teaching_assignments ta JOIN teachers t ON t.id=ta.teacher_id
                 WHERE ta.offering_section_id = os.id) AS teacher_names
        FROM   bs_enrollments en
        JOIN   students st ON st.id = en.student_id
        JOIN   bs_offering_sections os ON os.id = en.offering_section_id
        JOIN   bs_course_offerings  o  ON o.id  = os.offering_id
        JOIN   bs_courses           c  ON c.id  = o.course_id
        JOIN   bs_academic_sessions s  ON s.id  = o.session_id
"""


def _ensure_attempt(student_id, course_id, offering_id, session_label):
    """
    Every enrollment has a matching attempt row, so progress and repeat
    history are always derivable (spec §20).  An open attempt is reused; a
    finished one starts the next attempt number.
    """
    open_attempt = query("""
        SELECT * FROM bs_course_attempts
        WHERE student_id=%s AND course_id=%s AND status='in_progress'
        ORDER BY attempt_no DESC LIMIT 1
    """, (student_id, course_id), one=True)
    if open_attempt:
        query("UPDATE bs_course_attempts SET offering_id=%s, session_label=%s WHERE id=%s",
              (offering_id, session_label, open_attempt["id"]), commit=True)
        return open_attempt["id"]
    return query("""
        INSERT INTO bs_course_attempts
            (student_id, course_id, offering_id, attempt_no, session_label, status)
        VALUES (%s,%s,%s,%s,%s,'in_progress')
    """, (student_id, course_id, offering_id,
          next_attempt_no(student_id, course_id), session_label), commit=True)


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/students", methods=["GET"])
@bs_read
def api_bs_section_roster(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    # A teacher may only read the roster of a section they teach.
    if current_user.role == "teacher" and not teacher_teaches_section(current_user.id, sid):
        return json_error("You are not assigned to teach this section", 403)

    rows = query(_ENROLL_COLS + " WHERE en.offering_section_id=%s ORDER BY st.roll_no, st.name",
                 (sid,))
    cap, used, _ = section_seats(sid)
    return jsonify({
        "sectionId": sid, "capacity": cap, "enrolled": used,
        "students": [safe_enrollment(r) for r in rows],
    })


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/students", methods=["POST"])
@bs_write()
def api_bs_enroll_students(sid):
    """
    Enroll one or many students into a section (spec §17).

    Accepts ``studentId`` or ``studentIds[]``.  Each candidate is checked for
    context, capacity and the same-offering conflict, and every accepted
    enrollment opens (or reuses) a course attempt.
    """
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard

    off = offering_of_section(sid)
    if not off:
        return json_error("Section not found", 404)
    if off["status"] == "cancelled":
        return json_error("This offering is cancelled - enrollment is not possible", 400)

    data = request.get_json(force=True, silent=True) or {}
    ids  = data.get("studentIds")
    if not ids:
        one = clean(data.get("studentId"))
        ids = [one] if one else []
    ids = [clean(i) for i in ids if clean(i)]
    if not ids:
        return json_error("At least one student is required")

    batch_id = parse_int(data.get("batchId"))
    enrolled, skipped = [], []

    for student_id in ids:
        st = bs_student(student_id)
        if not st:
            skipped.append({"studentId": student_id, "reason": "Not a student in this department"})
            continue
        if query("""SELECT id FROM bs_enrollments
                    WHERE student_id=%s AND offering_section_id=%s""",
                 (student_id, sid), one=True):
            skipped.append({"studentId": student_id, "reason": "Already enrolled in this section"})
            continue

        conflict = enrollment_conflict(student_id, off["id"], exclude_section=sid)
        if conflict:
            skipped.append({
                "studentId": student_id,
                "reason": f"Already enrolled in section {conflict['section_name']} of this course",
            })
            continue

        _, _, has_room = section_seats(sid)
        if not has_room:
            skipped.append({"studentId": student_id, "reason": "Section is full"})
            continue

        try:
            query("""INSERT INTO bs_enrollments
                        (student_id, offering_section_id, batch_id, status)
                     VALUES (%s,%s,%s,'enrolled')""",
                  (student_id, sid, batch_id or st.get("bs_batch_id")), commit=True)
            _ensure_attempt(student_id, off["course_id"], off["id"], off["session_name"])
            enrolled.append(student_id)
        except Exception as e:
            skipped.append({"studentId": student_id, "reason": str(e)})

    return jsonify({
        "success": True, "enrolled": enrolled, "skipped": skipped,
        "message": f"{len(enrolled)} student(s) enrolled"
                   + (f", {len(skipped)} skipped" if skipped else ""),
    }), 201


@bs_offerings_bp.route("/api/bs/enrollments/<int:eid>", methods=["PATCH"])
@bs_write()
def api_bs_update_enrollment(eid):
    guard = assert_in_context("bs_enrollments", eid, "Enrollment")
    if guard:
        return guard
    status = clean((request.get_json(force=True, silent=True) or {}).get("status"))
    if status not in ("enrolled", "completed", "dropped", "withdrawn"):
        return json_error("Invalid enrollment status")
    query("UPDATE bs_enrollments SET status=%s WHERE id=%s", (status, eid), commit=True)
    return jsonify({"success": True, "status": status})


@bs_offerings_bp.route("/api/bs/enrollments/<int:eid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_enrollment(eid):
    guard = assert_in_context("bs_enrollments", eid, "Enrollment")
    if guard:
        return guard

    en = query("""
        SELECT en.*, o.course_id FROM bs_enrollments en
        JOIN bs_offering_sections os ON os.id=en.offering_section_id
        JOIN bs_course_offerings  o  ON o.id=os.offering_id
        WHERE en.id=%s
    """, (eid,), one=True)

    query("DELETE FROM bs_enrollments WHERE id=%s", (eid,), commit=True)

    # Tidy up the attempt this enrollment opened, but only while it is still
    # ungraded — a graded attempt is history and must survive (spec §20, §36).
    if en:
        query("""DELETE FROM bs_course_attempts
                 WHERE student_id=%s AND course_id=%s AND status='in_progress'
                       AND grade IS NULL""",
              (en["student_id"], en["course_id"]), commit=True)
    return jsonify({"success": True})


@bs_offerings_bp.route("/api/bs/batches/<int:bid>/enroll", methods=["POST"])
@bs_write()
def api_bs_bulk_enroll_batch(bid):
    """
    Bulk-enroll a whole batch into a session's semester (spec §18).

    Walks every offering for that semester and drops each student into the
    first section with room, honouring the same conflict and capacity rules
    as a single enrollment.  Students who already have a place are left alone,
    so re-running this is safe.
    """
    guard = assert_in_context("bs_batches", bid, "Batch")
    if guard:
        return guard

    data       = request.get_json(force=True, silent=True) or {}
    session_id = parse_int(data.get("sessionId"))
    if not session_id:
        return json_error("Academic session is required")
    guard = assert_in_context("bs_academic_sessions", session_id, "Session")
    if guard:
        return guard

    batch = query("SELECT * FROM bs_batches WHERE id=%s", (bid,), one=True)
    sem   = parse_int(data.get("semester")) or batch["current_semester"]

    clause, params = ctx_clause("st")
    students = query(
        f"SELECT st.* FROM students st WHERE st.bs_batch_id=%s AND {clause} ORDER BY st.roll_no",
        [bid] + params)
    if not students:
        return json_error("This batch has no students yet", 400)

    o_clause, o_params = ctx_clause("o")
    offerings = query(f"""
        SELECT o.*, c.code AS course_code, s.name AS session_name
        FROM   bs_course_offerings o
        JOIN   bs_courses c ON c.id = o.course_id
        JOIN   bs_academic_sessions s ON s.id = o.session_id
        WHERE  o.session_id=%s AND o.actual_semester=%s AND {o_clause}
               AND o.status <> 'cancelled'
               AND (o.curriculum_id IS NULL OR o.curriculum_id=%s)
        ORDER  BY c.code
    """, [session_id, sem] + o_params + [batch["curriculum_id"]])
    if not offerings:
        return json_error(
            f"No course offerings found for semester {sem} in that session. "
            "Generate the offerings first.", 400)

    enrolled = 0
    skipped  = []
    for off in offerings:
        sections = query("""
            SELECT * FROM bs_offering_sections WHERE offering_id=%s ORDER BY name
        """, (off["id"],))
        if not sections:
            skipped.append(f"{off['course_code']}: no sections")
            continue

        for st in students:
            if enrollment_conflict(st["id"], off["id"]):
                continue
            placed = False
            for sec in sections:
                _, _, has_room = section_seats(sec["id"])
                if not has_room:
                    continue
                try:
                    query("""INSERT INTO bs_enrollments
                                (student_id, offering_section_id, batch_id, status)
                             VALUES (%s,%s,%s,'enrolled')""",
                          (st["id"], sec["id"], bid), commit=True)
                    _ensure_attempt(st["id"], off["course_id"], off["id"], off["session_name"])
                    enrolled += 1
                    placed = True
                    break
                except Exception:
                    continue
            if not placed:
                skipped.append(f"{off['course_code']}: no seat for {st['id']}")

    return jsonify({
        "success": True, "enrolled": enrolled, "skipped": skipped,
        "students": len(students), "offerings": len(offerings),
        "message": f"{enrolled} enrollment(s) created for {len(students)} student(s) "
                   f"across {len(offerings)} course(s)",
    }), 201


@bs_offerings_bp.route("/api/bs/students/<sid>/enrollments", methods=["GET"])
@bs_read
def api_bs_student_enrollments(sid):
    guard = assert_student_in_context(sid)
    if guard:
        return guard
    # Students may only read their own record.
    if current_user.role == "student" and str(current_user.id) != str(sid):
        return json_error("You can only view your own enrollments", 403)

    session_id = parse_int(request.args.get("session_id"))
    sql, args = _ENROLL_COLS + " WHERE en.student_id=%s", [sid]
    if session_id:
        sql += " AND o.session_id=%s"
        args.append(session_id)
    sql += " ORDER BY s.start_date DESC, c.code"
    return jsonify([safe_enrollment(r) for r in query(sql, args)])


# ================================================================
# TIMETABLE  (spec §23)  —  separate from teaching assignment
# ================================================================

_SLOT_COLS = """
        SELECT ts.*, c.code AS course_code, c.name AS course_name,
               os.name AS section_name, s.name AS session_name,
               (SELECT GROUP_CONCAT(t.name SEPARATOR ', ')
                  FROM bs_teaching_assignments ta JOIN teachers t ON t.id=ta.teacher_id
                 WHERE ta.offering_section_id = os.id) AS teacher_names
        FROM   bs_timetable_slots ts
        JOIN   bs_offering_sections os ON os.id = ts.offering_section_id
        JOIN   bs_course_offerings  o  ON o.id  = os.offering_id
        JOIN   bs_courses           c  ON c.id  = o.course_id
        JOIN   bs_academic_sessions s  ON s.id  = o.session_id
"""

_DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/timetable", methods=["GET"])
@bs_read
def api_bs_section_timetable(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    rows = query(_SLOT_COLS + """
        WHERE ts.offering_section_id=%s
        ORDER BY FIELD(ts.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), ts.start_time
    """, (sid,))
    return jsonify([safe_slot(r) for r in rows])


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/timetable", methods=["POST"])
@bs_write("timetable")
def api_bs_add_slot(sid):
    """
    Add a weekly lecture slot.  A section can have several (Mon/Wed/Fri) —
    the timetable is its own concept, not a property of the teaching
    assignment (spec §23).
    """
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard

    data  = request.get_json(force=True, silent=True) or {}
    day   = clean(data.get("day"))[:3].title()
    start = clean(data.get("startTime"))
    end   = clean(data.get("endTime"))
    if day not in _DAYS:
        return json_error("Day must be one of Mon, Tue, Wed, Thu, Fri, Sat, Sun")
    if not start or not end:
        return json_error("Start and end time are required")
    if end <= start:
        return json_error("End time must be after start time")

    # Room double-booking is a hard error; a teacher clash is a warning.
    room = clean(data.get("room")) or None
    if room:
        clash = query("""
            SELECT c.code AS course_code, os.name AS section_name
            FROM   bs_timetable_slots ts
            JOIN   bs_offering_sections os ON os.id=ts.offering_section_id
            JOIN   bs_course_offerings  o  ON o.id=os.offering_id
            JOIN   bs_courses           c  ON c.id=o.course_id
            WHERE  ts.room=%s AND ts.day_of_week=%s
                   AND ts.start_time < %s AND ts.end_time > %s
                   AND ts.offering_section_id <> %s
        """, (room, day, end, start, sid), one=True)
        if clash:
            return json_error(
                f"Room {room} is already used by {clash['course_code']} "
                f"({clash['section_name']}) at that time", 409)

    try:
        new_id = query("""
            INSERT INTO bs_timetable_slots
                (offering_section_id, day_of_week, start_time, end_time, room)
            VALUES (%s,%s,%s,%s,%s)
        """, (sid, day, start, end, room), commit=True)
        row = query(_SLOT_COLS + " WHERE ts.id=%s", (new_id,), one=True)
        return jsonify({"success": True, "slot": safe_slot(row)}), 201
    except Exception as e:
        return json_error(f"Failed to add timetable slot: {e}", 500)


@bs_offerings_bp.route("/api/bs/timetable-slots/<int:tsid>", methods=["DELETE"])
@bs_write("timetable")
def api_bs_delete_slot(tsid):
    guard = assert_in_context("bs_timetable_slots", tsid, "Timetable slot")
    if guard:
        return guard
    query("DELETE FROM bs_timetable_slots WHERE id=%s", (tsid,), commit=True)
    return jsonify({"success": True})


@bs_offerings_bp.route("/api/bs/timetable", methods=["GET"])
@bs_read
def api_bs_timetable():
    """Whole-department timetable, filterable by session / semester / teacher."""
    clause, params = ctx_clause("o")
    sql, args = _SLOT_COLS + f" WHERE {clause}", list(params)

    session_id = parse_int(request.args.get("session_id"))
    if session_id:
        sql += " AND o.session_id=%s"
        args.append(session_id)
    sem = parse_int(request.args.get("semester"))
    if sem:
        sql += " AND o.actual_semester=%s"
        args.append(sem)
    tid = clean(request.args.get("teacher_id"))
    if tid:
        sql += (" AND ts.offering_section_id IN "
                "(SELECT offering_section_id FROM bs_teaching_assignments WHERE teacher_id=%s)")
        args.append(tid)

    sql += (" ORDER BY FIELD(ts.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), "
            "ts.start_time, c.code")
    rows = [safe_slot(r) for r in query(sql, args)]

    by_day = {d: [] for d in _DAYS}
    for r in rows:
        by_day.setdefault(r["day"], []).append(r)
    return jsonify({"slots": rows, "byDay": by_day})


# ================================================================
# ATTENDANCE  (spec §24)  —  per course offering section
# ================================================================

@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/attendance", methods=["GET"])
@bs_mark
def api_bs_get_attendance(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    denied = _may_teach(sid)
    if denied:
        return denied

    on_date = clean(request.args.get("date")) or str(_date.today())
    roster = query("""
        SELECT en.student_id, st.name AS student_name, st.roll_no,
               a.status, a.id AS attendance_id, a.remarks
        FROM   bs_enrollments en
        JOIN   students st ON st.id = en.student_id
        LEFT JOIN bs_attendance a
               ON a.student_id = en.student_id
              AND a.offering_section_id = en.offering_section_id
              AND a.date = %s
        WHERE  en.offering_section_id=%s AND en.status='enrolled'
        ORDER  BY st.roll_no, st.name
    """, (on_date, sid))

    return jsonify({
        "sectionId": sid, "date": on_date,
        "records": [{
            "studentId":   r["student_id"],
            "studentName": r["student_name"],
            "rollNo":      r["roll_no"] or "",
            "status":      r["status"] or "",
            "remarks":     r["remarks"] or "",
            "marked":      r["attendance_id"] is not None,
        } for r in roster],
    })


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/attendance", methods=["POST"])
@bs_mark
def api_bs_mark_attendance(sid):
    """
    Mark attendance for one lecture of one offering section.

    Because the row is keyed on (student, section, date), a student can be
    marked separately for each of the five courses they attend that day —
    which the department-wide attendance table, keyed on (student, date),
    cannot express (see migration 003 §14).
    """
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    denied = _may_teach(sid)
    if denied:
        return denied

    data    = request.get_json(force=True, silent=True) or {}
    on_date = clean(data.get("date")) or str(_date.today())
    records = data.get("records") or []
    if not isinstance(records, list) or not records:
        return json_error("No attendance records supplied")

    slot_id = parse_int(data.get("timetableSlotId"))
    if slot_id:
        slot = query("SELECT offering_section_id FROM bs_timetable_slots WHERE id=%s",
                     (slot_id,), one=True)
        if not slot or slot["offering_section_id"] != sid:
            return json_error("That timetable slot does not belong to this section", 400)

    # Only enrolled students of THIS section may be marked.
    allowed = {r["student_id"] for r in query(
        "SELECT student_id FROM bs_enrollments "
        "WHERE offering_section_id=%s AND status='enrolled'", (sid,))}

    saved, rejected = 0, []
    for rec in records:
        student_id = clean(rec.get("studentId"))
        status     = clean(rec.get("status")).lower()
        if student_id not in allowed:
            rejected.append({"studentId": student_id, "reason": "Not enrolled in this section"})
            continue
        if status not in ("present", "absent", "late", "leave"):
            rejected.append({"studentId": student_id, "reason": f"Invalid status '{status}'"})
            continue
        try:
            query("""
                INSERT INTO bs_attendance
                    (student_id, offering_section_id, timetable_slot_id, date, status,
                     marked_by, remarks)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                    status=VALUES(status), marked_by=VALUES(marked_by),
                    remarks=VALUES(remarks), timetable_slot_id=VALUES(timetable_slot_id),
                    marked_at=CURRENT_TIMESTAMP
            """, (student_id, sid, slot_id, on_date, status,
                  str(current_user.id)[:10], clean(rec.get("remarks")) or None), commit=True)
            saved += 1
        except Exception as e:
            rejected.append({"studentId": student_id, "reason": str(e)})

    return jsonify({
        "success": True, "saved": saved, "rejected": rejected,
        "message": f"Attendance saved for {saved} student(s)",
    })


@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/attendance-summary", methods=["GET"])
@bs_read
def api_bs_attendance_summary(sid):
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    if current_user.role == "teacher" and not teacher_teaches_section(current_user.id, sid):
        return json_error("You are not assigned to teach this section", 403)

    rows = query("""
        SELECT en.student_id, st.name AS student_name, st.roll_no,
               COUNT(a.id) AS total,
               SUM(a.status='present') AS present,
               SUM(a.status='late')    AS late,
               SUM(a.status='absent')  AS absent,
               SUM(a.status='leave')   AS leave_count
        FROM   bs_enrollments en
        JOIN   students st ON st.id = en.student_id
        LEFT JOIN bs_attendance a
               ON a.student_id = en.student_id AND a.offering_section_id = en.offering_section_id
        WHERE  en.offering_section_id=%s AND en.status IN ('enrolled','completed')
        GROUP  BY en.student_id, st.name, st.roll_no
        ORDER  BY st.roll_no, st.name
    """, (sid,))

    out = []
    for r in rows:
        total   = int(r["total"] or 0)
        present = int(r["present"] or 0) + int(r["late"] or 0)
        out.append({
            "studentId":   r["student_id"],
            "studentName": r["student_name"],
            "rollNo":      r["roll_no"] or "",
            "total":       total,
            "present":     int(r["present"] or 0),
            "late":        int(r["late"] or 0),
            "absent":      int(r["absent"] or 0),
            "leave":       int(r["leave_count"] or 0),
            "percent":     round(present * 100.0 / total, 1) if total else None,
        })
    return jsonify({"sectionId": sid, "summary": out})


# ================================================================
# RESULTS / ATTEMPTS  (spec §20, §25)
# ================================================================

@bs_offerings_bp.route("/api/bs/offering-sections/<int:sid>/results", methods=["POST"])
@bs_mark
def api_bs_enter_results(sid):
    """
    Record final grades for a section (spec §25).

    The grade lands on the student's ATTEMPT for that course, so a failed
    course becomes a completed attempt with status 'failed' and the repeat
    later becomes attempt 2 — never a duplicate course row (spec §20, §42.8).
    """
    guard = assert_in_context("bs_offering_sections", sid, "Section")
    if guard:
        return guard
    denied = _may_teach(sid)
    if denied:
        return denied

    off = offering_of_section(sid)
    if not off:
        return json_error("Section not found", 404)

    results = (request.get_json(force=True, silent=True) or {}).get("results") or []
    if not isinstance(results, list) or not results:
        return json_error("No results supplied")

    enrolled = {r["student_id"]: r["id"] for r in query(
        "SELECT id, student_id FROM bs_enrollments "
        "WHERE offering_section_id=%s AND status IN ('enrolled','completed')", (sid,))}

    saved, rejected = 0, []
    for rec in results:
        student_id = clean(rec.get("studentId"))
        grade      = clean(rec.get("grade"), upper=True)
        if student_id not in enrolled:
            rejected.append({"studentId": student_id, "reason": "Not enrolled in this section"})
            continue
        if grade not in GRADE_POINTS:
            rejected.append({"studentId": student_id, "reason": f"Unknown grade '{grade}'"})
            continue

        points = GRADE_POINTS[grade]
        status = "failed" if grade == "F" else "passed"
        try:
            attempt_id = _ensure_attempt(student_id, off["course_id"], off["id"],
                                         off["session_name"])
            query("""UPDATE bs_course_attempts
                     SET grade=%s, gpa_points=%s, status=%s WHERE id=%s""",
                  (grade, points, status, attempt_id), commit=True)
            query("UPDATE bs_enrollments SET status='completed' WHERE id=%s",
                  (enrolled[student_id],), commit=True)
            saved += 1
        except Exception as e:
            rejected.append({"studentId": student_id, "reason": str(e)})

    return jsonify({
        "success": True, "saved": saved, "rejected": rejected,
        "message": f"Result recorded for {saved} student(s)",
    })


@bs_offerings_bp.route("/api/bs/students/<sid>/progress", methods=["GET"])
@bs_read
def api_bs_student_progress(sid):
    """
    Credit-hour based academic progress (spec §22, §42.11).

    Promotion is expressed as credit hours earned against the program
    requirement — never as "semester number + 1" — and the CGPA counts only
    the latest attempt of each course, so a passed repeat replaces its F.
    """
    guard = assert_student_in_context(sid)
    if guard:
        return guard
    if current_user.role == "student" and str(current_user.id) != str(sid):
        return json_error("You can only view your own progress", 403)

    prog = student_progress(sid)
    if not prog:
        return json_error("Student not found", 404)
    return jsonify(prog)


@bs_offerings_bp.route("/api/bs/students/<sid>/attempts", methods=["GET"])
@bs_read
def api_bs_student_attempts(sid):
    guard = assert_student_in_context(sid)
    if guard:
        return guard
    if current_user.role == "student" and str(current_user.id) != str(sid):
        return json_error("You can only view your own record", 403)
    rows = query("""
        SELECT at.*, c.code AS course_code, c.name AS course_name, c.credit_hours
        FROM   bs_course_attempts at
        JOIN   bs_courses c ON c.id = at.course_id
        WHERE  at.student_id=%s
        ORDER  BY c.code, at.attempt_no
    """, (sid,))
    return jsonify([safe_attempt(r) for r in rows])


# ================================================================
# PERSONAL VIEWS  (spec §31 teacher, §32 student)
# ================================================================

@bs_offerings_bp.route("/api/bs/my/teaching", methods=["GET"])
@bs_read
def api_bs_my_teaching():
    """
    What the signed-in teacher teaches: course, section, session, semester
    and student count — the teacher-portal view of §31.
    """
    if current_user.role != "teacher":
        return json_error("This view is for teachers", 403)
    if not bs_teacher(current_user.id):
        return jsonify([])

    rows = query("""
        SELECT ta.*, t.name AS teacher_name, os.name AS section_name,
               c.code AS course_code, c.name AS course_name, c.credit_hours,
               s.name AS session_name, o.actual_semester, o.status AS offering_status,
               (SELECT COUNT(*) FROM bs_enrollments en
                 WHERE en.offering_section_id=os.id AND en.status='enrolled') AS enrolled_count
        FROM   bs_teaching_assignments ta
        JOIN   teachers t ON t.id = ta.teacher_id
        JOIN   bs_offering_sections os ON os.id = ta.offering_section_id
        JOIN   bs_course_offerings  o  ON o.id  = os.offering_id
        JOIN   bs_courses           c  ON c.id  = o.course_id
        JOIN   bs_academic_sessions s  ON s.id  = o.session_id
        WHERE  ta.teacher_id=%s AND o.status <> 'cancelled'
        ORDER  BY s.start_date DESC, c.code, os.name
    """, (current_user.id,))

    out = []
    for r in rows:
        d = safe_teaching_assignment(r)
        d["offeringStatus"] = r["offering_status"]
        d["timetable"] = [safe_slot(s) for s in query(_SLOT_COLS + """
            WHERE ts.offering_section_id=%s
            ORDER BY FIELD(ts.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), ts.start_time
        """, (r["offering_section_id"],))]
        out.append(d)
    return jsonify(out)


@bs_offerings_bp.route("/api/bs/my/enrollments", methods=["GET"])
@bs_read
def api_bs_my_enrollments():
    """The signed-in student's own courses this session, plus progress (§32)."""
    if current_user.role != "student":
        return json_error("This view is for students", 403)
    if not bs_student(current_user.id):
        return jsonify({"enrollments": [], "progress": None})

    session_id = parse_int(request.args.get("session_id"))
    sql, args = _ENROLL_COLS + " WHERE en.student_id=%s", [current_user.id]
    if session_id:
        sql += " AND o.session_id=%s"
        args.append(session_id)
    else:
        sql += " AND s.status IN ('active','planned')"
    sql += " ORDER BY s.start_date DESC, c.code"

    return jsonify({
        "enrollments": [safe_enrollment(r) for r in query(sql, args)],
        "progress":    student_progress(current_user.id),
    })


@bs_offerings_bp.route("/api/bs/my/timetable", methods=["GET"])
@bs_read
def api_bs_my_timetable():
    """Personal weekly timetable, derived from teaching or enrollment."""
    role = current_user.role
    if role == "teacher":
        sub, sub_args = ("SELECT offering_section_id FROM bs_teaching_assignments "
                         "WHERE teacher_id=%s"), [current_user.id]
    elif role == "student":
        sub, sub_args = ("SELECT offering_section_id FROM bs_enrollments "
                         "WHERE student_id=%s AND status='enrolled'"), [current_user.id]
    else:
        return json_error("This view is for teachers and students", 403)

    clause, params = ctx_clause("o")
    rows = query(_SLOT_COLS + f"""
        WHERE {clause} AND ts.offering_section_id IN ({sub})
              AND o.status <> 'cancelled'
        ORDER BY FIELD(ts.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), ts.start_time
    """, list(params) + sub_args)

    slots = [safe_slot(r) for r in rows]
    by_day = {d: [] for d in _DAYS}
    for s in slots:
        by_day.setdefault(s["day"], []).append(s)
    return jsonify({"slots": slots, "byDay": by_day})
