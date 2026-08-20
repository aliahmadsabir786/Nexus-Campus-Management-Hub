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

    login_manager.init_app(app)

    for bp in [auth_bp, students_bp, teachers_bp, attendance_bp,
               academics_bp, fees_bp, assignments_bp, admin_bp, classes_bp,
               institutions_bp]:
        app.register_blueprint(bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    return app


app = create_app()

if __name__ == "__main__":
    from utils.migrate import run_migrations
    from utils.seed import seed_sample_passwords
    from utils.seed_institutions import seed_institution_samples

    print("=" * 62)
    print("  NEXus Solution - Campus Management Hub")
    print("  BS Department  |  Intermediate -> Boys - Girls Campus")
    print("  Flask + MySQL  |  http://127.0.0.1:5000")
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

    app.run(debug=True, port=5000)
