"""
utils/seed_institutions.py  —  Sample data for the Intermediate campuses
=======================================================================
Creates a small, clearly-labelled data set for

    Intermediate Department → Boys Campus
    Intermediate Department → Girls Campus

so the campus separation can be demonstrated and tested immediately.
Existing BS records are never touched: migration 001 already re-associated
them with the BS department.

Rules honoured here
-------------------
* Passwords go through the project's existing hashing helper
  (``werkzeug.security.generate_password_hash``) — never plain text.
* Fully idempotent: every insert is guarded by an existence check, so
  running this on every startup neither duplicates nor overwrites data.
  A password that an administrator later changed is left alone.
* IDs are deliberately distinguishable from the legacy BS records
  (BS: ``S001`` / ``T001``  ·  Boys: ``INT-B-001`` / ``ITB-001``
   ·  Girls: ``INT-G-001`` / ``ITG-001``).
* Every row is written with its ``department_id`` / ``campus_id`` so the
  backend context filters isolate it correctly.
"""

from datetime import datetime

from werkzeug.security import generate_password_hash

from config import CAMPUS_BOYS, CAMPUS_GIRLS, DEPT_INTER, TODAY
from db import query

STUDENT_PWD = "1234"
TEACHER_PWD = "teach123"


# ================================================================
# CONTEXT LOOKUP
# ================================================================
def _context_ids():
    """Return {campus_code: (department_id, campus_id)} for Intermediate."""
    dept = query("SELECT id FROM departments WHERE code=%s", (DEPT_INTER,), one=True)
    if not dept:
        return {}
    out = {}
    for code in (CAMPUS_BOYS, CAMPUS_GIRLS):
        cp = query(
            "SELECT id FROM campuses WHERE code=%s AND department_id=%s",
            (code, dept["id"]), one=True
        )
        if cp:
            out[code] = (dept["id"], cp["id"])
    return out


# ================================================================
# IDEMPOTENT UPSERT HELPERS
# ================================================================
def _ensure_class(dept_id, campus_id, name, code, description):
    """Return (class_id, created_now)."""
    row = query(
        "SELECT id FROM classes WHERE code=%s AND department_id=%s AND campus_id=%s",
        (code, dept_id, campus_id), one=True
    )
    if row:
        return row["id"], False
    query(
        """INSERT INTO classes (name, code, description, status, department_id, campus_id)
           VALUES (%s,%s,%s,'active',%s,%s)""",
        (name, code, description, dept_id, campus_id), commit=True
    )
    row = query(
        "SELECT id FROM classes WHERE code=%s AND department_id=%s AND campus_id=%s",
        (code, dept_id, campus_id), one=True
    )
    return (row["id"] if row else None), True


def _ensure_section(class_id, name, room, capacity=40):
    """Return (section_id, created_now)."""
    row = query(
        "SELECT id FROM sections WHERE class_id=%s AND name=%s",
        (class_id, name), one=True
    )
    if row:
        return row["id"], False
    query(
        "INSERT INTO sections (class_id, name, capacity, room) VALUES (%s,%s,%s,%s)",
        (class_id, name, capacity, room), commit=True
    )
    row = query(
        "SELECT id FROM sections WHERE class_id=%s AND name=%s",
        (class_id, name), one=True
    )
    return (row["id"] if row else None), True


def _ensure_teacher(tid, name, subject, dept_label, qualification, phone, email,
                    class_id, section_id, dept_id, campus_id):
    if query("SELECT id FROM teachers WHERE id=%s", (tid,), one=True):
        return False
    query(
        """INSERT INTO teachers
           (id, name, subject, dept, qualification, phone, email, join_date,
            password_hash, portal, class_id, section_id, department_id, campus_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,%s,%s)""",
        (tid, name, subject, dept_label, qualification, phone, email, TODAY,
         generate_password_hash(TEACHER_PWD), class_id, section_id, dept_id, campus_id),
        commit=True
    )
    return True


def _ensure_assignment(tid, class_id, section_id, subject):
    row = query(
        """SELECT id FROM teacher_assignments
           WHERE teacher_id=%s AND class_id=%s AND section_id=%s AND subject_id=%s""",
        (tid, class_id, section_id, subject), one=True
    )
    if row:
        return
    query(
        """INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject_id)
           VALUES (%s,%s,%s,%s)""",
        (tid, class_id, section_id, subject), commit=True
    )


