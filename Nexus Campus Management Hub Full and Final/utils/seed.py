"""
utils/seed.py  —  Seed sample passwords at startup
"""

from werkzeug.security import generate_password_hash, check_password_hash
from db import query

PLACEHOLDER = "pbkdf2:sha256:placeholder"


def seed_sample_passwords():
    """Hash sample data passwords on first run — also fixes wrong hashes."""

    # Admin (admin123)
    cfg = query("SELECT * FROM admin_config LIMIT 1", one=True)
    if not cfg:
        query(
            "INSERT INTO admin_config (password_hash) VALUES (%s)",
            (generate_password_hash("admin123"),), commit=True
        )
    elif not check_password_hash(cfg["password_hash"], "admin123"):
        # Hash is wrong or placeholder — reset to correct one
        query(
            "UPDATE admin_config SET password_hash=%s WHERE id=%s",
            (generate_password_hash("admin123"), cfg["id"]), commit=True
        )

    # Students (password: 1234)
    for s in query("SELECT id, password_hash FROM students"):
        if s["password_hash"] == PLACEHOLDER or not check_password_hash(s["password_hash"], "1234"):
            # Only reset if it's a placeholder (don't overwrite custom passwords)
            if s["password_hash"] == PLACEHOLDER:
                query(
                    "UPDATE students SET password_hash=%s WHERE id=%s",
                    (generate_password_hash("1234"), s["id"]), commit=True
                )

    # Teachers (teach1 ... teach5) — fix placeholder AND wrong hashes
    teachers = query("SELECT id, password_hash FROM teachers ORDER BY id")
    for i, t in enumerate(teachers, 1):
        expected_pwd = f"teach{i}"
        is_placeholder = t["password_hash"] == PLACEHOLDER
        # Try to verify; if it fails, the hash is wrong — reset it
        try:
            hash_correct = check_password_hash(t["password_hash"], expected_pwd)
        except Exception:
            hash_correct = False

        if is_placeholder or not hash_correct:
            query(
                "UPDATE teachers SET password_hash=%s WHERE id=%s",
                (generate_password_hash(expected_pwd), t["id"]), commit=True
            )
            print(f"[seed] Fixed password for teacher {t['id']} → {expected_pwd}")

    print("[seed] Sample passwords initialised.")
