"""
routes/bs_curriculum.py  —  BS Department: the CURRICULUM side of the model.

    "Curriculum defines what is normally required."

This blueprint owns the things that describe the *plan*: programs, the
reusable course catalogue, academic sessions, curriculum versions, the
course-to-recommended-semester mapping, elective groups and batches.
What is actually offered and taken lives in routes/bs_offerings.py.

Two rules are enforced here rather than merely documented:

  * A COURSE NEVER CARRIES A SEMESTER.  ``POST /api/bs/courses`` rejects any
    attempt to send one.  A course's placement is a property of a curriculum
    version, not of the course (spec §7, §42.1).
  * A CURRICULUM VERSION IS HISTORY.  Publishing a new version clones the old
    one into a new row; the previous version and every batch pinned to it are
    left byte-for-byte intact (spec §4, §6, §42.9).

Endpoints
---------
  GET/POST         /api/bs/programs                     PUT/DELETE /api/bs/programs/<id>
  GET/POST         /api/bs/courses                      PUT/DELETE /api/bs/courses/<id>
  GET/POST         /api/bs/sessions                     PUT/DELETE /api/bs/sessions/<id>
  GET/POST         /api/bs/curriculums                  PUT/DELETE /api/bs/curriculums/<id>
  POST             /api/bs/curriculums/<id>/clone       new version, old kept
  GET/POST         /api/bs/curriculums/<id>/courses     the semester plan
  PUT/DELETE       /api/bs/curriculum-courses/<id>
  GET/POST         /api/bs/curriculums/<id>/elective-groups
  DELETE           /api/bs/elective-groups/<id>
  GET/POST         /api/bs/batches                      PUT/DELETE /api/bs/batches/<id>
  GET              /api/bs/students                     enrollment picker
  GET              /api/bs/teachers                     assignment picker
  GET              /api/bs/overview                     dashboard counters
"""

from flask import Blueprint, jsonify, request

from db import query
from utils.bs_academic import (
    bs_read,
    bs_write,
    bs_write_context,
    clean,
    json_error,
    parse_int,
    safe_batch,
    safe_course,
    safe_curriculum,
    safe_curriculum_course,
    safe_program,
    safe_session,
)
from utils.context import assert_in_context, ctx_clause

bs_curriculum_bp = Blueprint("bs_curriculum", __name__)


# ================================================================
# PROGRAMS  (spec §3)
# ================================================================

@bs_curriculum_bp.route("/api/bs/programs", methods=["GET"])
@bs_read
def api_bs_programs():
    clause, params = ctx_clause("p")
    rows = query(f"""
        SELECT p.*,
               (SELECT COUNT(*) FROM bs_curriculums cu WHERE cu.program_id = p.id) AS curriculum_count,
               (SELECT COUNT(*) FROM bs_batches     b  WHERE b.program_id  = p.id) AS batch_count
        FROM   bs_programs p
        WHERE  {clause}
        ORDER  BY p.name
    """, params)
    out = []
    for r in rows:
        d = safe_program(r)
        d["curriculumCount"] = r["curriculum_count"]
        d["batchCount"]      = r["batch_count"]
        out.append(d)
    return jsonify(out)


