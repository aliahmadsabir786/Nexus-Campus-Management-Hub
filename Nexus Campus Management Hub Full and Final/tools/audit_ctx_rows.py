import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
from db import query
app = create_app()
with app.app_context():
    for t in ("classes","exams","assignments","notices"):
        print("== %s ==" % t)
        for r in query("SELECT id, department_id, campus_id, %s FROM %s ORDER BY department_id, campus_id, id"
                       % ("name" if t in ("classes",) else ("title" if t in ("exams","assignments","notices") else "id"), t)):
            print("   ", r)
    print("== sections (inherit via classes) ==")
    for r in query("SELECT s.id, s.name, s.class_id, c.department_id, c.campus_id FROM sections s JOIN classes c ON c.id=s.class_id ORDER BY c.campus_id, s.id"):
        print("   ", r)
    print("== fee_vouchers sample ==")
    for r in query("SELECT student_id, month, status FROM fee_vouchers LIMIT 6"):
        print("   ", r)
