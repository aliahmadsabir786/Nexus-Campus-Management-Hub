"""
routes/assignments.py  —  Assignments, Submissions, Timetable, Portals
  GET/POST  /api/assignments
  POST      /api/assignments/<aid>/submit
  GET       /api/assignments/<aid>/submissions
  POST      /api/submissions/<sub_id>/grade
  GET/POST  /api/timetable/<tid>
  POST      /api/portal/student/<sid>
  POST      /api/portal/teacher/<tid>

Institution isolation (spec §11):
  - assignments own department_id / campus_id (they are not reliably tied to a
    context-bearing row, see migration 001).
  - submissions inherit context through assignment_id.
  - timetables inherit context through teacher_id.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from db import query
from config import SUBJECTS
from utils.auth import admin_required, ts
from utils.context import (
    apply_ctx,
    assert_class_in_context,
    assert_in_context,
    assert_student_in_context,
    assert_teacher_in_context,
    in_context,
    write_context,
)
from utils.teacher_access import (
    get_teacher_assignments,
    get_assigned_students,
    assert_student_access,
    verify_assignment_combo,
)

assignments_bp = Blueprint("assignments", __name__)


# ================================================================
# ASSIGNMENTS
# ================================================================
@assignments_bp.route("/api/assignments", methods=["GET"])
@login_required
def api_get_assignments():
    cls        = request.args.get("cls", "")
    sub        = request.args.get("subject", "")
    class_id   = request.args.get("class_id") or request.args.get("classId")
    section_id = request.args.get("section_id") or request.args.get("sectionId")
    sql  = "SELECT * FROM assignments WHERE 1=1"
    args = []

    if current_user.role == "student":
        s = query("SELECT cls FROM students WHERE id=%s", (current_user.id,), one=True)
        if s:
            sql += " AND cls=%s"; args.append(s["cls"])

    elif current_user.role == "teacher":
        # Restrict teacher to only their assigned subjects
        assignments = get_teacher_assignments(current_user.id)
        assigned_subjects = list({a["subject_id"] for a in assignments})
        if not assigned_subjects:
            return jsonify([])
        ph = ",".join(["%s"] * len(assigned_subjects))
        sql  += f" AND (teacher_id=%s OR subject IN ({ph}))"
        args += [current_user.id] + assigned_subjects

    if cls: sql += " AND cls=%s";     args.append(cls)
    if sub: sql += " AND subject=%s"; args.append(sub)

    # Institution filter last, so no crafted cls/subject value can bypass it.
    sql, args = apply_ctx(sql, args)

    rows = query(sql, args)
    return jsonify([{
        **r,
        "dueDate":   str(r.get("due_date", "")),
        "createdAt": str(r.get("created_date", "")),
        "class_id":  r.get("class_id"),
        "classId":   r.get("class_id"),
    } for r in rows])


@assignments_bp.route("/api/assignments", methods=["POST"])
@login_required
def api_create_assignment():
    if current_user.role == "student":
        return jsonify({"error": "Students cannot create assignments"}), 403

    data  = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400

    subject = data.get("subject", SUBJECTS[0])

    # Teacher: validate subject is assigned to them
    if current_user.role == "teacher":
        assignments = get_teacher_assignments(current_user.id)
        assigned_subjects = {a["subject_id"] for a in assignments}
        if subject not in assigned_subjects:
            return jsonify({
                "error": f"Access denied: subject '{subject}' is not assigned to you"
            }), 403

    t   = query("SELECT name FROM teachers WHERE id=%s", (current_user.id,), one=True)
    aid = "A" + str(ts())
    class_id = data.get("class_id") or None
    try:
        class_id = int(class_id) if class_id else None
    except (TypeError, ValueError):
        class_id = None

    dept_id, campus_id = write_context()
    if not dept_id:
        return jsonify({"error": "No institution context — please sign in again"}), 403

    # A class from another campus may not be attached to this assignment.
    if class_id:
        guard = assert_class_in_context(class_id)
        if guard:
            return guard

    query(
        """INSERT INTO assignments
           (id,title,subject,cls,class_id,teacher_id,teacher_name,due_date,description,
            department_id,campus_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (aid, title,
         subject,
         data.get("cls", "CS-A"),
         class_id,
         current_user.id,
         t["name"] if t else "Admin",
         data.get("dueDate") or None,
         data.get("description", ""),
         dept_id, campus_id),
        commit=True
    )
    return jsonify({"success": True, "assignment": {"id": aid, "title": title}}), 201


