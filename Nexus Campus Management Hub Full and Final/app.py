"""
app.py  —  NEXus Solution CMS — Entry Point
"""

from flask import Flask, render_template
from config import SECRET_KEY, SESSION_PERMANENT, PERMANENT_SESSION_LIFETIME
from utils.auth import login_manager

from routes.auth        import auth_bp
from routes.students    import students_bp
from routes.teachers    import teachers_bp
from routes.attendance  import attendance_bp
from routes.academics   import academics_bp
from routes.fees        import fees_bp
from routes.assignments import assignments_bp
from routes.admin       import admin_bp
from routes.classes     import classes_bp


def create_app():
    app = Flask(__name__)
    app.secret_key                           = SECRET_KEY
    app.config["SESSION_PERMANENT"]          = SESSION_PERMANENT
    app.config["PERMANENT_SESSION_LIFETIME"] = PERMANENT_SESSION_LIFETIME
    app.config["MAX_CONTENT_LENGTH"]         = 10 * 1024 * 1024   # 10 MB

    login_manager.init_app(app)

    for bp in [auth_bp, students_bp, teachers_bp, attendance_bp,
               academics_bp, fees_bp, assignments_bp, admin_bp, classes_bp]:
        app.register_blueprint(bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    return app


app = create_app()

if __name__ == "__main__":
    from utils.seed import seed_sample_passwords
    print("=" * 62)
    print("  NEXus Solution — College Management System")
    print("  Flask + MySQL  |  http://127.0.0.1:5000")
    print("=" * 62)
    try:
        seed_sample_passwords()
    except Exception as e:
        print(f"[warn] Seed skipped: {e}")
    app.run(debug=True, port=5000)
