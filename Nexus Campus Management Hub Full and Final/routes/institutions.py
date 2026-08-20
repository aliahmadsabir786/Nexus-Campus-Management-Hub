"""
routes/institutions.py  —  Department / Campus selection endpoints
=================================================================
  GET  /api/institutions      → department + campus tree (public, pre-login)
  GET  /api/context           → the caller's validated context
  POST /api/context/switch    → securely switch context (forces re-login)

The selection screens are the only thing these endpoints feed.  Choosing a
department or campus here grants NOTHING by itself: access is decided when
/api/login validates the claim against the database and against the
account's own department/campus (utils/context.py).
"""

from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_required, logout_user

from utils.context import list_institutions, public_context, resolve_context

institutions_bp = Blueprint("institutions", __name__)


@institutions_bp.route("/api/institutions", methods=["GET"])
def api_institutions():
    """
    Public reference data for the Department / Campus selection screens:
    names, short descriptions, logo paths and whether a campus must be
    chosen.  Deliberately contains no record counts or user data.
    """
    return jsonify(list_institutions())


@institutions_bp.route("/api/context", methods=["GET"])
@login_required
def api_context():
    """The authenticated caller's context — used for labels and badges."""
    return jsonify({"context": public_context()})


@institutions_bp.route("/api/context/switch", methods=["POST"])
@login_required
def api_context_switch():
    """
    Switch to another department/campus.

    Switching is NEVER a client-side toggle: the requested context is
    validated, the current session is destroyed, and the user must
    authenticate again inside the new context (spec §19).
    """
    data = request.get_json() or {}
    ctx, err = resolve_context(data.get("department"), data.get("campus"))
    if err:
        return jsonify({"success": False, "error": err}), 400

    logout_user()
    session.clear()

    # Only the *labels* of the requested context are returned; the browser
    # still has to log in, and /api/login re-validates everything.
    return jsonify({
        "success": True,
        "requiresLogin": True,
        "target": {
            "department":     ctx["department"],
            "departmentCode": ctx["department_code"],
            "departmentName": ctx["department_name"],
            "campus":         ctx["campus"],
            "campusName":     ctx["campus_name"],
            "label":          ctx["label"],
        },
    })
