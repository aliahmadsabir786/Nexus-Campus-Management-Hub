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

The order of checks in api_login() is deliberate and is the whole security
model of the login screen:

    identify → verify password hash → verify account status
             → verify role         → verify department → verify campus
             → create session

Nothing short-circuits it.  A request that merely *says* role="teacher" or
department="BS" proves nothing; the answer always comes from the database row
that the supplied password actually unlocks.  If any step fails no session is
created, no user object is returned, and the message is the same generic one,
so a failed login cannot be used to discover which usernames exist.
"""

from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from db import query
from utils.auth import User, parse_permissions
from utils.context import (
    CONTEXT_DENIED,
    account_in_context,
    public_context,
    resolve_context,
)

auth_bp = Blueprint("auth", __name__)

# Spec §13 — one message for "no such account" and for "wrong password".
INVALID_CREDENTIALS = "Invalid username or password"
ACCOUNT_DISABLED    = "This account has been disabled. Please contact the administrator."


# ================================================================
# HELPERS
# ================================================================
def _fail(message, status=401):
    """Every failed login leaves through here: no session, no user object."""
    return jsonify({"success": False, "error": message}), status


def _verify(row, password):
    """
    Password check for one candidate row.

    Werkzeug's check_password_hash is the project's existing mechanism and the
    only thing that ever inspects a stored secret — there is no plaintext
    comparison anywhere.  A row with no stored hash can never be unlocked
    (rather than raising), and an unparsable hash simply fails.
    """
    stored = (row or {}).get("password_hash")
    if not stored or not str(stored).strip():
        return False
    try:
        return check_password_hash(str(stored), password)
    except Exception:
        return False


def _authenticate(candidates, password, ctx):
    """
    Pick the row that the supplied password really unlocks — preferring one
    that also belongs to ``ctx``.

    ``candidates`` may hold more than one row when an identifier is only
    unique *within* a department (sub-admin usernames, see migration 002).
    Checking every candidate instead of the first one is what stops the
    "accidentally authenticate the first matching record" failure in spec §5:
    the account that gets in is always the one belonging to the selected
    institution, never whichever row the database happened to return first.

    Returns ``(row, None)`` on success, or ``(None, error_message)``.
    """
    unlocked = None
    for row in candidates:
        if not _verify(row, password):
            continue
        if account_in_context(row, ctx):
            unlocked = row          # exact context match — stop looking
            break
        unlocked = unlocked or row  # remember, but keep looking for a match

    if unlocked is None:
        return None, INVALID_CREDENTIALS

    # Status is checked only after the password is known to be correct, so
    # "disabled" can never be used to probe for accounts.
    if str(unlocked.get("portal", "active")).lower() != "active":
        return None, ACCOUNT_DISABLED

    if not account_in_context(unlocked, ctx):
        return None, CONTEXT_DENIED

    return unlocked, None


def _finish_login(uid, role, name, ctx, is_sub_admin=False, perms=None):
    """
    Create the Flask-Login session for a successfully authenticated and
    context-authorised account.  The validated context is stored in the
    session payload — this is the single source of truth used by every
    subsequent request (spec §13).
    """
    perms = perms or []

    # Start from an empty session so nothing from a previous (or forged)
    # session can survive into this one.  The password is never stored.
    session.clear()

    user = User(uid, role, name, is_sub_admin, perms, context=ctx)
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


@auth_bp.route("/api/login", methods=["POST"])
def api_login():
    data     = request.get_json(silent=True) or {}
    role     = str(data.get("role") or "").strip().lower()
    username = str(data.get("username") or "").strip()
    password = str(data.get("password") or "")

    if not role or not username or not password.strip():
        return _fail("All fields required", 400)
    if role not in {"admin", "teacher", "student"}:
        # The role decides which table is searched — nothing more.  An
        # unknown one is a malformed request, not a hint about anything.
        return _fail("Invalid role", 400)

    # ── STEP 1: validate the CLAIMED institution context server-side ──
    # A browser can send any department/campus it likes; only what the
    # database recognises (and is active) becomes a context.
    ctx, ctx_err = resolve_context(data.get("department"), data.get("campus"))
    if ctx_err:
        return jsonify({"success": False, "error": ctx_err, "contextError": True}), 400

    # ── STEP 2-6: identify → password → status → role → dept → campus ──
    if role == "admin":
        # The principal is a single institution-wide account: it administers
        # every department, one context at a time, and owns no context row of
        # its own.  Every *other* admin is a sub-admin scoped to one
        # institution and goes through the same checks as a teacher.
        if username == "admin":
            cfg = query("SELECT password_hash FROM admin_config LIMIT 1", one=True)
            if _verify(cfg, password):
                return _finish_login("admin", "admin", "Admin / Principal", ctx)
            return _fail(INVALID_CREDENTIALS)

        rows = query("SELECT * FROM sub_admins WHERE username=%s", (username,))
        sa, err = _authenticate(rows, password, ctx)
        if err:
            return _fail(err, 403 if err in (CONTEXT_DENIED, ACCOUNT_DISABLED) else 401)
        return _finish_login(sa["id"], "admin", sa["name"], ctx,
                             is_sub_admin=True,
                             perms=parse_permissions(sa["permissions"]))

    table = "teachers" if role == "teacher" else "students"
    rows  = query(f"SELECT * FROM {table} WHERE id=%s", (username,))
    row, err = _authenticate(rows, password, ctx)
    if err:
        return _fail(err, 403 if err in (CONTEXT_DENIED, ACCOUNT_DISABLED) else 401)
    return _finish_login(row["id"], role, row["name"], ctx)


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
