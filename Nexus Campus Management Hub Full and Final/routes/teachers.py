"""
routes/teachers.py  —  Teacher CRUD routes + Assignment Mapping
  GET    /api/teachers
  GET    /api/teachers/<tid>
  POST   /api/teachers
  PUT    /api/teachers/<tid>
  DELETE /api/teachers/<tid>

  -- Teacher Assignment Mapping (admin only) --
  GET    /api/teacher-assignments                      list all
  GET    /api/teacher-assignments/<tid>                by teacher
  POST   /api/teacher-assignments                      add row
  DELETE /api/teacher-assignments/<int:aid>            remove row

  -- Teacher's own assignment summary (teacher self) --
  GET    /api/teacher-assignments/me                   current teacher's assignments
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash

from db import query
from config import SUBJECTS, TODAY
from utils.auth import perm_required, admin_required, next_id, safe_teacher
from utils.teacher_access import get_teacher_assignments, teacher_self_or_admin
from routes.students import validate_photo          # reuse the shared validator

teachers_bp = Blueprint("teachers", __name__)


@teachers_bp.route("/api/teachers", methods=["GET"])
@login_required
def api_get_teachers():
    search = request.args.get("search", "").lower()
    sql    = "SELECT * FROM teachers WHERE 1=1"
    args   = []
    if search:
        sql  += " AND (LOWER(name) LIKE %s OR LOWER(id) LIKE %s)"
        args += [f"%{search}%", f"%{search}%"]
    return jsonify([safe_teacher(t) for t in query(sql, args)])


@teachers_bp.route("/api/teachers/<tid>", methods=["GET"])
@login_required
def api_get_teacher(tid):
    t = query("SELECT * FROM teachers WHERE id=%s", (tid,), one=True)
    if not t:
        return jsonify({"error": "Teacher not found"}), 404
    return jsonify(safe_teacher(t))


@teachers_bp.route("/api/teachers", methods=["POST"])
@perm_required("teachers")
def api_add_teacher():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON body"}), 400

    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400

    # Validate photo before touching the database
    photo, photo_err = validate_photo(data.get("photo"))
    if photo_err:
        return jsonify({"error": photo_err}), 400

    cnt    = len(query("SELECT id FROM teachers"))
    new_id = next_id("teachers", "T")
    auto   = f"teach{cnt + 1}"

    # Validate class_id / section_id (optional, must be integers or None)
    raw_class_id   = data.get("class_id") or data.get("classId")
    raw_section_id = data.get("section_id") or data.get("sectionId")
    try:
        class_id   = int(raw_class_id)   if raw_class_id   else None
        section_id = int(raw_section_id) if raw_section_id else None
    except (TypeError, ValueError):
        return jsonify({"error": "class_id and section_id must be integers"}), 400

    try:
        query(
            """INSERT INTO teachers
               (id,name,subject,dept,qualification,phone,email,join_date,password_hash,portal,photo,class_id,section_id)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,%s)""",
            (new_id, name,
             data.get("subject", SUBJECTS[0]),
             data.get("dept", ""),
             data.get("qualification", ""),
             data.get("phone", ""),
             data.get("email", ""),
             TODAY,
             generate_password_hash(auto),
             photo,
             class_id,
             section_id),
            commit=True
        )
    except Exception as e:
        return jsonify({"error": f"Failed to save teacher: {str(e)}"}), 500

    return jsonify({"success": True, "id": new_id, "plainPassword": auto}), 201


@teachers_bp.route("/api/teachers/<tid>", methods=["PUT"])
@perm_required("teachers")
def api_edit_teacher(tid):
    t = query("SELECT id FROM teachers WHERE id=%s", (tid,), one=True)
    if not t:
        return jsonify({"error": "Teacher not found"}), 404

    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON body"}), 400

    # Validate photo if one is being updated
    if "photo" in data and data["photo"] is not None:
        photo, photo_err = validate_photo(data["photo"])
        if photo_err:
            return jsonify({"error": photo_err}), 400
        data["photo"] = photo

    fields = {
        "name": "name", "subject": "subject", "dept": "dept",
        "qualification": "qualification", "phone": "phone",
        "email": "email", "portal": "portal", "photo": "photo"
    }
    sets, args = [], []
    for jk, dc in fields.items():
        if jk in data:
            sets.append(f"{dc}=%s"); args.append(data[jk])

    # Handle class_id update (accepts both snake_case and camelCase)
    raw_class_id = data.get("class_id") if "class_id" in data else data.get("classId")
    if raw_class_id is not None or "class_id" in data or "classId" in data:
        if "class_id" in data or "classId" in data:
            raw = data.get("class_id") or data.get("classId")
            try:
                class_val = int(raw) if raw else None
            except (TypeError, ValueError):
                return jsonify({"error": "class_id must be an integer"}), 400
            sets.append("class_id=%s"); args.append(class_val)

    # Handle section_id update
    if "section_id" in data or "sectionId" in data:
        raw = data.get("section_id") or data.get("sectionId")
        try:
            section_val = int(raw) if raw else None
        except (TypeError, ValueError):
            return jsonify({"error": "section_id must be an integer"}), 400
        sets.append("section_id=%s"); args.append(section_val)

    if data.get("password"):
        sets.append("password_hash=%s")
        args.append(generate_password_hash(data["password"]))

    if sets:
        try:
            args.append(tid)
            query(f"UPDATE teachers SET {','.join(sets)} WHERE id=%s", args, commit=True)
        except Exception as e:
            return jsonify({"error": f"Failed to update teacher: {str(e)}"}), 500

    return jsonify({
        "success": True,
        "teacher": safe_teacher(query("SELECT * FROM teachers WHERE id=%s", (tid,), one=True))
    })


@teachers_bp.route("/api/teachers/<tid>", methods=["DELETE"])
@perm_required("teachers")
def api_delete_teacher(tid):
    t = query("SELECT id FROM teachers WHERE id=%s", (tid,), one=True)
    if not t:
        return jsonify({"error": "Teacher not found"}), 404
    query("DELETE FROM teachers WHERE id=%s", (tid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# TEACHER ASSIGNMENT MAPPING  (new section — do NOT touch above)
# ================================================================

@teachers_bp.route("/api/teacher-assignments", methods=["GET"])
@login_required
def api_get_all_teacher_assignments():
    """Admin: list every assignment row. Teacher: see own rows only."""
    if current_user.role == "teacher":
        rows = get_teacher_assignments(current_user.id)
    else:
        rows = query(
            "SELECT ta.*, t.name AS teacher_name, c.name AS class_name, "
            "       s.name AS section_name "
            "FROM teacher_assignments ta "
            "JOIN teachers t ON ta.teacher_id=t.id "
            "JOIN classes  c ON ta.class_id=c.id "
            "JOIN sections s ON ta.section_id=s.id "
            "ORDER BY ta.teacher_id, ta.class_id, ta.section_id"
        )
    return jsonify(list(rows))


@teachers_bp.route("/api/teacher-assignments/me", methods=["GET"])
@login_required
def api_my_assignments():
    """Current teacher fetches their own assignment summary."""
    if current_user.role != "teacher":
        return jsonify({"error": "Only teachers can use this endpoint"}), 403
    rows = query(
        "SELECT ta.*, c.name AS class_name, s.name AS section_name "
        "FROM teacher_assignments ta "
        "JOIN classes  c ON ta.class_id=c.id "
        "JOIN sections s ON ta.section_id=s.id "
        "WHERE ta.teacher_id=%s "
        "ORDER BY ta.class_id, ta.section_id",
        (current_user.id,)
    )
    return jsonify(list(rows))


@teachers_bp.route("/api/teacher-assignments/<tid>", methods=["GET"])
@login_required
@teacher_self_or_admin
def api_get_teacher_assignments_by_id(tid):
    """Fetch assignment rows for a specific teacher (self or admin)."""
    t = query("SELECT id FROM teachers WHERE id=%s", (tid,), one=True)
    if not t:
        return jsonify({"error": "Teacher not found"}), 404
    rows = query(
        "SELECT ta.*, c.name AS class_name, s.name AS section_name "
        "FROM teacher_assignments ta "
        "JOIN classes  c ON ta.class_id=c.id "
        "JOIN sections s ON ta.section_id=s.id "
        "WHERE ta.teacher_id=%s "
        "ORDER BY ta.class_id, ta.section_id",
        (tid,)
    )
    return jsonify(list(rows))


@teachers_bp.route("/api/teacher-assignments", methods=["POST"])
@perm_required("teachers")
def api_add_teacher_assignment():
    """
    Admin: assign a teacher to (class_id, section_id, subject_id).
    Body: { teacher_id, class_id, section_id, subject_id }
    """
    data = request.get_json(force=True, silent=True) or {}
    tid  = data.get("teacher_id", "").strip()
    try:
        class_id   = int(data.get("class_id"))
        section_id = int(data.get("section_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "class_id and section_id must be integers"}), 400

    subject_id = (data.get("subject_id") or data.get("subject", "")).strip()

    if not tid or not class_id or not section_id or not subject_id:
        return jsonify({"error": "teacher_id, class_id, section_id, subject_id required"}), 400

    if not query("SELECT id FROM teachers WHERE id=%s", (tid,), one=True):
        return jsonify({"error": "Teacher not found"}), 404
    if not query("SELECT id FROM classes WHERE id=%s", (class_id,), one=True):
        return jsonify({"error": "Class not found"}), 404
    if not query("SELECT id FROM sections WHERE id=%s AND class_id=%s", (section_id, class_id), one=True):
        return jsonify({"error": "Section not found or does not belong to class"}), 404

    try:
        query(
            "INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject_id) "
            "VALUES (%s,%s,%s,%s)",
            (tid, class_id, section_id, subject_id),
            commit=True
        )
    except Exception as e:
        if "Duplicate" in str(e):
            return jsonify({"error": "Assignment already exists"}), 409
        return jsonify({"error": f"DB error: {e}"}), 500

    row = query(
        "SELECT * FROM teacher_assignments "
        "WHERE teacher_id=%s AND class_id=%s AND section_id=%s AND subject_id=%s",
        (tid, class_id, section_id, subject_id), one=True
    )
    return jsonify({"success": True, "assignment": dict(row)}), 201


@teachers_bp.route("/api/teacher-assignments/<int:aid>", methods=["DELETE"])
@perm_required("teachers")
def api_delete_teacher_assignment(aid):
    """Admin: remove an assignment row by its PK."""
    row = query("SELECT id FROM teacher_assignments WHERE id=%s", (aid,), one=True)
    if not row:
        return jsonify({"error": "Assignment not found"}), 404
    query("DELETE FROM teacher_assignments WHERE id=%s", (aid,), commit=True)
    return jsonify({"success": True})
