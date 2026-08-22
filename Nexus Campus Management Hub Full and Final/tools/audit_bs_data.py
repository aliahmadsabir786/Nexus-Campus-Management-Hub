"""
tools/audit_bs_data.py  —  read-only dump of the rows that matter for the
BS academic architecture audit.  ASCII output only (cp1252 console).
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import query  # noqa: E402


def show(title, rows):
    print("\n" + "-" * 68)
    print("  " + title)
    print("-" * 68)
    if not rows:
        print("  (none)")
        return
    keys = list(rows[0].keys())
    print("  " + " | ".join(keys))
    for r in rows:
        print("  " + " | ".join("" if r[k] is None else str(r[k])[:40] for k in keys))


show("departments", query("SELECT id,name,code,has_campuses,status FROM departments ORDER BY id"))
show("campuses", query("SELECT id,department_id,name,code,status FROM campuses ORDER BY id"))
show("classes", query(
    "SELECT c.id,c.name,c.code,c.department_id,c.campus_id,c.status,"
    "(SELECT COUNT(*) FROM sections s WHERE s.class_id=c.id) AS sections,"
    "(SELECT COUNT(*) FROM students st WHERE st.class_id=c.id) AS students "
    "FROM classes c ORDER BY c.department_id, c.id"))
show("sections", query(
    "SELECT s.id,s.class_id,c.code AS class_code,s.name,s.capacity,s.room,"
    "(SELECT COUNT(*) FROM students st WHERE st.section_id=s.id) AS students "
    "FROM sections s JOIN classes c ON c.id=s.class_id ORDER BY s.class_id,s.id"))
show("students (BS only)", query(
    "SELECT st.id,st.name,st.cls,st.class_id,st.section_id,st.subject_group,st.roll_no "
    "FROM students st JOIN departments d ON d.id=st.department_id "
    "WHERE d.code='BS' ORDER BY st.id"))
show("teachers (BS only)", query(
    "SELECT t.id,t.name,t.subject,t.dept,t.class_id,t.section_id "
    "FROM teachers t JOIN departments d ON d.id=t.department_id "
    "WHERE d.code='BS' ORDER BY t.id"))
show("teacher_assignments", query(
    "SELECT ta.id,ta.teacher_id,t.name AS teacher,ta.class_id,c.code AS class_code,"
    "ta.section_id,ta.subject_id,c.department_id "
    "FROM teacher_assignments ta "
    "LEFT JOIN teachers t ON t.id=ta.teacher_id "
    "LEFT JOIN classes c ON c.id=ta.class_id ORDER BY ta.id"))
show("grades (distinct subjects)", query(
    "SELECT subject, COUNT(*) AS n FROM grades GROUP BY subject ORDER BY subject"))
show("attendance sample", query("SELECT * FROM attendance ORDER BY id LIMIT 5"))
