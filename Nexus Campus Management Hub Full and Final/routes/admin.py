"""
routes/admin.py  —  Admin-only routes
  GET/POST/PUT/DELETE  /api/subadmins
  POST                 /api/subadmins/<said>/toggle
  POST                 /api/settings/admin-password
  GET                  /api/dashboard
  GET                  /api/reports/attendance
  GET                  /api/reports/grades
  GET                  /api/reports/fees
  GET                  /api/system-info

Everything counted or reported here is scoped to the caller's institution
(spec §15/§16): tables that own department_id/campus_id are filtered with
ctx_clause(), and tables that inherit context (attendance, submissions,
complaints) are filtered through the owning table with in_context_subquery().
"""

import json
from flask import Blueprint, request, jsonify
from flask_login import login_required
from werkzeug.security import generate_password_hash, check_password_hash

from db import query
from config import TODAY, SUBJECT_GROUPS, SUB_ADMIN_PERMS
from utils.auth import admin_required, perm_required, ts
from utils.context import (
    apply_ctx,
    assert_in_context,
    ctx_clause,
    in_context_subquery,
    write_context,
)

admin_bp = Blueprint("admin", __name__)


# ================================================================
# CONTEXT-AWARE COUNTERS
# ================================================================
# `where` is always a literal written in this file — never user input — so it
# is safe to interpolate.  All values still travel as bound parameters.

def _ctx_count(table, where="", args=None):
    """COUNT rows of a table that OWNS department_id / campus_id."""
    clause, params = ctx_clause()
    sql = f"SELECT COUNT(*) AS c FROM {table} WHERE {clause}"
    if where:
        sql += f" AND {where}"
    return query(sql, params + list(args or []), one=True)["c"]


def _child_count(table, fk, parent, where="", args=None):
    """COUNT rows of a table that INHERITS context through fk -> parent.id."""
    sub, params = in_context_subquery(parent)
    sql = f"SELECT COUNT(*) AS c FROM {table} WHERE {fk} IN ({sub})"
    if where:
        sql += f" AND {where}"
    return query(sql, params + list(args or []), one=True)["c"]


def _ctx_students(cls="ALL"):
    """Student pool for the report endpoints, always institution-filtered."""
    sql, args = "SELECT * FROM students WHERE 1=1", []
    if cls and cls != "ALL":
        sql += " AND cls=%s"
        args.append(cls)
    sql, args = apply_ctx(sql, args)
    return query(sql, args)


# ================================================================
# SUB-ADMINS
# ================================================================
@admin_bp.route("/api/subadmins", methods=["GET"])
@admin_required
def api_get_subadmins():
    # Sub-admins belong to the institution that created them.  Accounts with
    # no context (legacy/global) are intentionally not listed here — they are
    # authorised at login by authorize_user_context(allow_global=True).
    clause, params = ctx_clause()
    rows = query(
        "SELECT id,name,username,permissions,portal,created_at "
        f"FROM sub_admins WHERE {clause}", params
    )
    return jsonify(rows)


@admin_bp.route("/api/subadmins", methods=["POST"])
@admin_required
def api_add_subadmin():
    data     = request.get_json() or {}
    name     = data.get("name",     "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    perms    = [p for p in data.get("permissions", []) if p in SUB_ADMIN_PERMS]

    if not all([name, username, password]):
        return jsonify({"error": "All fields required"}), 400
    if username == "admin":
        return jsonify({"error": "Reserved username"}), 400
    # Usernames stay globally unique: login resolves a sub-admin by username
    # alone, so a duplicate across campuses would be ambiguous.
    if query("SELECT id FROM sub_admins WHERE username=%s", (username,), one=True):
        return jsonify({"error": "Username already taken"}), 400

    dept_id, campus_id = write_context()
    if not dept_id:
        return jsonify({"error": "No institution context — please sign in again"}), 403

    said = "SA" + str(ts())
    query(
        "INSERT INTO sub_admins (id,name,username,password_hash,permissions,"
        "department_id,campus_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (said, name, username, generate_password_hash(password), json.dumps(perms),
         dept_id, campus_id),
        commit=True
    )
    return jsonify({"success": True, "id": said}), 201


@admin_bp.route("/api/subadmins/<said>", methods=["PUT"])
@admin_required
def api_edit_subadmin(said):
    guard = assert_in_context("sub_admins", said, "Sub-admin")
    if guard:
        return guard

    data       = request.get_json() or {}
    sets, args = [], []

    if "name"     in data: sets.append("name=%s");         args.append(data["name"])
    if "username" in data: sets.append("username=%s");     args.append(data["username"])
    if "password" in data: sets.append("password_hash=%s"); args.append(generate_password_hash(data["password"]))
    if "permissions" in data:
        perms = [p for p in data["permissions"] if p in SUB_ADMIN_PERMS]
        sets.append("permissions=%s"); args.append(json.dumps(perms))

    if sets:
        args.append(said)
        query(f"UPDATE sub_admins SET {','.join(sets)} WHERE id=%s", args, commit=True)

    return jsonify({"success": True})


@admin_bp.route("/api/subadmins/<said>", methods=["DELETE"])
@admin_required
def api_delete_subadmin(said):
    guard = assert_in_context("sub_admins", said, "Sub-admin")
    if guard:
        return guard
    query("DELETE FROM sub_admins WHERE id=%s", (said,), commit=True)
    return jsonify({"success": True})


