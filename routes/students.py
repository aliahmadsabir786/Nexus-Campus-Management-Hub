"""
routes/students.py  —  Student CRUD routes
  GET    /api/students
  GET    /api/students/<sid>
  POST   /api/students
  PUT    /api/students/<sid>
  DELETE /api/students/<sid>

ONE implementation serves BS, Intermediate/Boys and Intermediate/Girls.
Which rows a request may see or touch comes from the authenticated session
via utils.context — never from the request itself (spec §7, §9, §15).
"""

import base64
import binascii
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required
from werkzeug.security import generate_password_hash

from db import query
from config import TODAY
from utils.auth import perm_required, safe_student
from utils.context import (
    apply_ctx,
    assert_class_in_context,
    assert_section_in_context,
    assert_student_in_context,
    ctx_and,
    next_context_id,
    write_context,
)

# Max photo size: 1 MB as base64 string (~1.37 MB encoded).
# base64 of 1MB binary = ~1.37MB string. We accept up to 2MB binary → ~2.74MB base64.
MAX_PHOTO_B64_LEN = 3 * 1024 * 1024   # 3 MB of base64 text ≈ 2.2 MB original image
ALLOWED_IMAGE_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/png;base64,",
    "data:image/gif;base64,",
    "data:image/webp;base64,",
)


def validate_photo(photo):
    """
    Validates a base64 data-URL photo string.
    Returns (cleaned_photo, error_string).  error_string is None on success.
    """
    if photo is None:
        return None, None                    # no photo — fine
    if not isinstance(photo, str):
        return None, "Photo must be a base64 string"
    if not any(photo.startswith(p) for p in ALLOWED_IMAGE_PREFIXES):
        return None, "Only JPG, PNG, GIF, or WebP images are allowed"
    if len(photo) > MAX_PHOTO_B64_LEN:
        return None, "Photo is too large. Maximum size is 2 MB"
    # Make sure the base64 payload is actually valid
    try:
        header, b64data = photo.split(",", 1)
        base64.b64decode(b64data, validate=True)
    except (ValueError, binascii.Error):
        return None, "Photo data is corrupted or invalid"
    return photo, None

students_bp = Blueprint("students", __name__)


@students_bp.route("/api/students", methods=["GET"])
@login_required
def api_get_students():
    search = request.args.get("search", "").lower()
    cls    = request.args.get("cls", "")
    sql    = "SELECT * FROM students WHERE 1=1"
    args   = []
    if search:
        sql  += " AND (LOWER(name) LIKE %s OR LOWER(id) LIKE %s)"
        args += [f"%{search}%", f"%{search}%"]
    if cls:
        sql += " AND cls=%s"; args.append(cls)
    # Institution isolation — resolved from the session, appended last so it
    # can never be bypassed by a crafted search/cls parameter.
    sql, args = apply_ctx(sql, args)
    rows = query(sql, args)
    return jsonify([safe_student(s) for s in rows])


@students_bp.route("/api/students/<sid>", methods=["GET"])
@login_required
def api_get_student(sid):
    guard = assert_student_in_context(sid)
    if guard:
        return guard
    s = query("SELECT * FROM students WHERE id=%s", (sid,), one=True)
    if not s:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(safe_student(s))


