"""
utils/audit.py  —  generic audit-log helper (spec §27).

One function, used the same way from any route that performs a sensitive
write (marks overrides, promotion, admin corrections): record who did it,
what changed, and when. Never blocks the primary write — logging failures
are swallowed (and printed) rather than turning a successful save into a
500 for the person using the app.
"""

import json

from flask_login import current_user

from db import query


def _actor():
    """Best-effort (id, name, role) for whoever is signed in, or all None
    when called outside a request context (e.g. a script/seed)."""
    try:
        if not current_user or not getattr(current_user, "is_authenticated", False):
            return None, None, None
        return (
            str(getattr(current_user, "id", "")) or None,
            getattr(current_user, "name", None),
            getattr(current_user, "role", None),
        )
    except Exception:
        return None, None, None


def _ctx():
    """Best-effort (department_id, campus_id) from the current session."""
    try:
        from utils.context import write_context
        return write_context()
    except Exception:
        return None, None


def write_audit_log(action, entity_type, entity_id=None, student_id=None,
                     old_value=None, new_value=None):
    """
    Record one audit-log row.

    ``old_value`` / ``new_value`` may be any JSON-serialisable value (a
    plain string like a grade, or a dict of several fields) — both are
    stored as JSON text so the admin audit-log view can render either
    shape without a schema change.
    """
    actor_id, actor_name, actor_role = _actor()
    dept_id, campus_id = _ctx()
    try:
        query("""
            INSERT INTO audit_logs
                (actor_id, actor_name, actor_role, action, entity_type, entity_id,
                 student_id, old_value, new_value, department_id, campus_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            actor_id, actor_name, actor_role, action, entity_type,
            str(entity_id) if entity_id is not None else None,
            student_id,
            json.dumps(old_value) if old_value is not None else None,
            json.dumps(new_value) if new_value is not None else None,
            dept_id, campus_id,
        ), commit=True)
    except Exception as e:
        # An audit-log write failing must never roll back or mask the
        # actual action that already succeeded.
        print(f"[warn] audit log write failed: {e}")


def safe_audit_log(r):
    def _load(raw):
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return raw

    return {
        "id":         r["id"],
        "actorId":    r.get("actor_id") or "",
        "actorName":  r.get("actor_name") or "",
        "actorRole":  r.get("actor_role") or "",
        "action":     r["action"],
        "entityType": r["entity_type"],
        "entityId":   r.get("entity_id") or "",
        "studentId":  r.get("student_id") or "",
        "oldValue":   _load(r.get("old_value")),
        "newValue":   _load(r.get("new_value")),
        "createdAt":  str(r.get("created_at") or ""),
    }