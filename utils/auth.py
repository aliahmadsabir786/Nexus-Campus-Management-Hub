"""
utils/auth.py  —  Flask-Login User model, decorators, utility functions
"""

import json
from datetime import datetime
from functools import wraps
from flask import jsonify, session
from flask_login import LoginManager, UserMixin, login_required, current_user
from db import query

login_manager = LoginManager()
login_manager.login_view = "index"


# ================================================================
# USER MODEL
# ================================================================
class User(UserMixin):
    """
    Session-backed user.  `context` carries the validated institution
    context (department + campus) resolved at login time — see
    utils/context.py.  It is exposed as `current_user.department_id` /
    `current_user.campus_id` so every route can scope its queries.
    """

    def __init__(self, user_id, role, name, is_sub_admin=False,
                 permissions=None, context=None):
        self.id           = user_id
        self.role         = role
        self.name         = name
        self.is_sub_admin = is_sub_admin
        self.permissions  = permissions or []

        # ── Institution context (never taken from the request body) ──
        self.context       = context or {}
        self.department    = self.context.get("department")       # "BS" | "INTERMEDIATE"
        self.department_id = self.context.get("department_id")
        self.campus        = self.context.get("campus")          # "BOYS" | "GIRLS" | None
        self.campus_id     = self.context.get("campus_id")

    def can_access(self, page):
        if self.role != "admin":   return True
        if not self.is_sub_admin:  return True
        if page in {"dashboard", "portals", "settings", "subadmins"}:
            return False
        return page in self.permissions


@login_manager.user_loader
def load_user(user_id):
    info = session.get("user_info")
    if not info or str(info.get("id")) != str(user_id):
        return None
    # A session without a validated context predates the department/campus
    # split (or was tampered with).  Refuse it so the user is sent back
    # through Department Selection → login instead of silently defaulting
    # to some department's data.
    ctx = info.get("context")
    if not isinstance(ctx, dict) or not ctx.get("department_id"):
        return None
    return User(
        info["id"], info["role"], info["name"],
        info.get("is_sub_admin", False),
        info.get("permissions", []),
        context=ctx
    )


@login_manager.unauthorized_handler
def unauthorized():
    """
    The frontend is a JSON single-page app: always answer with 401 JSON
    instead of redirecting to the HTML shell, so `fetch()` callers can
    detect an expired/invalid session and return to Department Selection.
    """
    return jsonify({"error": "Authentication required", "authenticated": False}), 401


# ================================================================
# DECORATORS
# ================================================================
def admin_required(f):
    """Only full admins (not sub-admins) can access."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.role != "admin" or current_user.is_sub_admin:
            return jsonify({"error": "Full admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


def perm_required(page):
    """Sub-admins need explicit permission for this page."""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            if not current_user.can_access(page):
                return jsonify({"error": f"Permission denied for: {page}"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ================================================================
# UTILITY FUNCTIONS
# ================================================================
def ts():
    """Current timestamp in milliseconds (used as unique IDs)."""
    return int(datetime.now().timestamp() * 1000)


def next_id(table, prefix, id_col="id"):
    """Generate next sequential ID like S001, T005, E003."""
    rows = query(f"SELECT {id_col} FROM {table}")
    nums = [int(r[id_col][1:]) for r in rows if str(r[id_col])[1:].isdigit()]
    return prefix + str(max(nums, default=0) + 1).zfill(3)


def safe_student(s):
    """Remove password_hash before sending student data to frontend."""
    d = {k: v for k, v in s.items() if k != "password_hash"}
    d["classId"]   = d.get("class_id")
    d["sectionId"] = d.get("section_id")
    return d


def safe_teacher(t):
    """Remove password_hash before sending teacher data to frontend."""
    d = {k: v for k, v in t.items() if k != "password_hash"}
    d["classId"]   = d.get("class_id")
    d["sectionId"] = d.get("section_id")
    return d


def parse_permissions(raw):
    """Parse permissions field (may be JSON string or list)."""
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return []
    return raw or []
