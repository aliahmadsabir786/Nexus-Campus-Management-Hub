"""
routes/academics.py  —  Grades, Exams, Notices, Complaints
  GET/POST       /api/grades
  GET            /api/grades/<sid>
  GET/POST       /api/exams
  DELETE         /api/exams/<eid>
  GET/POST       /api/notices
  DELETE         /api/notices/<nid>
  GET/POST       /api/complaints
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from db import query
from config import SUBJECTS, TODAY
from utils.auth import perm_required, next_id, ts
from utils.teacher_access import (
    get_assigned_students,
    assert_student_access,
    get_teacher_assignments,
)

academics_bp = Blueprint("academics", __name__)


# ================================================================
# GRADES
# ================================================================
@academics_bp.route("/api/grades", methods=["GET"])
@login_required
def api_get_grades():
    cls        = request.args.get("cls", "")
    class_id   = request.args.get("class_id") or request.args.get("classId")
    section_id = request.args.get("section_id") or request.args.get("sectionId")
    subject_id = request.args.get("subject_id") or request.args.get("subject")

    if current_user.role == "teacher":
        # Scope to assigned students only
        try:
            class_id_int   = int(class_id)   if class_id   else None
            section_id_int = int(section_id) if section_id else None
        except (TypeError, ValueError):
            return jsonify({"error": "class_id and section_id must be integers"}), 400

        pool = get_assigned_students(
            current_user.id,
            class_id=class_id_int,
            section_id=section_id_int,
            subject_id=subject_id or None,
        )
    else:
        sql  = "SELECT * FROM students WHERE 1=1"
        args = []
        if cls:        sql += " AND cls=%s";        args.append(cls)
        if class_id:   sql += " AND class_id=%s";   args.append(class_id)
        if section_id: sql += " AND section_id=%s"; args.append(section_id)
        pool = query(sql, args)

    result = {}
    for s in pool:
        rows = query("SELECT * FROM grades WHERE student_id=%s", (s["id"],))
        result[s["id"]] = {
            r["subject"]: {
                "midterm":  r["midterm"],
                "final":    r["final_marks"],
                "internal": r["internal"],
                "total":    r["total"]
            } for r in rows
        }
    return jsonify(result)


@academics_bp.route("/api/grades/<sid>", methods=["GET"])
@login_required
def api_get_student_grades(sid):
    if current_user.role == "teacher":
        err = assert_student_access(sid)
        if err:
            return err
    rows = query("SELECT * FROM grades WHERE student_id=%s", (sid,))
    return jsonify({
        r["subject"]: {
            "midterm":  r["midterm"],
            "final":    r["final_marks"],
            "internal": r["internal"],
            "total":    r["total"]
        } for r in rows
    })


@academics_bp.route("/api/grades", methods=["POST"])
@perm_required("grades")
def api_update_grade():
    data = request.get_json() or {}
    sid  = data.get("studentId")
    sub  = data.get("subject")
    if not sid or not sub:
        return jsonify({"error": "studentId and subject required"}), 400

    # Teacher: validate the student is in an assigned class/section
    # AND the subject matches one of their assigned subjects
    if current_user.role == "teacher":
        err = assert_student_access(sid)
        if err:
            return err
        # Validate the subject is assigned to this teacher
        assignments = get_teacher_assignments(current_user.id)
        assigned_subjects = {a["subject_id"] for a in assignments}
        if sub not in assigned_subjects:
            return jsonify({
                "error": f"Access denied: subject '{sub}' is not assigned to you"
            }), 403

    mid  = int(data.get("midterm",  0))
    fin  = int(data.get("final",    0))
    intr = int(data.get("internal", 0))
    tot  = mid + fin + intr

    query(
        """INSERT INTO grades (student_id,subject,midterm,final_marks,internal,total)
           VALUES (%s,%s,%s,%s,%s,%s)
           ON DUPLICATE KEY UPDATE midterm=%s,final_marks=%s,internal=%s,total=%s""",
        (sid, sub, mid, fin, intr, tot, mid, fin, intr, tot),
        commit=True
    )
    return jsonify({"success": True, "grade": {
        "midterm": mid, "final": fin, "internal": intr, "total": tot
    }})


# ================================================================
# EXAMS
# ================================================================
@academics_bp.route("/api/exams", methods=["GET"])
@login_required
def api_get_exams():
    cls = request.args.get("cls", "")
    rows = query("SELECT * FROM exams WHERE cls=%s", (cls,)) if cls else query("SELECT * FROM exams")
    return jsonify([{**r, "date": str(r.get("exam_date", ""))} for r in rows])


@academics_bp.route("/api/exams", methods=["POST"])
@perm_required("exams")
def api_add_exam():
    data  = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400

    new_id = next_id("exams", "E")
    query(
        """INSERT INTO exams (id,title,subject,cls,exam_date,exam_time,duration,room,total_marks)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (new_id, title,
         data.get("subject", SUBJECTS[0]),
         data.get("cls", "CS-A"),
         data.get("date") or None,
         data.get("time", "09:00 AM"),
         data.get("duration", "3 hours"),
         data.get("room", ""),
         int(data.get("totalMarks", 100))),
        commit=True
    )
    return jsonify({"success": True, "exam": {"id": new_id, "title": title}}), 201


