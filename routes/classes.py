"""
routes/classes.py  —  NEXus Solution: Class Management Module
REST API for the Class -> Section -> Student hierarchy.

Endpoints:
  GET    /api/classes                    list all classes
  POST   /api/classes                    create class
  PUT    /api/classes/<cid>              update class
  DELETE /api/classes/<cid>             delete class (cascade)
  PATCH  /api/classes/<cid>/status      toggle active/inactive

  GET    /api/classes/<cid>/sections    list sections for a class
  POST   /api/classes/<cid>/sections    add section
  PUT    /api/sections/<sid>            update section
  DELETE /api/sections/<sid>            delete section (cascade)

  GET    /api/sections/<sid>/students   list students in section
  POST   /api/sections/<sid>/students   add student to section
  PUT    /api/class-students/<stid>     update class student
  DELETE /api/class-students/<stid>     delete class student

  GET    /api/classes/hierarchy         full nested tree
  GET    /api/classes/dropdown          lightweight list for dropdowns
  GET    /api/sections/dropdown         lightweight list for dropdowns
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required
from db import query
from utils.auth import perm_required
from utils.context import (
    assert_class_in_context,
    assert_in_context,
    assert_section_in_context,
    ctx_clause,
    write_context,
)

classes_bp = Blueprint("classes", __name__)


# ================================================================
# HELPERS
# ================================================================
def safe_class(row):
    return {
        "id":          row["id"],
        "name":        row["name"],
        "code":        row["code"],
        "description": row.get("description") or "",
        "status":      row["status"],
        "createdAt":   str(row.get("created_at", "")),
    }


def safe_section(row):
    return {
        "id":        row["id"],
        "classId":   row["class_id"],
        "name":      row["name"],
        "capacity":  row.get("capacity") or 40,
        "room":      row.get("room") or "",
        "createdAt": str(row.get("created_at", "")),
    }


def safe_class_student(row):
    return {
        "id":        row["id"],
        "sectionId": row["section_id"],
        "name":      row["name"],
        "rollNo":    row["roll_no"],
        "email":     row.get("email") or "",
        "phone":     row.get("phone") or "",
        "status":    row.get("status") or "active",
        "createdAt": str(row.get("created_at", "")),
    }


# ================================================================
# CLASSES — CRUD
# ================================================================

@classes_bp.route("/api/classes", methods=["GET"])
@login_required
def api_get_classes():
    clause, params = ctx_clause("c")
    rows = query(f"""
        SELECT c.*,
               COUNT(DISTINCT s.id)   AS section_count,
               COUNT(DISTINCT cs.id)  AS student_count
        FROM   classes c
        LEFT JOIN sections s  ON s.class_id  = c.id
        LEFT JOIN class_students cs ON cs.section_id = s.id
        WHERE  {clause}
        GROUP BY c.id
        ORDER BY c.name
    """, params)
    result = []
    for r in rows:
        d = safe_class(r)
        d["sectionCount"] = r["section_count"]
        d["studentCount"]  = r["student_count"]
        result.append(d)
    return jsonify(result)


@classes_bp.route("/api/classes", methods=["POST"])
@perm_required("classes")
def api_add_class():
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name", "").strip()
    code = data.get("code", "").strip().upper()

    if not name:
        return jsonify({"error": "Class name is required"}), 400
    if not code:
        return jsonify({"error": "Class code is required"}), 400

    dept_id, campus_id = write_context()
    if not dept_id:
        return jsonify({"error": "No institution context — please sign in again"}), 403

    # Uniqueness is per institution, not global: Boys and Girls may each own
    # a class called "FSc Pre-Medical" (see migration 001, uq_class_*_ctx).
    clause, params = ctx_clause()
    if query(f"SELECT id FROM classes WHERE name=%s AND {clause}", [name] + params, one=True):
        return jsonify({"error": "A class with this name already exists"}), 409
    if query(f"SELECT id FROM classes WHERE code=%s AND {clause}", [code] + params, one=True):
        return jsonify({"error": "A class with this code already exists"}), 409

    try:
        query(
            "INSERT INTO classes (name, code, description, status, department_id, campus_id) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (name, code, data.get("description", ""), data.get("status", "active"),
             dept_id, campus_id),
            commit=True,
        )
        new = query(f"SELECT * FROM classes WHERE code=%s AND {clause}",
                    [code] + params, one=True)
        return jsonify({"success": True, "class": safe_class(new)}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create class: {str(e)}"}), 500


@classes_bp.route("/api/classes/<int:cid>", methods=["PUT"])
@perm_required("classes")
def api_update_class(cid):
    guard = assert_class_in_context(cid)
    if guard:
        return guard
    cls = query("SELECT * FROM classes WHERE id=%s", (cid,), one=True)

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []

    for field, col in [("name","name"),("code","code"),("description","description"),("status","status")]:
        if field in data:
            val = data[field].strip() if isinstance(data[field], str) else data[field]
            if field == "code":
                val = val.upper()
            sets.append(f"{col}=%s")
            args.append(val)

    if not sets:
        return jsonify({"success": True, "class": safe_class(cls)})

    try:
        args.append(cid)
        query(f"UPDATE classes SET {','.join(sets)} WHERE id=%s", args, commit=True)
        updated = query("SELECT * FROM classes WHERE id=%s", (cid,), one=True)
        return jsonify({"success": True, "class": safe_class(updated)})
    except Exception as e:
        return jsonify({"error": f"Failed to update class: {str(e)}"}), 500


@classes_bp.route("/api/classes/<int:cid>", methods=["DELETE"])
@perm_required("classes")
def api_delete_class(cid):
    guard = assert_class_in_context(cid)
    if guard:
        return guard
    query("DELETE FROM classes WHERE id=%s", (cid,), commit=True)
    return jsonify({"success": True})


@classes_bp.route("/api/classes/<int:cid>/status", methods=["PATCH"])
@perm_required("classes")
def api_toggle_class_status(cid):
    guard = assert_class_in_context(cid)
    if guard:
        return guard
    cls = query("SELECT * FROM classes WHERE id=%s", (cid,), one=True)
    new_status = "inactive" if cls["status"] == "active" else "active"
    query("UPDATE classes SET status=%s WHERE id=%s", (new_status, cid), commit=True)
    return jsonify({"success": True, "status": new_status})


# ================================================================
# SECTIONS — CRUD
# ================================================================

@classes_bp.route("/api/classes/<int:cid>/sections", methods=["GET"])
@login_required
def api_get_sections(cid):
    guard = assert_class_in_context(cid)
    if guard:
        return guard

    rows = query("""
        SELECT s.*, COUNT(cs.id) AS student_count
        FROM   sections s
        LEFT JOIN class_students cs ON cs.section_id = s.id
        WHERE  s.class_id = %s
        GROUP BY s.id
        ORDER BY s.name
    """, (cid,))

    result = []
    for r in rows:
        d = safe_section(r)
        d["studentCount"] = r["student_count"]
        result.append(d)
    return jsonify(result)


@classes_bp.route("/api/classes/<int:cid>/sections", methods=["POST"])
@perm_required("classes")
def api_add_section(cid):
    guard = assert_class_in_context(cid)
    if guard:
        return guard

    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Section name is required"}), 400
    if query("SELECT id FROM sections WHERE class_id=%s AND name=%s", (cid, name), one=True):
        return jsonify({"error": "Section name already exists in this class"}), 409

    try:
        query(
            "INSERT INTO sections (class_id, name, capacity, room) VALUES (%s,%s,%s,%s)",
            (cid, name, data.get("capacity", 40), data.get("room", "")),
            commit=True,
        )
        new = query("SELECT * FROM sections WHERE class_id=%s AND name=%s", (cid, name), one=True)
        return jsonify({"success": True, "section": safe_section(new)}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to create section: {str(e)}"}), 500


@classes_bp.route("/api/sections/<int:sid>", methods=["PUT"])
@perm_required("classes")
def api_update_section(sid):
    guard = assert_section_in_context(sid)
    if guard:
        return guard
    sec = query("SELECT * FROM sections WHERE id=%s", (sid,), one=True)

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []

    for field, col in [("name","name"),("capacity","capacity"),("room","room")]:
        if field in data:
            sets.append(f"{col}=%s")
            args.append(data[field])

    if not sets:
        return jsonify({"success": True, "section": safe_section(sec)})

    try:
        args.append(sid)
        query(f"UPDATE sections SET {','.join(sets)} WHERE id=%s", args, commit=True)
        updated = query("SELECT * FROM sections WHERE id=%s", (sid,), one=True)
        return jsonify({"success": True, "section": safe_section(updated)})
    except Exception as e:
        return jsonify({"error": f"Failed to update section: {str(e)}"}), 500


@classes_bp.route("/api/sections/<int:sid>", methods=["DELETE"])
@perm_required("classes")
def api_delete_section(sid):
    guard = assert_section_in_context(sid)
    if guard:
        return guard
    query("DELETE FROM sections WHERE id=%s", (sid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# CLASS STUDENTS — CRUD (uses class_students table)
# ================================================================

@classes_bp.route("/api/sections/<int:sid>/students", methods=["GET"])
@login_required
def api_get_class_students(sid):
    guard = assert_section_in_context(sid)
    if guard:
        return guard

    search = request.args.get("search", "").strip()
    status = request.args.get("status", "")
    page   = max(1, int(request.args.get("page",  1)))
    limit  = max(1, min(100, int(request.args.get("limit", 20))))
    offset = (page - 1) * limit

    sql  = "SELECT * FROM class_students WHERE section_id=%s"
    args = [sid]
    if search:
        sql  += " AND (LOWER(name) LIKE %s OR roll_no LIKE %s OR LOWER(email) LIKE %s)"
        args += [f"%{search.lower()}%", f"%{search}%", f"%{search.lower()}%"]
    if status:
        sql += " AND status=%s"; args.append(status)

    total = query(f"SELECT COUNT(*) AS cnt FROM ({sql}) t", args, one=True)["cnt"]
    sql  += " ORDER BY roll_no LIMIT %s OFFSET %s"
    args += [limit, offset]
    rows  = query(sql, args)

    return jsonify({
        "students":   [safe_class_student(r) for r in rows],
        "total":      total,
        "page":       page,
        "limit":      limit,
        "totalPages": max(1, (total + limit - 1) // limit),
    })


@classes_bp.route("/api/sections/<int:sid>/students", methods=["POST"])
@perm_required("classes")
def api_add_class_student(sid):
    guard = assert_section_in_context(sid)
    if guard:
        return guard

    data    = request.get_json(force=True, silent=True) or {}
    name    = data.get("name", "").strip()
    roll_no = data.get("rollNo", "").strip()

    if not name:
        return jsonify({"error": "Student name is required"}), 400
    if not roll_no:
        return jsonify({"error": "Roll number is required"}), 400
    if query("SELECT id FROM class_students WHERE section_id=%s AND roll_no=%s", (sid, roll_no), one=True):
        return jsonify({"error": "Roll number already exists in this section"}), 409

    try:
        query(
            """INSERT INTO class_students (section_id, name, roll_no, email, phone, status)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (sid, name, roll_no,
             data.get("email", ""), data.get("phone", ""),
             data.get("status", "active")),
            commit=True,
        )
        new = query(
            "SELECT * FROM class_students WHERE section_id=%s AND roll_no=%s",
            (sid, roll_no), one=True
        )
        return jsonify({"success": True, "student": safe_class_student(new)}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to add student: {str(e)}"}), 500


@classes_bp.route("/api/class-students/<int:stid>", methods=["PUT"])
@perm_required("classes")
def api_update_class_student(stid):
    guard = assert_in_context("class_students", stid, "Student")
    if guard:
        return guard
    st = query("SELECT * FROM class_students WHERE id=%s", (stid,), one=True)

    data = request.get_json(force=True, silent=True) or {}
    sets, args = [], []

    for field, col in [
        ("name","name"), ("rollNo","roll_no"),
        ("email","email"), ("phone","phone"), ("status","status"),
    ]:
        if field in data:
            sets.append(f"{col}=%s")
            args.append(data[field])

    if not sets:
        return jsonify({"success": True, "student": safe_class_student(st)})

    try:
        args.append(stid)
        query(f"UPDATE class_students SET {','.join(sets)} WHERE id=%s", args, commit=True)
        updated = query("SELECT * FROM class_students WHERE id=%s", (stid,), one=True)
        return jsonify({"success": True, "student": safe_class_student(updated)})
    except Exception as e:
        return jsonify({"error": f"Failed to update student: {str(e)}"}), 500


@classes_bp.route("/api/class-students/<int:stid>", methods=["DELETE"])
@perm_required("classes")
def api_delete_class_student(stid):
    guard = assert_in_context("class_students", stid, "Student")
    if guard:
        return guard
    query("DELETE FROM class_students WHERE id=%s", (stid,), commit=True)
    return jsonify({"success": True})


# ================================================================
# HIERARCHY & DROPDOWNS
# ================================================================

@classes_bp.route("/api/classes/hierarchy", methods=["GET"])
@login_required
def api_get_hierarchy():
    clause, params = ctx_clause("c")
    classes = query(f"""
        SELECT c.*,
               COUNT(DISTINCT s.id)  AS section_count,
               COUNT(DISTINCT cs.id) AS student_count
        FROM   classes c
        LEFT JOIN sections s  ON s.class_id  = c.id
        LEFT JOIN class_students cs ON cs.section_id = s.id
        WHERE  {clause}
        GROUP BY c.id
        ORDER BY c.name
    """, params)

    result = []
    for cls in classes:
        cls_dict = safe_class(cls)
        cls_dict["sectionCount"] = cls["section_count"]
        cls_dict["studentCount"] = cls["student_count"]

        sections = query("""
            SELECT s.*, COUNT(cs.id) AS student_count
            FROM   sections s
            LEFT JOIN class_students cs ON cs.section_id = s.id
            WHERE  s.class_id = %s
            GROUP BY s.id
            ORDER BY s.name
        """, (cls["id"],))

        cls_dict["sections"] = []
        for sec in sections:
            sec_dict = safe_section(sec)
            sec_dict["studentCount"] = sec["student_count"]
            students = query(
                "SELECT * FROM class_students WHERE section_id=%s ORDER BY roll_no",
                (sec["id"],)
            )
            sec_dict["students"] = [safe_class_student(st) for st in students]
            cls_dict["sections"].append(sec_dict)

        result.append(cls_dict)

    return jsonify(result)


@classes_bp.route("/api/classes/dropdown", methods=["GET"])
@login_required
def api_classes_dropdown():
    clause, params = ctx_clause()
    rows = query(
        f"SELECT id, name, code FROM classes WHERE status='active' AND {clause} ORDER BY name",
        params
    )
    return jsonify([{"id": r["id"], "name": r["name"], "code": r["code"]} for r in rows])


@classes_bp.route("/api/sections/dropdown", methods=["GET"])
@login_required
def api_sections_dropdown():
    cid = request.args.get("class_id", "")
    clause, params = ctx_clause("c")
    if cid:
        rows = query(
            "SELECT s.id, s.name, s.class_id, c.name AS class_name "
            "FROM sections s JOIN classes c ON c.id=s.class_id "
            f"WHERE s.class_id=%s AND {clause} ORDER BY s.name",
            [cid] + params,
        )
    else:
        rows = query(
            "SELECT s.id, s.name, s.class_id, c.name AS class_name "
            "FROM sections s JOIN classes c ON c.id=s.class_id "
            f"WHERE {clause} "
            "ORDER BY c.name, s.name",
            params
        )
    return jsonify([
        {"id": r["id"], "name": r["name"],
         "classId": r["class_id"], "className": r["class_name"]}
        for r in rows
    ])
