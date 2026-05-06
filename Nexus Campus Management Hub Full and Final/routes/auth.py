"""
routes/auth.py  —  Authentication routes
  POST /api/login
  POST /api/logout
  GET  /api/me
  POST /api/change-password
"""

from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from db import query
from utils.auth import User, parse_permissions

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/login", methods=["POST"])
def api_login():
    data     = request.get_json() or {}
    role     = data.get("role", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not all([role, username, password]):
        return jsonify({"success": False, "error": "All fields required"}), 400

    # ── ADMIN ────────────────────────────────────────────────────
    if role == "admin":
        if username == "admin":
            cfg = query("SELECT password_hash FROM admin_config LIMIT 1", one=True)
            if cfg and check_password_hash(cfg["password_hash"], password):
                user = User("admin", "admin", "Admin / Principal")
                login_user(user, remember=True)
                session["user_info"] = {
                    "id": "admin", "role": "admin", "name": "Admin / Principal",
                    "is_sub_admin": False, "permissions": []
                }
                return jsonify({"success": True, "user": {
                    "id": "admin", "role": "admin",
                    "name": "Admin / Principal", "isSubAdmin": False, "permissions": []
                }})

        # Sub-admin check
        sa = query("SELECT * FROM sub_admins WHERE username=%s AND portal='active'",
                   (username,), one=True)
        if sa and check_password_hash(sa["password_hash"], password):
            perms = parse_permissions(sa["permissions"])
            user  = User(sa["id"], "admin", sa["name"], is_sub_admin=True, permissions=perms)
            login_user(user, remember=True)
            session["user_info"] = {
                "id": sa["id"], "role": "admin", "name": sa["name"],
                "is_sub_admin": True, "permissions": perms
            }
            return jsonify({"success": True, "user": {
                "id": sa["id"], "role": "admin", "name": sa["name"],
                "isSubAdmin": True, "permissions": perms
            }})

        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    # ── TEACHER ──────────────────────────────────────────────────
    if role == "teacher":
        t = query("SELECT * FROM teachers WHERE id=%s AND portal='active'", (username,), one=True)
        if t and check_password_hash(t["password_hash"], password):
            user = User(t["id"], "teacher", t["name"])
            login_user(user, remember=True)
            session["user_info"] = {
                "id": t["id"], "role": "teacher", "name": t["name"],
                "is_sub_admin": False, "permissions": []
            }
            return jsonify({"success": True, "user": {
                "id": t["id"], "role": "teacher", "name": t["name"], "isSubAdmin": False
            }})
        return jsonify({"success": False, "error": "Invalid ID or password. Try T001 / teach1"}), 401

    # ── STUDENT ──────────────────────────────────────────────────
    if role == "student":
        s = query("SELECT * FROM students WHERE id=%s AND portal='active'", (username,), one=True)
        if s and check_password_hash(s["password_hash"], password):
            user = User(s["id"], "student", s["name"])
            login_user(user, remember=True)
            session["user_info"] = {
                "id": s["id"], "role": "student", "name": s["name"],
                "is_sub_admin": False, "permissions": []
            }
            return jsonify({"success": True, "user": {
                "id": s["id"], "role": "student", "name": s["name"], "isSubAdmin": False
            }})
        return jsonify({"success": False, "error": "Invalid ID or password. Try S001 / 1234"}), 401

    return jsonify({"success": False, "error": "Invalid role"}), 400


@auth_bp.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    logout_user()
    session.pop("user_info", None)
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
