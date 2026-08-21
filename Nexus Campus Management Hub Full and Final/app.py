"""
app.py  —  NEXus Solution CMS — Entry Point

One application, one codebase, one implementation of every module.
The institution hierarchy (BS Department / Intermediate → Boys · Girls) is
handled by context-aware data isolation, not by duplicated modules —
see utils/context.py.
"""

from flask import Flask, render_template
from config import SECRET_KEY, SESSION_PERMANENT, PERMANENT_SESSION_LIFETIME
from utils.auth import login_manager
from utils.context import install_api_guard

from routes.auth         import auth_bp
from routes.students     import students_bp
from routes.teachers     import teachers_bp
from routes.attendance   import attendance_bp
from routes.academics    import academics_bp
from routes.fees         import fees_bp
from routes.assignments  import assignments_bp
from routes.admin        import admin_bp
from routes.classes      import classes_bp
from routes.institutions import institutions_bp


def create_app():
    app = Flask(__name__)
    app.secret_key                           = SECRET_KEY
    app.config["SESSION_PERMANENT"]          = SESSION_PERMANENT
    app.config["PERMANENT_SESSION_LIFETIME"] = PERMANENT_SESSION_LIFETIME
    app.config["MAX_CONTENT_LENGTH"]         = 10 * 1024 * 1024   # 10 MB

    # Session cookie hardening.  The session is where the validated
    # department/campus lives, so it must not be readable by scripts or
    # sent along with a cross-site request.
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    login_manager.init_app(app)

    for bp in [auth_bp, students_bp, teachers_bp, attendance_bp,
               academics_bp, fees_bp, assignments_bp, admin_bp, classes_bp,
               institutions_bp]:
        app.register_blueprint(bp)

    # Refuse every /api/ request that has no authenticated session with a
    # validated institution context, before it reaches a route.  The
    # per-route decorators stay in place; this is the single choke point
    # that makes a forgotten decorator harmless (spec §10).
    install_api_guard(app)

    @app.after_request
    def _security_headers(resp):
        # Cheap, dependency-free hardening for the responses this app serves.
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        if resp.mimetype == "application/json":
            # Never let a browser or proxy keep a copy of institution data.
            resp.headers.setdefault("Cache-Control", "no-store")
        return resp

    @app.route("/")
    def index():
        return render_template("index.html")

    return app


app = create_app()

if __name__ == "__main__":
    import os

    from utils.migrate import run_migrations
    from utils.seed import seed_sample_passwords
    from utils.seed_institutions import seed_institution_samples

    # 5000 stays the default; PORT lets a second instance run alongside it
    # (handy when one copy is already serving on 5000).
    port = int(os.environ.get("PORT", 5000))

    print("=" * 62)
    print("  NEXus Solution - Campus Management Hub")
    print("  BS Department  |  Intermediate -> Boys - Girls Campus")
    print(f"  Flask + MySQL  |  http://127.0.0.1:{port}")
    print("=" * 62)

    # Additive, idempotent schema migrations — never destructive.
    try:
        run_migrations()
    except Exception as e:
        print(f"[warn] Migration skipped: {e}")

    try:
        seed_sample_passwords()
    except Exception as e:
        print(f"[warn] Seed skipped: {e}")

    # Sample Intermediate Boys / Girls records (hashed passwords only)
    try:
        seed_institution_samples()
    except Exception as e:
        print(f"[warn] Institution seed skipped: {e}")

    app.run(debug=True, port=port)