# ================================================================
# SUBMISSIONS
# ================================================================
@assignments_bp.route("/api/assignments/<aid>/submit", methods=["POST"])
@login_required
def api_submit_assignment(aid):
    if current_user.role != "student":
        return jsonify({"error": "Only students can submit"}), 403

    guard = assert_in_context("assignments", aid, "Assignment")
    if guard:
        return guard

    s      = query("SELECT * FROM students WHERE id=%s", (current_user.id,), one=True)
    data   = request.get_json() or {}
    sub_id = "SUB" + str(ts())

    query(
        """INSERT INTO submissions
           (id,assignment_id,student_id,student_name,cls,file_name,file_data)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (sub_id, aid, current_user.id,
         s["name"] if s else current_user.name,
         s["cls"]  if s else "",
         data.get("fileName", "file"),
         data.get("fileData", "")),
        commit=True
    )
    return jsonify({"success": True}), 201


@assignments_bp.route("/api/assignments/<aid>/submissions", methods=["GET"])
@login_required
def api_get_submissions(aid):
    # Submissions inherit their context from the parent assignment.
    guard = assert_in_context("assignments", aid, "Assignment")
    if guard:
        return guard
    rows = query("SELECT * FROM submissions WHERE assignment_id=%s", (aid,))
    return jsonify([{**r, "submittedAt": str(r.get("submitted_date", ""))} for r in rows])


@assignments_bp.route("/api/submissions/<sub_id>/grade", methods=["POST"])
@login_required
def api_grade_submission(sub_id):
    if current_user.role == "student":
        return jsonify({"error": "Students cannot grade"}), 403

    sub = query("SELECT * FROM submissions WHERE id=%s", (sub_id,), one=True)
    if not sub:
        return jsonify({"error": "Submission not found"}), 404

    # Reported as "not found" (never 403) so submission IDs belonging to another
    # campus cannot be probed.
    if in_context("assignments", sub["assignment_id"]) is not True:
        return jsonify({"error": "Submission not found"}), 404

    # Teacher: validate the submitting student is in their assignment.
    # assert_student_access() also re-checks institution context for every role.
    err = assert_student_access(sub["student_id"])
    if err:
        return err

    data  = request.get_json() or {}
    grade = int(data.get("grade", 0))
    if not 0 <= grade <= 100:
        return jsonify({"error": "Grade must be 0-100"}), 400

    query(
        "UPDATE submissions SET grade=%s,feedback=%s,status='graded' WHERE id=%s",
        (grade, data.get("feedback", ""), sub_id), commit=True
    )
    return jsonify({"success": True})


# ================================================================
# TIMETABLE
# ================================================================
@assignments_bp.route("/api/timetable/<tid>", methods=["GET"])
@login_required
def api_get_timetable(tid):
    # Timetables hang off a teacher, so the teacher's context gates them.
    guard = assert_teacher_in_context(tid)
    if guard:
        return guard
    tt = query("SELECT * FROM timetables WHERE teacher_id=%s", (tid,), one=True)
    if not tt:
        return jsonify({"error": "No timetable uploaded"}), 404
    return jsonify({**tt, "uploadedAt": str(tt.get("uploaded_date", ""))})


@assignments_bp.route("/api/timetable/<tid>", methods=["POST"])
@login_required
def api_upload_timetable(tid):
    if current_user.role == "teacher" and current_user.id != tid:
        return jsonify({"error": "Cannot upload for another teacher"}), 403

    guard = assert_teacher_in_context(tid)
    if guard:
        return guard

    data = request.get_json() or {}
    query(
        """INSERT INTO timetables (teacher_id,name,data) VALUES (%s,%s,%s)
           ON DUPLICATE KEY UPDATE name=%s,data=%s,uploaded_date=CURDATE()""",
        (tid, data.get("name", "timetable"), data.get("data", ""),
              data.get("name", "timetable"), data.get("data", "")),
        commit=True
    )
    return jsonify({"success": True})


# ================================================================
# PORTAL ACCESS
# ================================================================
@assignments_bp.route("/api/portal/student/<sid>", methods=["POST"])
@admin_required
def api_toggle_student_portal(sid):
    guard = assert_student_in_context(sid)
    if guard:
        return guard
    s = query("SELECT portal FROM students WHERE id=%s", (sid,), one=True)
    if not s:
        return jsonify({"error": "Student not found"}), 404
    new_p = "inactive" if s["portal"] == "active" else "active"
    query("UPDATE students SET portal=%s WHERE id=%s", (new_p, sid), commit=True)
    return jsonify({"success": True, "portal": new_p})


@assignments_bp.route("/api/portal/teacher/<tid>", methods=["POST"])
@admin_required
def api_toggle_teacher_portal(tid):
    guard = assert_teacher_in_context(tid)
    if guard:
        return guard
    t = query("SELECT portal FROM teachers WHERE id=%s", (tid,), one=True)
    if not t:
        return jsonify({"error": "Teacher not found"}), 404
    new_p = "inactive" if t["portal"] == "active" else "active"
    query("UPDATE teachers SET portal=%s WHERE id=%s", (new_p, tid), commit=True)
    return jsonify({"success": True, "portal": new_p})
