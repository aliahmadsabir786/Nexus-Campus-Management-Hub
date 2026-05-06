"""
utils/teacher_access.py  —  Teacher Assignment Access Control
=============================================================
Provides:
  - get_teacher_assignments(teacher_id)
        Returns list of assignment dicts with keys:
        class_id, section_id, subject_id

  - teacher_required(f)
        Decorator: blocks non-teacher callers.

  - teacher_assignment_required(f)
        Decorator (for routes with <tid> URL param): validates that
        the logged-in teacher IS that teacher.

  - verify_student_access(teacher_id, student_id)
        Returns True if student belongs to any of the teacher's
        assigned (class_id, section_id) pairs.

  - get_assigned_students(teacher_id, class_id=None, section_id=None)
        Returns query rows of students the teacher may access.

  - filter_by_assignment(teacher_id, class_id=None, section_id=None, subject_id=None)
        Returns validated (class_id, section_id, subject_id) or raises
        a 403 JSON response if the combo isn't assigned.

All functions that need DB access import `query` from db.py.
Admin and sub-admin users bypass all assignment checks (they see
everything). Only `role == "teacher"` triggers access control.
"""

from functools import wraps
from flask import request, jsonify
from flask_login import current_user, login_required

from db import query


# ================================================================
# CORE DATA ACCESS
# ================================================================

def get_teacher_assignments(teacher_id):
    """
    Fetch all rows from teacher_assignments for a given teacher.
    Returns a list of dicts with: id, class_id, section_id, subject_id.
    """
    return query(
        "SELECT id, class_id, section_id, subject_id "
        "FROM teacher_assignments WHERE teacher_id=%s",
        (teacher_id,)
    )


def _is_admin():
    """True when the current logged-in user is admin or sub-admin (bypass checks)."""
    return hasattr(current_user, "role") and current_user.role in ("admin",)


# ================================================================
# STUDENT VISIBILITY
# ================================================================

def get_assigned_students(teacher_id, class_id=None, section_id=None, subject_id=None):
    """
    Return students that teacher_id is allowed to see.

    Filters applied:
      - Student must be in at least one (class_id, section_id) pair
        that exists in teacher_assignments.
      - Optionally further filtered by class_id, section_id, subject_id
        (all must be in assigned combos, else empty list returned).

    Returns a list of student row dicts (no password_hash is stripped
    here – callers should apply safe_student() themselves).
    """
    assignments = get_teacher_assignments(teacher_id)
    if not assignments:
        return []

    # Build allowed (class_id, section_id) pairs
    allowed_pairs = {(a["class_id"], a["section_id"]) for a in assignments}

    # If caller wants a specific class/section, validate it is allowed
    if class_id and section_id:
        if (class_id, section_id) not in allowed_pairs:
            return []
        section_ids = [section_id]
    elif class_id:
        section_ids = [sid for (cid, sid) in allowed_pairs if cid == class_id]
        if not section_ids:
            return []
    elif section_id:
        if not any(sid == section_id for (_, sid) in allowed_pairs):
            return []
        section_ids = [section_id]
    else:
        section_ids = list({sid for (_, sid) in allowed_pairs})

    if not section_ids:
        return []

    # If subject_id provided, confirm teacher teaches it in one of these sections
    if subject_id:
        subject_ok = any(
            a["subject_id"] == subject_id and a["section_id"] in section_ids
            for a in assignments
        )
        if not subject_ok:
            return []

    ph  = ",".join(["%s"] * len(section_ids))
    sql = f"SELECT * FROM students WHERE section_id IN ({ph}) ORDER BY roll_no"
    return query(sql, section_ids)


def verify_student_access(teacher_id, student_id):
    """
    Return True if teacher_id is allowed to act on student_id.
    Admins always get True.
    """
    if _is_admin():
        return True

    assignments = get_teacher_assignments(teacher_id)
    if not assignments:
        return False

    allowed_pairs = {(a["class_id"], a["section_id"]) for a in assignments}

    s = query(
        "SELECT class_id, section_id FROM students WHERE id=%s",
        (student_id,), one=True
    )
    if not s:
        return False

    return (s["class_id"], s["section_id"]) in allowed_pairs


def verify_assignment_combo(teacher_id, class_id, section_id, subject_id=None):
    """
    Return True if (class_id, section_id[, subject_id]) is in the
    teacher's assigned combos.
    Admins always get True.
    """
    if _is_admin():
        return True

    assignments = get_teacher_assignments(teacher_id)
    for a in assignments:
        if a["class_id"] == class_id and a["section_id"] == section_id:
            if subject_id is None or a["subject_id"] == subject_id:
                return True
    return False


# ================================================================
# DECORATORS
# ================================================================

def teacher_required(f):
    """
    Route decorator: only teachers (and admins acting as pass-through)
    may call this endpoint.  Students are blocked.
    """
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.role == "student":
            return jsonify({"error": "Access denied: students cannot call this endpoint"}), 403
        return f(*args, **kwargs)
    return decorated


def teacher_self_or_admin(f):
    """
    Route decorator for endpoints that carry <tid> in the URL.
    Ensures the logged-in teacher matches <tid>, OR the caller is admin.
    """
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        tid = kwargs.get("tid") or request.view_args.get("tid")
        if current_user.role == "teacher" and current_user.id != tid:
            return jsonify({"error": "Access denied: you can only access your own data"}), 403
        return f(*args, **kwargs)
    return decorated


# ================================================================
# REQUEST-LEVEL HELPERS
# ================================================================

def assert_student_access(student_id):
    """
    Call inside a route body.  Returns a 403 JSON response if the
    current teacher is NOT allowed to act on student_id, else None.
    Admins always pass.
    """
    if _is_admin():
        return None
    if current_user.role != "teacher":
        return None   # non-teacher roles handled by their own decorators

    if not verify_student_access(current_user.id, student_id):
        return jsonify({
            "error": "Access denied: student is not in your assigned class/section"
        }), 403
    return None


def assert_assignment_combo(class_id, section_id, subject_id=None):
    """
    Call inside a route body.  Returns a 403 JSON response if the
    current teacher's assignment table does not contain
    (class_id, section_id [, subject_id]), else None.
    Admins always pass.
    """
    if _is_admin():
        return None
    if current_user.role != "teacher":
        return None

    try:
        class_id_int   = int(class_id)   if class_id   else None
        section_id_int = int(section_id) if section_id else None
    except (TypeError, ValueError):
        return jsonify({"error": "class_id and section_id must be integers"}), 400

    if not class_id_int or not section_id_int:
        return jsonify({"error": "class_id and section_id are required for teachers"}), 400

    if not verify_assignment_combo(current_user.id, class_id_int, section_id_int, subject_id):
        return jsonify({
            "error": "Access denied: this class/section/subject is not assigned to you"
        }), 403
    return None
