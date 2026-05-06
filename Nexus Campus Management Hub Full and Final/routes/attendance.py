"""
routes/attendance.py  —  Attendance routes (enhanced with teacher access control)
  GET  /api/teacher/<tid>/students   — students visible to teacher (scoped by assignment)
  GET  /api/attendance               — get attendance (teacher sees only assigned students)
  POST /api/attendance               — mark/update attendance (assignment-validated)
  GET  /api/attendance/student/<sid> — student's full attendance record

Access control (teacher role):
  - GET  requests filter results to teacher's assigned (class_id, section_id) pairs.
  - POST requests validate that the target student / bulk group is within assignment.
  - Admins bypass all assignment checks.
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from db import query
from config import TODAY
from utils.auth import perm_required, safe_student
from utils.teacher_access import (
    get_teacher_assignments,
    get_assigned_students,
    assert_student_access,
)

attendance_bp = Blueprint("attendance", __name__)


def _is_teacher():
    return hasattr(current_user, "role") and current_user.role == "teacher"

def _is_admin():
    return hasattr(current_user, "role") and current_user.role == "admin"


def _attach_attendance(student_rows, date_str):
    result = []
    for s in student_rows:
        att = query(
            "SELECT status FROM attendance WHERE student_id=%s AND date=%s",
            (s["id"], date_str), one=True
        )
        result.append({
            **safe_student(s),
            "attendanceStatus": att["status"] if att else "absent"
        })
    return result


# ================================================================
# TEACHER STUDENT LIST (scoped)
# ================================================================

@attendance_bp.route("/api/teacher/<tid>/students", methods=["GET"])
@login_required
def api_teacher_students(tid):
    if _is_teacher() and current_user.id != tid:
        return jsonify({"error": "Access denied: you can only query your own students"}), 403

    t = query("SELECT * FROM teachers WHERE id=%s", (tid,), one=True)
    if not t:
        return jsonify({"error": "Teacher not found"}), 404

    date_str   = request.args.get("date", TODAY)
    class_id   = request.args.get("class_id") or request.args.get("classId")
    section_id = request.args.get("section_id") or request.args.get("sectionId")
    subject_id = request.args.get("subject_id") or request.args.get("subject")

    if _is_admin():
        sql  = "SELECT * FROM students WHERE 1=1"
        args = []
        if class_id:   sql += " AND class_id=%s";   args.append(class_id)
        if section_id: sql += " AND section_id=%s"; args.append(section_id)
        sql += " ORDER BY roll_no"
        rows = query(sql, args)
    else:
        try:
            class_id_int   = int(class_id)   if class_id   else None
            section_id_int = int(section_id) if section_id else None
        except (TypeError, ValueError):
            return jsonify({"error": "class_id and section_id must be integers"}), 400

        rows = get_assigned_students(
            tid,
            class_id=class_id_int,
            section_id=section_id_int,
            subject_id=subject_id or None,
        )

    return jsonify(_attach_attendance(rows, date_str))


# ================================================================
# GET ATTENDANCE
# ================================================================

@attendance_bp.route("/api/attendance", methods=["GET"])
@login_required
def api_get_attendance():
    cls        = request.args.get("cls", "")
    date_str   = request.args.get("date", TODAY)
    class_id   = request.args.get("class_id") or request.args.get("classId")
    section_id = request.args.get("section_id") or request.args.get("sectionId")

    if _is_teacher():
        try:
            class_id_int   = int(class_id)   if class_id   else None
            section_id_int = int(section_id) if section_id else None
        except (TypeError, ValueError):
            return jsonify({"error": "class_id and section_id must be integers"}), 400

        rows = get_assigned_students(
            current_user.id,
            class_id=class_id_int,
            section_id=section_id_int,
        )
    else:
        sql  = "SELECT * FROM students WHERE 1=1"
        args = []
        if cls:        sql += " AND cls=%s";        args.append(cls)
        if class_id:   sql += " AND class_id=%s";   args.append(class_id)
        if section_id: sql += " AND section_id=%s"; args.append(section_id)
        rows = query(sql, args)

    result = []
    for s in rows:
        att = query(
            "SELECT status FROM attendance WHERE student_id=%s AND date=%s",
            (s["id"], date_str), one=True
        )
        result.append({
            "id":        s["id"],       "name":      s["name"],
            "rollNo":    s["roll_no"],  "cls":       s["cls"],
            "classId":   s.get("class_id"),
            "sectionId": s.get("section_id"),
            "status": att["status"] if att else "absent"
        })
    return jsonify(result)


# ================================================================
# MARK / UPDATE ATTENDANCE
# ================================================================

@attendance_bp.route("/api/attendance", methods=["POST"])
@perm_required("attendance")
def api_mark_attendance():
    data   = request.get_json() or {}
    date_s = data.get("date", TODAY)
    status = data.get("status", "absent")

    if status not in ("present", "absent", "late"):
        return jsonify({"error": "Invalid status"}), 400

    def upsert(sid):
        query(
            """INSERT INTO attendance (student_id,date,status) VALUES (%s,%s,%s)
               ON DUPLICATE KEY UPDATE status=%s""",
            (sid, date_s, status, status), commit=True
        )

    if "studentId" in data:
        sid = data["studentId"]
        if _is_teacher():
            err = assert_student_access(sid)
            if err:
                return err
        upsert(sid)

    elif "sectionId" in data or "section_id" in data:
        sid_val = data.get("sectionId") or data.get("section_id")
        try:
            sid_int = int(sid_val)
        except (TypeError, ValueError):
            return jsonify({"error": "sectionId must be an integer"}), 400

        if _is_teacher():
            assignments = get_teacher_assignments(current_user.id)
            if sid_int not in {a["section_id"] for a in assignments}:
                return jsonify({"error": "Access denied: section not assigned to you"}), 403

        for s in query("SELECT id FROM students WHERE section_id=%s", (sid_int,)):
            upsert(s["id"])

    elif "class_id" in data or "classId" in data:
        # Bulk by class_id (DB foreign-key based) — more precise than cls string
        cid_val = data.get("class_id") or data.get("classId")
        sid_val = data.get("section_id") or data.get("sectionId")
        try:
            cid_int = int(cid_val)
        except (TypeError, ValueError):
            return jsonify({"error": "class_id must be an integer"}), 400

        if _is_teacher():
            assignments = get_teacher_assignments(current_user.id)
            allowed_sections = [a["section_id"] for a in assignments if a["class_id"] == cid_int]
            if not allowed_sections:
                return jsonify({"error": "Access denied: class not assigned to you"}), 403
            if sid_val:
                try:
                    sid_int = int(sid_val)
                except (TypeError, ValueError):
                    return jsonify({"error": "section_id must be an integer"}), 400
                if sid_int not in allowed_sections:
                    return jsonify({"error": "Access denied: section not in your assigned sections"}), 403
                pool = query("SELECT id FROM students WHERE class_id=%s AND section_id=%s", (cid_int, sid_int))
            else:
                ph = ",".join(["%s"] * len(allowed_sections))
                pool = query(f"SELECT id FROM students WHERE class_id=%s AND section_id IN ({ph})",
                             [cid_int] + allowed_sections)
        else:
            if sid_val:
                try:
                    sid_int = int(sid_val)
                except (TypeError, ValueError):
                    return jsonify({"error": "section_id must be an integer"}), 400
                pool = query("SELECT id FROM students WHERE class_id=%s AND section_id=%s", (cid_int, sid_int))
            else:
                pool = query("SELECT id FROM students WHERE class_id=%s", (cid_int,))
        for s in pool:
            upsert(s["id"])

    elif "cls" in data:
        if _is_teacher():
            assignments = get_teacher_assignments(current_user.id)
            allowed_sections = [a["section_id"] for a in assignments]
            if not allowed_sections:
                return jsonify({"error": "No assigned sections found"}), 403
            ph  = ",".join(["%s"] * len(allowed_sections))
            sql = f"SELECT id FROM students WHERE cls=%s AND section_id IN ({ph})"
            pool = query(sql, [data["cls"]] + allowed_sections)
        else:
            pool = query("SELECT id FROM students WHERE cls=%s", (data["cls"],))
        for s in pool:
            upsert(s["id"])

    elif "subjectBulk" in data:
        subj  = data.get("subjectBulk", "")
        cls_f = data.get("cls", "")

        if _is_teacher():
            assignments = get_teacher_assignments(current_user.id)
            if subj not in {a["subject_id"] for a in assignments}:
                return jsonify({"error": "Access denied: subject not assigned to you"}), 403
            allowed_sections = [a["section_id"] for a in assignments if a["subject_id"] == subj]
            ph  = ",".join(["%s"] * len(allowed_sections))
            sql = f"SELECT id FROM students WHERE section_id IN ({ph})"
            args = list(allowed_sections)
            if cls_f:
                sql += " AND cls=%s"; args.append(cls_f)
            pool = query(sql, args)
        else:
            from config import SUBJECT_TO_GROUPS, SUBJECT_GROUPS
            eligible_groups = SUBJECT_TO_GROUPS.get(subj, [])
            if not eligible_groups:
                eligible_groups = [g for g, subs in SUBJECT_GROUPS.items() if subj in subs]
            pool = []
            if eligible_groups:
                ph   = ",".join(["%s"] * len(eligible_groups))
                sql  = f"SELECT id FROM students WHERE subject_group IN ({ph})"
                args = list(eligible_groups)
                if cls_f:
                    sql += " AND cls=%s"; args.append(cls_f)
                pool = query(sql, args)
        for s in pool:
            upsert(s["id"])

    else:
        return jsonify({"error": "Provide studentId, sectionId, cls, or subjectBulk"}), 400

    return jsonify({"success": True})


# ================================================================
# STUDENT ATTENDANCE HISTORY
# ================================================================

@attendance_bp.route("/api/attendance/student/<sid>", methods=["GET"])
@login_required
def api_student_attendance(sid):
    if _is_teacher():
        err = assert_student_access(sid)
        if err:
            return err
    rows = query("SELECT date, status FROM attendance WHERE student_id=%s", (sid,))
    return jsonify({str(r["date"]): r["status"] for r in rows})