def _ensure_student(sid, name, cls, subject_group, roll_no, phone, guardian_phone,
                    email, fee_status, dob, class_id, section_id, dept_id, campus_id):
    if query("SELECT id FROM students WHERE id=%s", (sid,), one=True):
        return False
    query(
        """INSERT INTO students
           (id, name, cls, subject_group, roll_no, phone, guardian_phone, email,
            fee_status, dob, password_hash, portal, class_id, section_id,
            department_id, campus_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,%s,%s)""",
        (sid, name, cls, subject_group, roll_no, phone, guardian_phone, email,
         fee_status, dob, generate_password_hash(STUDENT_PWD),
         class_id, section_id, dept_id, campus_id),
        commit=True
    )
    # Opening fee voucher — mirrors routes/students.py behaviour
    try:
        query(
            """INSERT INTO fee_vouchers (student_id, month, amount, due_date, status, voucher_no)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (sid, datetime.today().strftime("%B %Y"), 12000, TODAY,
             "paid" if fee_status == "paid" else "pending", f"V001-{sid}"),
            commit=True
        )
    except Exception:
        pass
    return True


def _ensure_grade(sid, subject, midterm, final_marks, internal):
    query(
        """INSERT INTO grades (student_id, subject, midterm, final_marks, internal)
           VALUES (%s,%s,%s,%s,%s)
           ON DUPLICATE KEY UPDATE student_id=student_id""",
        (sid, subject, midterm, final_marks, internal), commit=True
    )


def _ensure_attendance(sid, date_str, status, marked_by):
    query(
        """INSERT INTO attendance (student_id, date, status, marked_by)
           VALUES (%s,%s,%s,%s)
           ON DUPLICATE KEY UPDATE student_id=student_id""",
        (sid, date_str, status, marked_by), commit=True
    )


# ================================================================
# CAMPUS DATA SETS
# ================================================================
# Same class structure on both campuses — identical modules, isolated data.
_CLASS_PLAN = [
    ("FSc Pre-Medical",     "FSC-PM", "Intermediate Pre-Medical group",     ["A", "B"]),
    ("FSc Pre-Engineering", "FSC-PE", "Intermediate Pre-Engineering group", ["A"]),
    ("ICS",                 "ICS",    "Intermediate in Computer Science",   ["A"]),
]

_CAMPUS_DATA = {
    CAMPUS_BOYS: {
        "label": "Boys Campus",
        "room_prefix": "B",
        "teachers": [
            ("ITB-001", "Kamran Yousaf", "Physics",          "Science",  "MSc Physics",  "0301-4455661", "kamran.yousaf@nexus.edu.pk", "FSC-PM", "A"),
            ("ITB-002", "Adeel Raza",    "Computer Science", "Computer", "MCS",          "0301-4455662", "adeel.raza@nexus.edu.pk",    "ICS",    "A"),
        ],
        "assignments": [
            ("ITB-001", "FSC-PM", "A", "Physics"),
            ("ITB-001", "FSC-PM", "B", "Physics"),
            ("ITB-001", "FSC-PE", "A", "Physics"),
            ("ITB-002", "ICS",    "A", "Computer Science"),
        ],
        "students": [
            ("INT-B-001", "Bilal Ahmed",  "FSC-PM-A", "Medical",          "01", "0311-2200101", "0300-9900101", "bilal.ahmed@nexus.edu.pk",  "paid",    "2007-04-12", "FSC-PM", "A"),
            ("INT-B-002", "Hamza Iqbal",  "FSC-PM-A", "Medical",          "02", "0311-2200102", "0300-9900102", "hamza.iqbal@nexus.edu.pk",  "pending", "2007-08-03", "FSC-PM", "A"),
            ("INT-B-003", "Usman Ali",    "FSC-PE-A", "Non-Medical",      "01", "0311-2200103", "0300-9900103", "usman.ali@nexus.edu.pk",    "paid",    "2007-01-27", "FSC-PE", "A"),
            ("INT-B-004", "Zohaib Nawaz", "ICS-A",    "Computer Science", "01", "0311-2200104", "0300-9900104", "zohaib.nawaz@nexus.edu.pk", "pending", "2006-11-19", "ICS",    "A"),
        ],
        "grades": [
            ("INT-B-001", "Physics",          38, 40, 15),
            ("INT-B-001", "Biology",          35, 42, 14),
            ("INT-B-002", "Physics",          28, 33, 11),
            ("INT-B-003", "Physics",          33, 38, 13),
            ("INT-B-004", "Computer Science", 40, 44, 15),
        ],
        "attendance": [
            ("INT-B-001", "present"), ("INT-B-002", "absent"),
            ("INT-B-003", "present"), ("INT-B-004", "present"),
        ],
    },
    CAMPUS_GIRLS: {
        "label": "Girls Campus",
        "room_prefix": "G",
        "teachers": [
            ("ITG-001", "Ayesha Siddiqui", "Biology",   "Science", "MPhil Botany", "0302-5566771", "ayesha.siddiqui@nexus.edu.pk", "FSC-PM", "A"),
            ("ITG-002", "Hina Tariq",      "Chemistry", "Science", "MSc Chemistry", "0302-5566772", "hina.tariq@nexus.edu.pk",     "FSC-PM", "B"),
        ],
        "assignments": [
            ("ITG-001", "FSC-PM", "A", "Biology"),
            ("ITG-001", "FSC-PM", "B", "Biology"),
            ("ITG-002", "FSC-PM", "A", "Chemistry"),
            ("ITG-002", "FSC-PE", "A", "Chemistry"),
        ],
        "students": [
            ("INT-G-001", "Ayesha Khan",   "FSC-PM-A", "Medical",          "01", "0312-3300201", "0300-9900201", "ayesha.khan@nexus.edu.pk",   "paid",    "2007-06-22", "FSC-PM", "A"),
            ("INT-G-002", "Fatima Noor",   "FSC-PM-B", "Medical",          "01", "0312-3300202", "0300-9900202", "fatima.noor@nexus.edu.pk",   "paid",    "2007-02-14", "FSC-PM", "B"),
            ("INT-G-003", "Zainab Malik",  "FSC-PE-A", "Non-Medical",      "01", "0312-3300203", "0300-9900203", "zainab.malik@nexus.edu.pk",  "pending", "2006-12-05", "FSC-PE", "A"),
            ("INT-G-004", "Maryam Shafiq", "ICS-A",    "Computer Science", "01", "0312-3300204", "0300-9900204", "maryam.shafiq@nexus.edu.pk", "paid",    "2007-09-30", "ICS",    "A"),
        ],
        "grades": [
            ("INT-G-001", "Biology",   42, 45, 15),
            ("INT-G-001", "Chemistry", 37, 41, 14),
            ("INT-G-002", "Biology",   30, 36, 12),
            ("INT-G-003", "Chemistry", 34, 39, 13),
            ("INT-G-004", "Biology",   39, 43, 14),
        ],
        "attendance": [
            ("INT-G-001", "present"), ("INT-G-002", "present"),
            ("INT-G-003", "late"),    ("INT-G-004", "present"),
        ],
    },
}


# ================================================================
# ENTRY POINT
# ================================================================
def seed_institution_samples(verbose=True):
    """
    Create the Intermediate Boys / Girls sample data set.
    Returns a short summary dict; safe to call on every startup.
    """
    ctx = _context_ids()
    if not ctx:
        if verbose:
            print("[seed] Intermediate department not found - run the migration first.")
        return {}

    summary = {}
    for campus_code, data in _CAMPUS_DATA.items():
        if campus_code not in ctx:
            continue
        dept_id, campus_id = ctx[campus_code]
        created = {"classes": 0, "sections": 0, "teachers": 0, "students": 0}

        # ── Classes + sections ────────────────────────────────────
        class_ids   = {}   # code            → class id
        section_ids = {}   # (code, secName) → section id
        for name, code, desc, sections in _CLASS_PLAN:
            cid, is_new = _ensure_class(dept_id, campus_id, name, code, desc)
            if not cid:
                continue
            class_ids[code] = cid
            if is_new:
                created["classes"] += 1
            for idx, sec_name in enumerate(sections, 1):
                sid, sec_new = _ensure_section(
                    cid, sec_name, f"{data['room_prefix']}-{code}-{idx}", 40
                )
                if sid:
                    section_ids[(code, sec_name)] = sid
                    if sec_new:
                        created["sections"] += 1

        # ── Teachers ──────────────────────────────────────────────
        for tid, tname, subject, tdept, qual, phone, email, cls_code, sec in data["teachers"]:
            if _ensure_teacher(
                tid, tname, subject, tdept, qual, phone, email,
                class_ids.get(cls_code), section_ids.get((cls_code, sec)),
                dept_id, campus_id
            ):
                created["teachers"] += 1

        # ── Teacher ↔ class/section/subject assignments ───────────
        for tid, cls_code, sec, subject in data["assignments"]:
            cid = class_ids.get(cls_code)
            sid = section_ids.get((cls_code, sec))
            if cid and sid:
                _ensure_assignment(tid, cid, sid, subject)

        # ── Students ──────────────────────────────────────────────
        for (sid_, sname, cls, group, roll, phone, gphone, email,
             fee, dob, cls_code, sec) in data["students"]:
            if _ensure_student(
                sid_, sname, cls, group, roll, phone, gphone, email, fee, dob,
                class_ids.get(cls_code), section_ids.get((cls_code, sec)),
                dept_id, campus_id
            ):
                created["students"] += 1

        # ── A little academic history so dashboards are meaningful ─
        for sid_, subject, mid, fin, internal in data["grades"]:
            try:
                _ensure_grade(sid_, subject, mid, fin, internal)
            except Exception:
                pass
        for sid_, status in data["attendance"]:
            try:
                _ensure_attendance(sid_, TODAY, status, "seed")
            except Exception:
                pass

        summary[campus_code] = created
        if verbose and any(created.values()):
            print(f"[seed] Intermediate/{data['label']}: "
                  f"+{created['classes']} classes, +{created['sections']} sections, "
                  f"+{created['teachers']} teachers, +{created['students']} students")

    if verbose:
        print("[seed] Intermediate sample data ready "
              f"(students: {STUDENT_PWD}, teachers: {TEACHER_PWD}).")
    return summary
