"""
routes/auth.py  —  Authentication routes
  POST /api/login
  POST /api/logout
  GET  /api/me
  POST /api/change-password

Every login carries an institution context (department + optional campus).
The context the browser sends is only a CLAIM: it is validated against the
`departments` / `campuses` tables, then checked against the account's own
department/campus before the session is created.  See utils/context.py.
"""

from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from db import query
from utils.auth import User, parse_permissions
from utils.context import (
    authorize_user_context,
    context_id_prefix,
    public_context,
    resolve_context,
)

auth_bp = Blueprint("auth", __name__)


# ================================================================
# HELPERS
# ================================================================
def _finish_login(uid, role, name, ctx, is_sub_admin=False, perms=None):
    """
    Create the Flask-Login session for a successfully authenticated and
    context-authorised account.  The validated context is stored in the
    session payload — this is the single source of truth used by every
    subsequent request (spec §13).
    """
    perms = perms or []
    user  = User(uid, role, name, is_sub_admin, perms, context=ctx)
    login_user(user, remember=True)

    session["user_info"] = {
        "id":           uid,
        "role":         role,
        "name":         name,
        "is_sub_admin": is_sub_admin,
        "permissions":  perms,
        "context":      ctx,
    }
    return jsonify({
        "success": True,
        "user": {
            "id": uid, "role": role, "name": name,
            "isSubAdmin": is_sub_admin, "permissions": perms,
            "context": public_context(),
        }
    })


def _credential_hint(role, ctx):
    """Sample-credential hint for a failed login, adapted to the context."""
    if role == "teacher":
        prefix = context_id_prefix("teachers", ctx)
        pwd    = "teach1" if prefix == "T" else "teach123"
        return f"Invalid ID or password. Try {prefix}001 / {pwd}"
    if role == "student":
        prefix = context_id_prefix("students", ctx)
        return f"Invalid ID or password. Try {prefix}001 / 1234"
    return "Invalid credentials"


@auth_bp.route("/api/login", methods=["POST"])
def api_login():
    data     = request.get_json() or {}
    role     = data.get("role", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not all([role, username, password]):
        return jsonify({"success": False, "error": "All fields required"}), 400

    # ── Validate the CLAIMED institution context server-side ─────
    ctx, ctx_err = resolve_context(data.get("department"), data.get("campus"))
    if ctx_err:
        return jsonify({"success": False, "error": ctx_err, "contextError": True}), 400

    # ── ADMIN ────────────────────────────────────────────────────
    if role == "admin":
        if username == "admin":
            cfg = query("SELECT password_hash FROM admin_config LIMIT 1", one=True)
            if cfg and check_password_hash(cfg["password_hash"], password):
                # The principal/super-admin is institution-wide and may work
                # inside any active context — one context at a time.
                return _finish_login("admin", "admin", "Admin / Principal", ctx)

        # Sub-admin check — scoped to their own department/campus
        sa = query("SELECT * FROM sub_admins WHERE username=%s AND portal='active'",
                   (username,), one=True)
        if sa and check_password_hash(sa["password_hash"], password):
            allowed, why = authorize_user_context(sa, ctx, allow_global=True)
            if not allowed:
                return jsonify({"success": False, "error": why}), 403
            perms = parse_permissions(sa["permissions"])
            return _finish_login(sa["id"], "admin", sa["name"], ctx,
                                 is_sub_admin=True, perms=perms)

        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    # ── TEACHER ──────────────────────────────────────────────────
    if role == "teacher":
        t = query("SELECT * FROM teachers WHERE id=%s AND portal='active'", (username,), one=True)
        if t and check_password_hash(t["password_hash"], password):
            # A teacher of Intermediate/Boys cannot sign into Intermediate/Girls
            allowed, why = authorize_user_context(t, ctx)
            if not allowed:
                return jsonify({"success": False, "error": why}), 403
            return _finish_login(t["id"], "teacher", t["name"], ctx)
        return jsonify({"success": False, "error": _credential_hint("teacher", ctx)}), 401

    # ── STUDENT ──────────────────────────────────────────────────
    if role == "student":
        s = query("SELECT * FROM students WHERE id=%s AND portal='active'", (username,), one=True)
        if s and check_password_hash(s["password_hash"], password):
            allowed, why = authorize_user_context(s, ctx)
            if not allowed:
                return jsonify({"success": False, "error": why}), 403
            return _finish_login(s["id"], "student", s["name"], ctx)
        return jsonify({"success": False, "error": _credential_hint("student", ctx)}), 401

    return jsonify({"success": False, "error": "Invalid role"}), 400


@auth_bp.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    logout_user()
    session.pop("user_info", None)
    # Drop everything, including the institution context, so the next screen
    # is a clean Department Selection (spec §19).
    session.clear()
    return jsonify({"success": True})


@auth_bp.route("/api/me", methods=["GET"])
@login_required
def api_me():
    return jsonify({
        "id":          current_user.id,
        "role":        current_user.role,
        "name":        current_user.name,
        "isSubAdmin":  current_user.is_sub_admin,
        "permissions": current_user.permissions,
        # Context is returned so the UI can label itself; it is NOT the
        # authority for what data is visible — the server always re-reads
        # the session context when filtering queries.
        "context":     public_context(),
    })


@auth_bp.route("/api/change-password", methods=["POST"])
@login_required
def api_change_password():
    data    = request.get_json() or {}
    cur_pwd = data.get("currentPassword", "")
    new_pwd = data.get("newPassword", "")

    if len(new_pwd) < 4:
        return jsonify({"success": False, "error": "Password must be at least 4 characters"}), 400

    role = current_user.role

    if role == "admin" and not current_user.is_sub_admin:
        cfg = query("SELECT * FROM admin_config LIMIT 1", one=True)
        if not cfg or not check_password_hash(cfg["password_hash"], cur_pwd):
            return jsonify({"success": False, "error": "Current password incorrect"}), 400
        query("UPDATE admin_config SET password_hash=%s WHERE id=%s",
              (generate_password_hash(new_pwd), cfg["id"]), commit=True)

    elif role == "admin" and current_user.is_sub_admin:
        sa = query("SELECT * FROM sub_admins WHERE id=%s", (current_user.id,), one=True)
        if not sa or not check_password_hash(sa["password_hash"], cur_pwd):
            return jsonify({"success": False, "error": "Current password incorrect"}), 400
        query("UPDATE sub_admins SET password_hash=%s WHERE id=%s",
              (generate_password_hash(new_pwd), current_user.id), commit=True)

    elif role == "teacher":
        t = query("SELECT * FROM teachers WHERE id=%s", (current_user.id,), one=True)
        if not t or not check_password_hash(t["password_hash"], cur_pwd):
            return jsonify({"success": False, "error": "Current password incorrect"}), 400
        query("UPDATE teachers SET password_hash=%s WHERE id=%s",
              (generate_password_hash(new_pwd), current_user.id), commit=True)

    elif role == "student":
        s = query("SELECT * FROM students WHERE id=%s", (current_user.id,), one=True)
        if not s or not check_password_hash(s["password_hash"], cur_pwd):
            return jsonify({"success": False, "error": "Current password incorrect"}), 400
        query("UPDATE students SET password_hash=%s WHERE id=%s",
              (generate_password_hash(new_pwd), current_user.id), commit=True)

    return jsonify({"success": True, "message": "Password updated successfully!"})