@admin_bp.route("/api/subadmins/<said>/toggle", methods=["POST"])
@admin_required
def api_toggle_subadmin(said):
    guard = assert_in_context("sub_admins", said, "Sub-admin")
    if guard:
        return guard
    sa = query("SELECT portal FROM sub_admins WHERE id=%s", (said,), one=True)
    if not sa:
        return jsonify({"error": "Sub-admin not found"}), 404
    new_p = "inactive" if sa["portal"] == "active" else "active"
    query("UPDATE sub_admins SET portal=%s WHERE id=%s", (new_p, said), commit=True)
    return jsonify({"success": True, "portal": new_p})


# ================================================================
# SETTINGS
# ================================================================
@admin_bp.route("/api/settings/admin-password", methods=["POST"])
@admin_required
def api_change_admin_password():
    data    = request.get_json() or {}
    cur     = data.get("currentPassword",  "")
    new_p   = data.get("newPassword",      "")
    confirm = data.get("confirmPassword",  "")

    if not all([cur, new_p, confirm]):
        return jsonify({"error": "All fields required"}), 400
    if len(new_p) < 6:
        return jsonify({"error": "At least 6 characters"}), 400
    if new_p != confirm:
        return jsonify({"error": "Passwords do not match"}), 400

    cfg = query("SELECT * FROM admin_config LIMIT 1", one=True)
    if not cfg or not check_password_hash(cfg["password_hash"], cur):
        return jsonify({"error": "Current password is incorrect"}), 400

    query("UPDATE admin_config SET password_hash=%s WHERE id=%s",
          (generate_password_hash(new_p), cfg["id"]), commit=True)
    return jsonify({"success": True, "message": "Admin password updated!"})


# ================================================================
# DASHBOARD
# ================================================================
@admin_bp.route("/api/dashboard", methods=["GET"])
@login_required
def api_dashboard():
    total_s = _ctx_count("students")
    present = _child_count("attendance", "student_id", "students",
                           "date=%s AND status='present'", [TODAY])

    return jsonify({
        "totalStudents":    total_s,
        "totalTeachers":    _ctx_count("teachers"),
        "presentToday":     present,
        "absentToday":      total_s - present,
        "feePaid":          _ctx_count("students", "fee_status='paid'"),
        "feePending":       _ctx_count("students", "fee_status='pending'"),
        "feeOverdue":       _ctx_count("students", "fee_status='overdue'"),
        "totalAssignments": _ctx_count("assignments"),
        "pendingGrading":   _child_count("submissions", "assignment_id", "assignments",
                                         "status='submitted'"),
        "totalComplaints":  _child_count("complaints", "student_id", "students"),
        "totalExams":       _ctx_count("exams"),
        "totalNotices":     _ctx_count("notices"),
        "subAdmins":        _ctx_count("sub_admins"),
        "totalClasses":     _ctx_count("classes"),
    })


# ================================================================
# REPORTS
# ================================================================
@admin_bp.route("/api/reports/attendance", methods=["GET"])
@perm_required("reports")
def api_report_attendance():
    pool = _ctx_students(request.args.get("cls", "ALL"))

    result = []
    for s in pool:
        rows  = query("SELECT status FROM attendance WHERE student_id=%s", (s["id"],))
        total = len(rows)
        pres  = sum(1 for r in rows if r["status"] == "present")
        pct   = round(pres / total * 100) if total else 0
        result.append({
            "id":      s["id"],      "name":   s["name"],
            "cls":     s["cls"],     "rollNo": s["roll_no"],
            "present": pres,
            "absent":  sum(1 for r in rows if r["status"] == "absent"),
            "late":    sum(1 for r in rows if r["status"] == "late"),
            "total":   total,        "percent": pct,
            "status":  "Regular" if pct >= 75 else "Short",
        })
    return jsonify(result)


@admin_bp.route("/api/reports/grades", methods=["GET"])
@perm_required("reports")
def api_report_grades():
    pool = _ctx_students(request.args.get("cls", "ALL"))

    result = []
    for s in pool:
        subs = SUBJECT_GROUPS.get(s.get("subject_group", "Computer Science"), [])
        rows = query("SELECT * FROM grades WHERE student_id=%s", (s["id"],))
        sg   = {r["subject"]: r for r in rows}
        tots = [sg.get(sub, {}).get("total", 0) for sub in subs]
        avg  = round(sum(tots) / len(tots)) if tots else 0
        result.append({
            "id":       s["id"],  "name":   s["name"],
            "cls":      s["cls"], "rollNo": s["roll_no"],
            "subjects": {
                sub: {
                    "midterm":  sg.get(sub, {}).get("midterm",     0),
                    "final":    sg.get(sub, {}).get("final_marks", 0),
                    "internal": sg.get(sub, {}).get("internal",    0),
                    "total":    sg.get(sub, {}).get("total",       0),
                } for sub in subs
            },
            "average": avg,
            "passed":  avg >= 45,
        })
    return jsonify(result)


@admin_bp.route("/api/reports/fees", methods=["GET"])
@perm_required("reports")
def api_report_fees():
    pool = _ctx_students(request.args.get("cls", "ALL"))
    return jsonify([{
        "id":        s["id"],
        "name":      s["name"],
        "cls":       s["cls"],
        "feeStatus": s["fee_status"],
        "vouchers":  query("SELECT * FROM fee_vouchers WHERE student_id=%s", (s["id"],))
    } for s in pool])


@admin_bp.route("/api/system-info", methods=["GET"])
@admin_required
def api_system_info():
    return jsonify({
        "totalStudents":    _ctx_count("students"),
        "totalTeachers":    _ctx_count("teachers"),
        "totalAssignments": _ctx_count("assignments"),
        "totalSubmissions": _child_count("submissions", "assignment_id", "assignments"),
        "subAdmins":        _ctx_count("sub_admins"),
        "complaints":       _child_count("complaints", "student_id", "students"),
    })