@students_bp.route("/api/students", methods=["POST"])
@perm_required("students")
def api_add_student():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON body"}), 400

    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400

    # Validate photo BEFORE touching the database
    photo, photo_err = validate_photo(data.get("photo"))
    if photo_err:
        return jsonify({"error": photo_err}), 400

    # Rows are always filed under the creator's own context.
    dept_id, campus_id = write_context()
    if not dept_id:
        return jsonify({"error": "No institution context — please sign in again"}), 403

    pwd    = data.get("password", "1234") or "1234"
    new_id = next_context_id("students", "students")
    cls    = data.get("cls", "CS-A")

    # Auto generate roll number based on class — next available number in that
    # class WITHIN this context, so Boys and Girls number independently.
    provided_roll = data.get("rollNo", "").strip()
    if provided_roll:
        roll_no = provided_roll
    else:
        ctx_sql, ctx_args = ctx_and()
        existing = query(
            "SELECT roll_no FROM students "
            "WHERE cls=%s AND roll_no IS NOT NULL AND roll_no != ''" + ctx_sql,
            [cls] + ctx_args)
        nums = []
        for r in existing:
            try: nums.append(int(r["roll_no"]))
            except (ValueError, TypeError): pass
        roll_no = str(max(nums, default=0) + 1).zfill(2)

    class_id   = data.get("classId") or None
    section_id = data.get("sectionId") or None

    # The class/section a new student is placed in must belong to this context.
    if class_id:
        guard = assert_class_in_context(class_id)
        if guard:
            return guard
    if section_id:
        guard = assert_section_in_context(section_id)
        if guard:
            return guard

    try:
        query(
            """INSERT INTO students
               (id,name,cls,subject_group,roll_no,phone,guardian_phone,
                email,fee_status,dob,password_hash,portal,photo,class_id,section_id,
                department_id,campus_id)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,%s,%s,%s)""",
            (new_id, name,
             cls,
             data.get("subjectGroup", "Computer Science"),
             roll_no,
             data.get("phone", ""),
             data.get("guardianPhone", ""),
             data.get("email", ""),
             data.get("feeStatus", "pending"),
             data.get("dob") or None,
             generate_password_hash(pwd),
             photo,
             class_id,
             section_id,
             dept_id,
             campus_id),
            commit=True
        )
    except Exception as e:
        return jsonify({"error": f"Failed to save student: {str(e)}"}), 500

    try:
        # Default fee voucher — non-critical
        query(
            """INSERT INTO fee_vouchers (student_id,month,amount,due_date,status,voucher_no)
               VALUES (%s,%s,15000,%s,%s,%s)""",
            (new_id,
             datetime.today().strftime("%B %Y"),
             TODAY,
             "paid" if data.get("feeStatus") == "paid" else "pending",
             f"V001-{new_id}"),
            commit=True
        )
    except Exception:
        pass  # Student saved; voucher can be created later

    return jsonify({"success": True, "id": new_id, "plainPassword": pwd}), 201


@students_bp.route("/api/students/<sid>", methods=["PUT"])
@perm_required("students")
def api_edit_student(sid):
    # Out-of-context students report as "not found" so IDs cannot be probed.
    guard = assert_student_in_context(sid)
    if guard:
        return guard

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

    # A student may only be moved into a class/section of their OWN
    # institution — otherwise an edit could smuggle a row across campuses.
    if data.get("classId"):
        guard = assert_class_in_context(data["classId"])
        if guard:
            return guard
    if data.get("sectionId"):
        guard = assert_section_in_context(data["sectionId"])
        if guard:
            return guard

    fields = {
        "name": "name", "cls": "cls", "subjectGroup": "subject_group",
        "rollNo": "roll_no", "phone": "phone", "guardianPhone": "guardian_phone",
        "email": "email", "feeStatus": "fee_status", "dob": "dob",
        "portal": "portal", "photo": "photo",
        "classId": "class_id", "sectionId": "section_id"
    }

    sets, args = [], []
    for js_key, db_col in fields.items():
        if js_key in data:
            sets.append(f"{db_col}=%s")
            args.append(data[js_key])
    if data.get("password"):
        sets.append("password_hash=%s")
        args.append(generate_password_hash(data["password"]))

    if sets:
        try:
            args.append(sid)
            query(f"UPDATE students SET {','.join(sets)} WHERE id=%s", args, commit=True)
        except Exception as e:
            return jsonify({"error": f"Failed to update student: {str(e)}"}), 500

    updated = query("SELECT * FROM students WHERE id=%s", (sid,), one=True)
    return jsonify({"success": True, "student": safe_student(updated)})


@students_bp.route("/api/students/<sid>", methods=["DELETE"])
@perm_required("students")
def api_delete_student(sid):
    guard = assert_student_in_context(sid)
    if guard:
        return guard
    query("DELETE FROM students WHERE id=%s", (sid,), commit=True)
    return jsonify({"success": True})