@bs_curriculum_bp.route("/api/bs/programs", methods=["POST"])
@bs_write()
def api_bs_add_program():
    data = request.get_json(force=True, silent=True) or {}
    name = clean(data.get("name"))
    code = clean(data.get("code"), upper=True)
    if not name:
        return json_error("Program name is required")
    if not code:
        return json_error("Program code is required")

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    clause, params = ctx_clause()
    if query(f"SELECT id FROM bs_programs WHERE code=%s AND {clause}",
             [code] + params, one=True):
        return json_error("A program with this code already exists", 409)

    try:
        new_id = query("""
            INSERT INTO bs_programs
                (name, code, degree_type, duration_years, total_semesters,
                 required_credit_hours, status, department_id, campus_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (name, code, clean(data.get("degreeType")) or "BS",
              data.get("durationYears") or 4,
              parse_int(data.get("totalSemesters"), 8),
              parse_int(data.get("requiredCreditHours"), 130),
              clean(data.get("status")) or "active",
              dept_id, campus_id), commit=True)
        row = query("SELECT * FROM bs_programs WHERE id=%s", (new_id,), one=True)
        return jsonify({"success": True, "program": safe_program(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create program: {e}", 500)


@bs_curriculum_bp.route("/api/bs/programs/<int:pid>", methods=["PUT"])
@bs_write()
def api_bs_update_program(pid):
    guard = assert_in_context("bs_programs", pid, "Program")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    fields = [("name", "name"), ("code", "code"), ("degreeType", "degree_type"),
              ("durationYears", "duration_years"), ("totalSemesters", "total_semesters"),
              ("requiredCreditHours", "required_credit_hours"), ("status", "status")]
    sets, args = [], []
    for key, col in fields:
        if key in data:
            val = data[key]
            if key == "code":
                val = clean(val, upper=True)
            elif isinstance(val, str):
                val = val.strip()
            sets.append(f"{col}=%s")
            args.append(val)

    if sets:
        args.append(pid)
        query(f"UPDATE bs_programs SET {','.join(sets)} WHERE id=%s", args, commit=True)
    row = query("SELECT * FROM bs_programs WHERE id=%s", (pid,), one=True)
    return jsonify({"success": True, "program": safe_program(row)})


@bs_curriculum_bp.route("/api/bs/programs/<int:pid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_program(pid):
    guard = assert_in_context("bs_programs", pid, "Program")
    if guard:
        return guard

    # Refuse rather than cascade: deleting a program would take its
    # curriculums, batches and every student's history with it (spec §36).
    batches = query("SELECT COUNT(*) AS n FROM bs_batches WHERE program_id=%s",
                    (pid,), one=True)["n"]
    if batches:
        return json_error(
            f"This program has {batches} batch(es). Set it inactive instead of deleting.", 409)
    curriculums = query("SELECT COUNT(*) AS n FROM bs_curriculums WHERE program_id=%s",
                        (pid,), one=True)["n"]
    if curriculums:
        return json_error(
            f"This program has {curriculums} curriculum version(s). Delete those first, "
            "or set the program inactive.", 409)

    query("DELETE FROM bs_programs WHERE id=%s", (pid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# COURSES  (spec §7)  —  reusable, never tied to a semester
# ================================================================

@bs_curriculum_bp.route("/api/bs/courses", methods=["GET"])
@bs_read
def api_bs_courses():
    search   = clean(request.args.get("search"))
    status   = clean(request.args.get("status"))
    ctype    = clean(request.args.get("type"))
    program_id = parse_int(request.args.get("program_id"))
    clause, params = ctx_clause("c")

    sql  = f"""
        SELECT c.*, p.name AS program_name, p.code AS program_code,
               (SELECT COUNT(*) FROM bs_curriculum_courses cc WHERE cc.course_id = c.id) AS curriculum_count,
               (SELECT COUNT(*) FROM bs_course_offerings   o WHERE o.course_id  = c.id) AS offering_count
        FROM   bs_courses c
        JOIN   bs_programs p ON p.id = c.program_id
        WHERE  {clause}
    """
    args = list(params)
    if program_id:
        sql += " AND c.program_id=%s"
        args.append(program_id)
    if search:
        sql += " AND (LOWER(c.name) LIKE %s OR LOWER(c.code) LIKE %s)"
        args += [f"%{search.lower()}%", f"%{search.lower()}%"]
    if status:
        sql += " AND c.status=%s"
        args.append(status)
    if ctype:
        sql += " AND c.course_type=%s"
        args.append(ctype)
    sql += " ORDER BY p.name, c.code"

    out = []
    for r in query(sql, args):
        d = safe_course(r)
        d["curriculumCount"] = r["curriculum_count"]
        d["offeringCount"]   = r["offering_count"]
        out.append(d)
    return jsonify(out)


@bs_curriculum_bp.route("/api/bs/courses", methods=["POST"])
@bs_write()
def api_bs_add_course():
    data = request.get_json(force=True, silent=True) or {}

    # THE central rule of this architecture (spec §7, §42.1).  A semester is
    # never a property of a course, so refuse it loudly instead of silently
    # dropping it — a caller sending one has the wrong mental model.
    for banned in ("semester", "recommendedSemester", "actualSemester"):
        if data.get(banned) not in (None, ""):
            return json_error(
                "A course is never tied to a semester. Add the course, then place it "
                "in a curriculum (recommended semester) or offer it in a session "
                "(actual semester).", 400)

    code = clean(data.get("code"), upper=True)
    name = clean(data.get("name"))
    if not code:
        return json_error("Course code is required")
    if not name:
        return json_error("Course name is required")

    program_id = parse_int(data.get("programId"))
    if not program_id:
        return json_error("Program is required — every course belongs to exactly one "
                           "program's catalogue.")

    ch = parse_int(data.get("creditHours"), 3)
    if ch is None or ch < 0 or ch > 12:
        return json_error("Credit hours must be between 0 and 12")

    ctype = clean(data.get("courseType")) or "theory"
    if ctype not in ("theory", "lab"):
        return json_error("Course type must be 'theory' or 'lab'")

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    guard = assert_in_context("bs_programs", program_id, "Program")
    if guard:
        return guard

    if query("SELECT id FROM bs_courses WHERE code=%s AND program_id=%s",
             (code, program_id), one=True):
        return json_error(f"Course {code} already exists in this program's catalogue", 409)

    try:
        new_id = query("""
            INSERT INTO bs_courses
                (code, name, credit_hours, course_type, description, status,
                 department_id, campus_id, program_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (code, name, ch, ctype, clean(data.get("description")),
              clean(data.get("status")) or "active", dept_id, campus_id, program_id), commit=True)
        row = query("""
            SELECT c.*, p.name AS program_name, p.code AS program_code
            FROM bs_courses c JOIN bs_programs p ON p.id=c.program_id WHERE c.id=%s
        """, (new_id,), one=True)
        return jsonify({"success": True, "course": safe_course(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create course: {e}", 500)


@bs_curriculum_bp.route("/api/bs/courses/<int:cid>", methods=["PUT"])
@bs_write()
def api_bs_update_course(cid):
    guard = assert_in_context("bs_courses", cid, "Course")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    for banned in ("semester", "recommendedSemester", "actualSemester"):
        if data.get(banned) not in (None, ""):
            return json_error(
                "A course cannot be moved to a semester. Change its recommended "
                "semester in the curriculum, or its actual semester on the offering.", 400)

    # Moving a course to a different program is only safe while it is not
    # yet in use anywhere — once it is placed in a curriculum or offered,
    # re-parenting it would silently drag someone else's curriculum/session
    # data across into the new program.
    if "programId" in data and data.get("programId") not in (None, ""):
        new_program_id = parse_int(data.get("programId"))
        row = query("SELECT program_id FROM bs_courses WHERE id=%s", (cid,), one=True)
        if row and new_program_id and new_program_id != row["program_id"]:
            in_use = query("""
                SELECT
                    (SELECT COUNT(*) FROM bs_curriculum_courses WHERE course_id=%s) AS cc,
                    (SELECT COUNT(*) FROM bs_course_offerings   WHERE course_id=%s) AS off
            """, (cid, cid), one=True)
            if in_use["cc"] or in_use["off"]:
                return json_error(
                    "This course is already placed in a curriculum or offered in a "
                    "session, so it can't be moved to a different program. Create a "
                    "new course under the other program instead.", 409)
            guard = assert_in_context("bs_programs", new_program_id, "Program")
            if guard:
                return guard

    sets, args = [], []
    for key, col in [("code", "code"), ("name", "name"), ("creditHours", "credit_hours"),
                     ("courseType", "course_type"), ("description", "description"),
                     ("status", "status"), ("programId", "program_id")]:
        if key in data:
            val = data[key]
            if key == "code":
                val = clean(val, upper=True)
            elif key == "programId":
                val = parse_int(val)
                if not val:
                    continue
            elif isinstance(val, str):
                val = val.strip()
            sets.append(f"{col}=%s")
            args.append(val)

    if sets:
        args.append(cid)
        try:
            query(f"UPDATE bs_courses SET {','.join(sets)} WHERE id=%s", args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update course: {e}", 500)
    row = query("""
        SELECT c.*, p.name AS program_name, p.code AS program_code
        FROM bs_courses c JOIN bs_programs p ON p.id=c.program_id WHERE c.id=%s
    """, (cid,), one=True)
    return jsonify({"success": True, "course": safe_course(row)})


@bs_curriculum_bp.route("/api/bs/courses/<int:cid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_course(cid):
    guard = assert_in_context("bs_courses", cid, "Course")
    if guard:
        return guard

    # A course in use is never silently cascaded away — enrollments, grades
    # and attempt history hang off its offerings (spec §36).
    offerings = query("SELECT COUNT(*) AS n FROM bs_course_offerings WHERE course_id=%s",
                      (cid,), one=True)["n"]
    if offerings:
        return json_error(
            f"This course has {offerings} offering(s) with enrollment history. "
            "Set it inactive instead of deleting.", 409)
    attempts = query("SELECT COUNT(*) AS n FROM bs_course_attempts WHERE course_id=%s",
                     (cid,), one=True)["n"]
    if attempts:
        return json_error(
            f"This course has {attempts} recorded student attempt(s). "
            "Set it inactive instead of deleting.", 409)

    query("DELETE FROM bs_courses WHERE id=%s", (cid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# ACADEMIC SESSIONS  (spec §10)
# ================================================================

@bs_curriculum_bp.route("/api/bs/sessions", methods=["GET"])
@bs_read
def api_bs_sessions():
    clause, params = ctx_clause("s")
    rows = query(f"""
        SELECT s.*,
               (SELECT COUNT(*) FROM bs_course_offerings o WHERE o.session_id = s.id) AS offering_count
        FROM   bs_academic_sessions s
        WHERE  {clause}
        ORDER  BY s.start_date DESC, s.id DESC
    """, params)
    out = []
    for r in rows:
        d = safe_session(r)
        d["offeringCount"] = r["offering_count"]
        out.append(d)
    return jsonify(out)


@bs_curriculum_bp.route("/api/bs/sessions", methods=["POST"])
@bs_write()
def api_bs_add_session():
    data = request.get_json(force=True, silent=True) or {}
    name = clean(data.get("name"))
    if not name:
        return json_error("Session name is required (e.g. Fall 2027)")

    term = clean(data.get("term")).title()
    if term and term not in ("Fall", "Spring", "Summer"):
        return json_error("Term must be Fall, Spring or Summer")

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    clause, params = ctx_clause()
    if query(f"SELECT id FROM bs_academic_sessions WHERE name=%s AND {clause}",
             [name] + params, one=True):
        return json_error(f"Session '{name}' already exists", 409)

    try:
        new_id = query("""
            INSERT INTO bs_academic_sessions
                (name, term, academic_year, start_date, end_date, status,
                 department_id, campus_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (name, term or None, clean(data.get("academicYear")) or None,
              clean(data.get("startDate")) or None, clean(data.get("endDate")) or None,
              clean(data.get("status")) or "planned", dept_id, campus_id), commit=True)
        row = query("SELECT * FROM bs_academic_sessions WHERE id=%s", (new_id,), one=True)
        return jsonify({"success": True, "session": safe_session(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create session: {e}", 500)


@bs_curriculum_bp.route("/api/bs/sessions/<int:sid>", methods=["PUT"])
@bs_write()
def api_bs_update_session(sid):
    guard = assert_in_context("bs_academic_sessions", sid, "Session")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []
    for key, col in [("name", "name"), ("term", "term"), ("academicYear", "academic_year"),
                     ("startDate", "start_date"), ("endDate", "end_date"),
                     ("status", "status")]:
        if key in data:
            val = data[key]
            if isinstance(val, str):
                val = val.strip() or None
            sets.append(f"{col}=%s")
            args.append(val)

    if sets:
        args.append(sid)
        try:
            query(f"UPDATE bs_academic_sessions SET {','.join(sets)} WHERE id=%s",
                  args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update session: {e}", 500)
    row = query("SELECT * FROM bs_academic_sessions WHERE id=%s", (sid,), one=True)
    return jsonify({"success": True, "session": safe_session(row)})


@bs_curriculum_bp.route("/api/bs/sessions/<int:sid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_session(sid):
    guard = assert_in_context("bs_academic_sessions", sid, "Session")
    if guard:
        return guard
    offerings = query("SELECT COUNT(*) AS n FROM bs_course_offerings WHERE session_id=%s",
                      (sid,), one=True)["n"]
    if offerings:
        return json_error(
            f"This session has {offerings} course offering(s). Archive it instead of deleting.", 409)
    query("DELETE FROM bs_academic_sessions WHERE id=%s", (sid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# CURRICULUM VERSIONS  (spec §4, §6)
# ================================================================

@bs_curriculum_bp.route("/api/bs/curriculums", methods=["GET"])
@bs_read
def api_bs_curriculums():
    pid = parse_int(request.args.get("program_id"))
    clause, params = ctx_clause("cu")
    sql = f"""
        SELECT cu.*, p.name AS program_name, p.code AS program_code,
               (SELECT COUNT(*) FROM bs_curriculum_courses cc WHERE cc.curriculum_id = cu.id) AS course_count,
               (SELECT COALESCE(SUM(COALESCE(cc.credit_hours, c.credit_hours)),0)
                  FROM bs_curriculum_courses cc
                  JOIN bs_courses c ON c.id = cc.course_id
                 WHERE cc.curriculum_id = cu.id) AS total_credits,
               (SELECT COUNT(*) FROM bs_batches b WHERE b.curriculum_id = cu.id) AS batch_count
        FROM   bs_curriculums cu
        JOIN   bs_programs p ON p.id = cu.program_id
        WHERE  {clause}
    """
    args = list(params)
    if pid:
        sql += " AND cu.program_id=%s"
        args.append(pid)
    sql += " ORDER BY p.name, cu.version_year DESC"

    out = []
    for r in query(sql, args):
        d = safe_curriculum(r)
        d["courseCount"]  = r["course_count"]
        d["totalCredits"] = int(r["total_credits"] or 0)
        d["batchCount"]   = r["batch_count"]
        out.append(d)
    return jsonify(out)


@bs_curriculum_bp.route("/api/bs/curriculums", methods=["POST"])
@bs_write()
def api_bs_add_curriculum():
    data = request.get_json(force=True, silent=True) or {}
    pid  = parse_int(data.get("programId"))
    year = parse_int(data.get("versionYear"))
    if not pid:
        return json_error("Program is required")
    if not year:
        return json_error("Version year is required (e.g. 2026)")

    guard = assert_in_context("bs_programs", pid, "Program")
    if guard:
        return guard

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    if query("SELECT id FROM bs_curriculums WHERE program_id=%s AND version_year=%s",
             (pid, year), one=True):
        return json_error(f"A {year} curriculum already exists for this program. "
                          "Clone it to create a revision.", 409)

    name = clean(data.get("name")) or f"Curriculum {year}"
    is_default = 1 if data.get("isDefault") else 0
    try:
        if is_default:
            query("UPDATE bs_curriculums SET is_default=0 WHERE program_id=%s", (pid,),
                  commit=True)
        new_id = query("""
            INSERT INTO bs_curriculums
                (program_id, name, version_year, status, is_default, department_id, campus_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (pid, name, year, clean(data.get("status")) or "active", is_default,
              dept_id, campus_id), commit=True)
        row = query("""
            SELECT cu.*, p.name AS program_name, p.code AS program_code
            FROM bs_curriculums cu JOIN bs_programs p ON p.id=cu.program_id
            WHERE cu.id=%s
        """, (new_id,), one=True)
        return jsonify({"success": True, "curriculum": safe_curriculum(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create curriculum: {e}", 500)


@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>/clone", methods=["POST"])
@bs_write()
def api_bs_clone_curriculum(cuid):
    """
    Publish a NEW curriculum version from an existing one (spec §4, §6, §42.9).

    The source version is not touched in any way.  Batches already pinned to
    it keep following it forever; only new batches point at the clone.  This
    is what "curriculum versions must be kept historically intact" means in
    practice — a revision is an INSERT, never an UPDATE.
    """
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard

    src = query("SELECT * FROM bs_curriculums WHERE id=%s", (cuid,), one=True)
    data = request.get_json(force=True, silent=True) or {}
    year = parse_int(data.get("versionYear"))
    if not year:
        return json_error("New version year is required")
    if year == src["version_year"]:
        return json_error("The new version year must differ from the source version")
    if query("SELECT id FROM bs_curriculums WHERE program_id=%s AND version_year=%s",
             (src["program_id"], year), one=True):
        return json_error(f"A {year} curriculum already exists for this program", 409)

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    try:
        new_id = query("""
            INSERT INTO bs_curriculums
                (program_id, name, version_year, status, is_default, department_id, campus_id)
            VALUES (%s,%s,%s,'active',0,%s,%s)
        """, (src["program_id"], clean(data.get("name")) or f"Curriculum {year}",
              year, dept_id, campus_id), commit=True)

        # Copy the whole semester plan across in one statement.
        query("""
            INSERT INTO bs_curriculum_courses
                (curriculum_id, course_id, recommended_semester, classification,
                 is_compulsory, elective_group, credit_hours)
            SELECT %s, course_id, recommended_semester, classification,
                   is_compulsory, elective_group, credit_hours
            FROM   bs_curriculum_courses WHERE curriculum_id=%s
        """, (new_id, cuid), commit=True)

        query("""
            INSERT INTO bs_elective_groups (curriculum_id, semester, name, required_courses)
            SELECT %s, semester, name, required_courses
            FROM   bs_elective_groups WHERE curriculum_id=%s
        """, (new_id, cuid), commit=True)

        copied = query("SELECT COUNT(*) AS n FROM bs_curriculum_courses WHERE curriculum_id=%s",
                       (new_id,), one=True)["n"]
        row = query("""
            SELECT cu.*, p.name AS program_name, p.code AS program_code
            FROM bs_curriculums cu JOIN bs_programs p ON p.id=cu.program_id
            WHERE cu.id=%s
        """, (new_id,), one=True)
        return jsonify({
            "success": True,
            "curriculum": safe_curriculum(row),
            "coursesCopied": copied,
            "message": f"Version {year} created with {copied} course(s). "
                       f"Version {src['version_year']} is unchanged.",
        }), 201
    except Exception as e:
        return json_error(f"Failed to clone curriculum: {e}", 500)


@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>", methods=["PUT"])
@bs_write()
def api_bs_update_curriculum(cuid):
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard
    cur = query("SELECT * FROM bs_curriculums WHERE id=%s", (cuid,), one=True)

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []
    for key, col in [("name", "name"), ("status", "status"), ("versionYear", "version_year")]:
        if key in data:
            val = data[key]
            if isinstance(val, str):
                val = val.strip()
            sets.append(f"{col}=%s")
            args.append(val)
    if "isDefault" in data:
        if data["isDefault"]:
            query("UPDATE bs_curriculums SET is_default=0 WHERE program_id=%s",
                  (cur["program_id"],), commit=True)
        sets.append("is_default=%s")
        args.append(1 if data["isDefault"] else 0)

    if sets:
        args.append(cuid)
        try:
            query(f"UPDATE bs_curriculums SET {','.join(sets)} WHERE id=%s", args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update curriculum: {e}", 500)

    row = query("""
        SELECT cu.*, p.name AS program_name, p.code AS program_code
        FROM bs_curriculums cu JOIN bs_programs p ON p.id=cu.program_id
        WHERE cu.id=%s
    """, (cuid,), one=True)
    return jsonify({"success": True, "curriculum": safe_curriculum(row)})


@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_curriculum(cuid):
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard
    batches = query("SELECT COUNT(*) AS n FROM bs_batches WHERE curriculum_id=%s",
                    (cuid,), one=True)["n"]
    if batches:
        return json_error(
            f"{batches} batch(es) follow this curriculum version. A version students "
            "were admitted under must stay on record - archive it instead.", 409)
    query("DELETE FROM bs_curriculums WHERE id=%s", (cuid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# CURRICULUM COURSES  (spec §8)  —  the recommended-semester plan
# ================================================================

@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>/courses", methods=["GET"])
@bs_read
def api_bs_curriculum_courses(cuid):
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard

    rows = query("""
        SELECT cc.*, c.code AS course_code, c.name AS course_name,
               c.course_type, c.credit_hours AS course_credit_hours
        FROM   bs_curriculum_courses cc
        JOIN   bs_courses c ON c.id = cc.course_id
        WHERE  cc.curriculum_id = %s
        ORDER  BY cc.recommended_semester, c.code
    """, (cuid,))

    # Grouped by recommended semester — the shape the UI renders directly.
    semesters = {}
    for r in rows:
        d = safe_curriculum_course(r)
        semesters.setdefault(d["recommendedSemester"], []).append(d)

    cur = query("""
        SELECT cu.*, p.name AS program_name, p.code AS program_code, p.total_semesters
        FROM bs_curriculums cu JOIN bs_programs p ON p.id=cu.program_id
        WHERE cu.id=%s
    """, (cuid,), one=True)

    return jsonify({
        "curriculum":   safe_curriculum(cur),
        "totalSemesters": cur.get("total_semesters") or 8,
        "courses":      [safe_curriculum_course(r) for r in rows],
        "semesters":    [{"semester": s,
                          "courses": semesters[s],
                          "credits": sum(c["creditHours"] for c in semesters[s])}
                         for s in sorted(semesters)],
        "totalCredits": sum(safe_curriculum_course(r)["creditHours"] for r in rows),
    })


@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>/courses", methods=["POST"])
@bs_write()
def api_bs_add_curriculum_course(cuid):
    """
    Place an existing course into this curriculum at a RECOMMENDED semester.

    This is the only place a "semester" is written for the plan, and it is a
    property of the mapping — the course itself stays semester-free and
    reusable by every other curriculum version (spec §8, §42.2).
    """
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    course_id = parse_int(data.get("courseId"))
    sem       = parse_int(data.get("recommendedSemester"))
    if not course_id:
        return json_error("Course is required")
    if not sem or sem < 1 or sem > 12:
        return json_error("Recommended semester must be between 1 and 12")

    guard = assert_in_context("bs_courses", course_id, "Course")
    if guard:
        return guard

    curriculum = query("SELECT program_id FROM bs_curriculums WHERE id=%s", (cuid,), one=True)
    course     = query("SELECT program_id, code FROM bs_courses WHERE id=%s", (course_id,), one=True)
    if curriculum and course and curriculum["program_id"] != course["program_id"]:
        return json_error(
            f"Course {course['code']} belongs to a different program's catalogue than "
            "this curriculum. Each program has its own independent course catalogue — "
            "pick a course from this curriculum's program, or add a new course there.", 400)

    if query("SELECT id FROM bs_curriculum_courses WHERE curriculum_id=%s AND course_id=%s",
             (cuid, course_id), one=True):
        return json_error("This course is already in this curriculum version", 409)

    classification = clean(data.get("classification")) or "core"
    if classification not in ("core", "elective", "university", "department", "lab"):
        return json_error("Invalid course classification")

    is_comp = 0 if classification == "elective" else 1
    if "isCompulsory" in data:
        is_comp = 1 if data["isCompulsory"] else 0

    try:
        new_id = query("""
            INSERT INTO bs_curriculum_courses
                (curriculum_id, course_id, recommended_semester, classification,
                 is_compulsory, elective_group, credit_hours)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (cuid, course_id, sem, classification, is_comp,
              clean(data.get("electiveGroup")) or None,
              parse_int(data.get("creditHours"))), commit=True)
        row = query("""
            SELECT cc.*, c.code AS course_code, c.name AS course_name,
                   c.course_type, c.credit_hours AS course_credit_hours
            FROM bs_curriculum_courses cc JOIN bs_courses c ON c.id=cc.course_id
            WHERE cc.id=%s
        """, (new_id,), one=True)
        return jsonify({"success": True, "curriculumCourse": safe_curriculum_course(row)}), 201
    except Exception as e:
        return json_error(f"Failed to add course to curriculum: {e}", 500)


@bs_curriculum_bp.route("/api/bs/curriculum-courses/<int:ccid>", methods=["PUT"])
@bs_write()
def api_bs_update_curriculum_course(ccid):
    guard = assert_in_context("bs_curriculum_courses", ccid, "Curriculum course")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []
    if "recommendedSemester" in data:
        sem = parse_int(data.get("recommendedSemester"))
        if not sem or sem < 1 or sem > 12:
            return json_error("Recommended semester must be between 1 and 12")
        sets.append("recommended_semester=%s")
        args.append(sem)
    for key, col in [("classification", "classification"), ("electiveGroup", "elective_group"),
                     ("creditHours", "credit_hours")]:
        if key in data:
            val = data[key]
            if isinstance(val, str):
                val = val.strip() or None
            sets.append(f"{col}=%s")
            args.append(val)
    if "isCompulsory" in data:
        sets.append("is_compulsory=%s")
        args.append(1 if data["isCompulsory"] else 0)

    if sets:
        args.append(ccid)
        try:
            query(f"UPDATE bs_curriculum_courses SET {','.join(sets)} WHERE id=%s",
                  args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update: {e}", 500)

    row = query("""
        SELECT cc.*, c.code AS course_code, c.name AS course_name,
               c.course_type, c.credit_hours AS course_credit_hours
        FROM bs_curriculum_courses cc JOIN bs_courses c ON c.id=cc.course_id
        WHERE cc.id=%s
    """, (ccid,), one=True)
    return jsonify({"success": True, "curriculumCourse": safe_curriculum_course(row)})


@bs_curriculum_bp.route("/api/bs/curriculum-courses/<int:ccid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_curriculum_course(ccid):
    guard = assert_in_context("bs_curriculum_courses", ccid, "Curriculum course")
    if guard:
        return guard
    # Removing a course from the plan never touches the course itself or any
    # offering already made from it.
    query("DELETE FROM bs_curriculum_courses WHERE id=%s", (ccid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# ELECTIVE GROUPS  (spec §21)
# ================================================================

@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>/elective-groups", methods=["GET"])
@bs_read
def api_bs_elective_groups(cuid):
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard
    rows = query("""
        SELECT eg.*,
               (SELECT COUNT(*) FROM bs_curriculum_courses cc
                 WHERE cc.curriculum_id = eg.curriculum_id
                   AND cc.elective_group = eg.name) AS course_count
        FROM   bs_elective_groups eg
        WHERE  eg.curriculum_id=%s
        ORDER  BY eg.semester, eg.name
    """, (cuid,))
    return jsonify([{
        "id": r["id"], "curriculumId": r["curriculum_id"], "semester": r["semester"],
        "name": r["name"], "requiredCourses": r["required_courses"],
        "courseCount": r["course_count"],
    } for r in rows])


@bs_curriculum_bp.route("/api/bs/curriculums/<int:cuid>/elective-groups", methods=["POST"])
@bs_write()
def api_bs_add_elective_group(cuid):
    guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    name = clean(data.get("name"))
    sem  = parse_int(data.get("semester"))
    if not name:
        return json_error("Group name is required (e.g. Elective Group A)")
    if not sem or sem < 1 or sem > 12:
        return json_error("Semester must be between 1 and 12")

    if query("SELECT id FROM bs_elective_groups WHERE curriculum_id=%s AND semester=%s AND name=%s",
             (cuid, sem, name), one=True):
        return json_error("This group already exists for that semester", 409)

    try:
        new_id = query("""
            INSERT INTO bs_elective_groups (curriculum_id, semester, name, required_courses)
            VALUES (%s,%s,%s,%s)
        """, (cuid, sem, name, parse_int(data.get("requiredCourses"), 1)), commit=True)
        return jsonify({"success": True, "id": new_id}), 201
    except Exception as e:
        return json_error(f"Failed to create elective group: {e}", 500)


@bs_curriculum_bp.route("/api/bs/elective-groups/<int:egid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_elective_group(egid):
    guard = assert_in_context("bs_elective_groups", egid, "Elective group")
    if guard:
        return guard
    query("DELETE FROM bs_elective_groups WHERE id=%s", (egid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# BATCHES  (spec §5)
# ================================================================

@bs_curriculum_bp.route("/api/bs/batches", methods=["GET"])
@bs_read
def api_bs_batches():
    clause, params = ctx_clause("b")
    rows = query(f"""
        SELECT b.*, p.name AS program_name, cu.name AS curriculum_name,
               cu.version_year, s.name AS session_name,
               (SELECT COUNT(*) FROM students st WHERE st.bs_batch_id = b.id) AS student_count
        FROM   bs_batches b
        JOIN   bs_programs    p  ON p.id  = b.program_id
        JOIN   bs_curriculums cu ON cu.id = b.curriculum_id
        LEFT JOIN bs_academic_sessions s ON s.id = b.admission_session_id
        WHERE  {clause}
        ORDER  BY b.name DESC
    """, params)
    out = []
    for r in rows:
        d = safe_batch(r)
        d["curriculumVersion"] = r.get("version_year")
        out.append(d)
    return jsonify(out)


@bs_curriculum_bp.route("/api/bs/batches", methods=["POST"])
@bs_write()
def api_bs_add_batch():
    data = request.get_json(force=True, silent=True) or {}
    pid  = parse_int(data.get("programId"))
    cuid = parse_int(data.get("curriculumId"))
    name = clean(data.get("name"))
    if not pid:
        return json_error("Program is required")
    if not cuid:
        return json_error("Curriculum version is required")
    if not name:
        return json_error("Batch name is required (e.g. BSCS-2027)")

    for table, pk, label in [("bs_programs", pid, "Program"),
                             ("bs_curriculums", cuid, "Curriculum")]:
        guard = assert_in_context(table, pk, label)
        if guard:
            return guard

    # The curriculum must belong to the chosen program, or the batch would
    # follow a plan from another degree.
    cur = query("SELECT program_id FROM bs_curriculums WHERE id=%s", (cuid,), one=True)
    if cur["program_id"] != pid:
        return json_error("That curriculum version belongs to a different program", 400)

    sess_id = parse_int(data.get("admissionSessionId"))
    if sess_id:
        guard = assert_in_context("bs_academic_sessions", sess_id, "Session")
        if guard:
            return guard

    dept_id, campus_id, err = bs_write_context()
    if err:
        return err

    clause, params = ctx_clause()
    if query(f"SELECT id FROM bs_batches WHERE name=%s AND {clause}",
             [name] + params, one=True):
        return json_error(f"Batch '{name}' already exists", 409)

    try:
        new_id = query("""
            INSERT INTO bs_batches
                (program_id, curriculum_id, admission_session_id, name,
                 current_semester, status, department_id, campus_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (pid, cuid, sess_id, name, parse_int(data.get("currentSemester"), 1),
              clean(data.get("status")) or "active", dept_id, campus_id), commit=True)
        row = query("""
            SELECT b.*, p.name AS program_name, cu.name AS curriculum_name,
                   s.name AS session_name
            FROM bs_batches b
            JOIN bs_programs p ON p.id=b.program_id
            JOIN bs_curriculums cu ON cu.id=b.curriculum_id
            LEFT JOIN bs_academic_sessions s ON s.id=b.admission_session_id
            WHERE b.id=%s
        """, (new_id,), one=True)
        return jsonify({"success": True, "batch": safe_batch(row)}), 201
    except Exception as e:
        return json_error(f"Failed to create batch: {e}", 500)


@bs_curriculum_bp.route("/api/bs/batches/<int:bid>", methods=["PUT"])
@bs_write()
def api_bs_update_batch(bid):
    guard = assert_in_context("bs_batches", bid, "Batch")
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []
    for key, col in [("name", "name"), ("currentSemester", "current_semester"),
                     ("status", "status")]:
        if key in data:
            val = data[key]
            if isinstance(val, str):
                val = val.strip()
            sets.append(f"{col}=%s")
            args.append(val)

    # Re-pointing a batch at another curriculum version is allowed but
    # validated — it must stay inside the same program.
    if "curriculumId" in data:
        cuid = parse_int(data.get("curriculumId"))
        guard = assert_in_context("bs_curriculums", cuid, "Curriculum")
        if guard:
            return guard
        batch = query("SELECT program_id FROM bs_batches WHERE id=%s", (bid,), one=True)
        cur   = query("SELECT program_id FROM bs_curriculums WHERE id=%s", (cuid,), one=True)
        if cur["program_id"] != batch["program_id"]:
            return json_error("That curriculum version belongs to a different program", 400)
        sets.append("curriculum_id=%s")
        args.append(cuid)

    if sets:
        args.append(bid)
        try:
            query(f"UPDATE bs_batches SET {','.join(sets)} WHERE id=%s", args, commit=True)
        except Exception as e:
            return json_error(f"Failed to update batch: {e}", 500)

    row = query("""
        SELECT b.*, p.name AS program_name, cu.name AS curriculum_name,
               s.name AS session_name,
               (SELECT COUNT(*) FROM students st WHERE st.bs_batch_id=b.id) AS student_count
        FROM bs_batches b
        JOIN bs_programs p ON p.id=b.program_id
        JOIN bs_curriculums cu ON cu.id=b.curriculum_id
        LEFT JOIN bs_academic_sessions s ON s.id=b.admission_session_id
        WHERE b.id=%s
    """, (bid,), one=True)
    return jsonify({"success": True, "batch": safe_batch(row)})


@bs_curriculum_bp.route("/api/bs/batches/<int:bid>", methods=["DELETE"])
@bs_write()
def api_bs_delete_batch(bid):
    guard = assert_in_context("bs_batches", bid, "Batch")
    if guard:
        return guard
    students = query("SELECT COUNT(*) AS n FROM students WHERE bs_batch_id=%s",
                     (bid,), one=True)["n"]
    if students:
        return json_error(
            f"{students} student(s) belong to this batch. Move them first, or set the "
            "batch inactive.", 409)
    query("DELETE FROM bs_batches WHERE id=%s", (bid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# PEOPLE PICKERS  (read-only lookups the enrollment / assignment UI needs)
# ================================================================

@bs_curriculum_bp.route("/api/bs/students", methods=["GET"])
@bs_read
def api_bs_students():
    """
    BS students with their batch / curriculum linkage.

    ``?batch_id=`` narrows to one batch, ``?search=`` matches name or roll
    number, and ``?not_in_offering=`` drops anyone already enrolled in ANY
    section of that offering — the list an enrollment picker actually wants,
    since a student may only sit in one section of a course (spec §42.9).
    """
    clause, params = ctx_clause("s")
    sql = f"""
        SELECT s.id, s.name, s.roll_no, s.bs_batch_id, s.bs_program_id,
               s.bs_curriculum_id, s.bs_current_semester, s.status,
               b.name AS batch_name, p.name AS program_name
        FROM   students s
        LEFT JOIN bs_batches  b ON b.id = s.bs_batch_id
        LEFT JOIN bs_programs p ON p.id = COALESCE(s.bs_program_id, b.program_id)
        WHERE  {clause}
    """
    args = list(params)

    bid = parse_int(request.args.get("batch_id"))
    if bid:
        sql += " AND s.bs_batch_id=%s"
        args.append(bid)

    search = clean(request.args.get("search"))
    if search:
        sql += " AND (LOWER(s.name) LIKE %s OR LOWER(s.roll_no) LIKE %s)"
        args += [f"%{search.lower()}%", f"%{search.lower()}%"]

    oid = parse_int(request.args.get("not_in_offering"))
    if oid:
        sql += """ AND s.id NOT IN (
            SELECT en.student_id FROM bs_enrollments en
            JOIN bs_offering_sections os ON os.id = en.offering_section_id
            WHERE os.offering_id=%s)"""
        args.append(oid)

    sql += " ORDER BY s.roll_no, s.name"
    return jsonify([{
        "id":              r["id"],
        "name":            r["name"],
        "rollNo":          r["roll_no"] or "",
        "batchId":         r["bs_batch_id"],
        "batchName":       r["batch_name"] or "",
        "programId":       r["bs_program_id"],
        "programName":     r["program_name"] or "",
        "curriculumId":    r["bs_curriculum_id"],
        "currentSemester": r["bs_current_semester"],
        "status":          r["status"] or "active",
    } for r in query(sql, args)])


@bs_curriculum_bp.route("/api/bs/teachers", methods=["GET"])
@bs_read
def api_bs_teachers():
    """BS teachers plus how many sections each already carries (spec §17)."""
    clause, params = ctx_clause("t")
    rows = query(f"""
        SELECT t.id, t.name, t.designation, t.qualification, t.status,
               (SELECT COUNT(*) FROM bs_teaching_assignments ta
                 WHERE ta.teacher_id = t.id) AS section_count
        FROM   teachers t
        WHERE  {clause}
        ORDER  BY t.name
    """, params)
    return jsonify([{
        "id":            r["id"],
        "name":          r["name"],
        "designation":   r["designation"] or "",
        "qualification": r["qualification"] or "",
        "status":        r["status"] or "active",
        "sectionCount":  r["section_count"],
    } for r in rows])


# ================================================================
# OVERVIEW  (dashboard counters, spec §26)
# ================================================================

@bs_curriculum_bp.route("/api/bs/overview", methods=["GET"])
@bs_read
def api_bs_overview():
    clause, params = ctx_clause()

    def count(table, extra=""):
        return query(f"SELECT COUNT(*) AS n FROM {table} WHERE {clause}{extra}",
                     params, one=True)["n"]

    active = query(f"""
        SELECT * FROM bs_academic_sessions
        WHERE {clause} AND status='active'
        ORDER BY start_date DESC LIMIT 1
    """, params, one=True)

    stats = {
        "programs":    count("bs_programs"),
        "courses":     count("bs_courses"),
        "curriculums": count("bs_curriculums"),
        "batches":     count("bs_batches"),
        "sessions":    count("bs_academic_sessions"),
        "offerings":   count("bs_course_offerings"),
        "students":    count("students"),
        "teachers":    count("teachers"),
        "activeSession": safe_session(active) if active else None,
    }

    if active:
        o_clause, o_params = ctx_clause("o")
        stats["activeSessionStats"] = query(f"""
            SELECT COUNT(DISTINCT o.id)  AS offerings,
                   COUNT(DISTINCT os.id) AS sections,
                   COUNT(DISTINCT en.id) AS enrollments,
                   COUNT(DISTINCT ta.id) AS assignments
            FROM   bs_course_offerings o
            LEFT JOIN bs_offering_sections    os ON os.offering_id = o.id
            LEFT JOIN bs_enrollments          en ON en.offering_section_id = os.id
            LEFT JOIN bs_teaching_assignments ta ON ta.offering_section_id = os.id
            WHERE  o.session_id=%s AND {o_clause}
        """, [active["id"]] + o_params, one=True)

    return jsonify(stats)