@academics_bp.route("/api/exams/<eid>", methods=["DELETE"])
@perm_required("exams")
def api_delete_exam(eid):
    e = query("SELECT id FROM exams WHERE id=%s", (eid,), one=True)
    if not e:
        return jsonify({"error": "Exam not found"}), 404
    query("DELETE FROM exams WHERE id=%s", (eid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# NOTICES
# ================================================================
@academics_bp.route("/api/notices", methods=["GET"])
@login_required
def api_get_notices():
    rows = query("SELECT * FROM notices ORDER BY created_date DESC")
    return jsonify([{**r, "date": str(r.get("created_date", ""))} for r in rows])


@academics_bp.route("/api/notices", methods=["POST"])
@perm_required("notices")
def api_add_notice():
    data  = request.get_json() or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400
    nid = ts()
    query(
        "INSERT INTO notices (id,title,type,author) VALUES (%s,%s,%s,%s)",
        (nid, title, data.get("type", "academic"), data.get("author", "Admin")),
        commit=True
    )
    return jsonify({"success": True, "notice": {"id": nid, "title": title}}), 201


@academics_bp.route("/api/notices/<int:nid>", methods=["DELETE"])
@perm_required("notices")
def api_delete_notice(nid):
    n = query("SELECT id FROM notices WHERE id=%s", (nid,), one=True)
    if not n:
        return jsonify({"error": "Notice not found"}), 404
    query("DELETE FROM notices WHERE id=%s", (nid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# COMPLAINTS
# ================================================================
@academics_bp.route("/api/complaints", methods=["GET"])
@login_required
def api_get_complaints():
    if current_user.role == "admin":
        rows = query("SELECT * FROM complaints ORDER BY created_date DESC")
    elif current_user.role == "teacher":
        rows = query("SELECT * FROM complaints WHERE teacher_id=%s", (current_user.id,))
    else:
        rows = query("SELECT * FROM complaints WHERE student_id=%s", (current_user.id,))
    return jsonify([{**r, "date": str(r.get("created_date", ""))} for r in rows])


@academics_bp.route("/api/complaints", methods=["POST"])
@login_required
def api_add_complaint():
    if current_user.role != "teacher":
        return jsonify({"error": "Only teachers can post complaints"}), 403

    data = request.get_json() or {}
    sid  = data.get("studentId", "")
    msg  = data.get("message", "").strip()
    if not sid or not msg:
        return jsonify({"error": "studentId and message required"}), 400

    s = query("SELECT * FROM students WHERE id=%s", (sid,), one=True)
    t = query("SELECT * FROM teachers WHERE id=%s", (current_user.id,), one=True)
    if not s:
        return jsonify({"error": "Student not found"}), 404

    cid = ts()
    query(
        """INSERT INTO complaints
           (id,student_id,student_name,guardian_phone,teacher_id,teacher_name,message)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (cid, s["id"], s["name"], s["guardian_phone"],
         current_user.id, t["name"] if t else "Teacher", msg),
        commit=True
    )
    return jsonify({"success": True}), 201
