"""
utils/seed_bs_academic.py  —  BS academic architecture: migration + demo data
=============================================================================
Two jobs, both idempotent, both purely additive:

1. BACKFILL.  Link the BS students that already exist to the new
   program / batch / curriculum model.  Nothing is deleted, renamed or
   re-created, and a student an administrator has already assigned by hand
   is left exactly as they found it (spec §36, §37).

2. DEMONSTRATION.  Lay down the scenario the specification asks for in
   §40 so the architecture can be inspected the moment the app starts:

       Program            BS Computer Science
       Curriculum         BSCS Curriculum 2026
         Semester 1       Programming Fundamentals · Calculus · ICT
         Semester 2       OOP · Statistics
       Batch              BSCS 2026
       Session            Fall 2027
       Offerings          Programming Fundamentals @ ACTUAL semester 2
                          (its curriculum recommendation is semester 1 —
                           and the curriculum is NOT edited to say so)
                          OOP @ ACTUAL semester 2
       Sections           A and B for each offering
       Teachers           a different teacher per section, and one teacher
                          holding sections of two different courses
       Enrollment         students placed in sections, and the same student
                          deliberately NOT placed in two sections of the
                          same offering

Why the seed is Python and not SQL
----------------------------------
Migration 003 creates structure only.  This data has to look up IDs, honour
the same business rules the API enforces, and skip anything already present —
control flow that an idempotent .sql file cannot express cleanly.

The scenario reuses the department's REAL students and teachers instead of
inventing "Ahmed / Sara / Ali" rows.  Fabricated people in a live roster
would be worse than a slightly different set of names, and the relationships
being demonstrated are identical either way.
"""

from db import query

# The demonstration courses.  (code, name, credit hours, type, recommended
# semester in the 2026 curriculum, classification)
_COURSES = [
    ("CS-101",   "Programming Fundamentals", 4, "theory", 1, "core"),
    ("MATH-101", "Calculus",                 3, "theory", 1, "university"),
    ("ICT-101",  "Introduction to ICT",      3, "theory", 1, "university"),
    ("CS-201",   "Object Oriented Programming", 4, "theory", 2, "core"),
    ("STAT-201", "Statistics and Probability",  3, "theory", 2, "department"),
]

# Two electives, so the elective-group machinery has something real in it
# (spec §21, Rule 11).  Both sit in semester 5 of the same group; the group
# requires one of them.
_ELECTIVES = [
    ("CS-501", "Artificial Intelligence", 3, "theory", 5, "elective", "CS Elective I"),
    ("CS-502", "Computer Graphics",       3, "theory", 5, "elective", "CS Elective I"),
]

PROGRAM_CODE  = "BSCS"
PROGRAM_NAME  = "BS Computer Science"
CURRICULUM    = ("BSCS Curriculum 2026", 2026)
BATCH_NAME    = "BSCS 2026"
ADMIT_SESSION = ("Fall 2026", "Fall", "2026-2027", "2026-09-01", "2027-01-31", "completed")
DEMO_SESSION  = ("Fall 2027", "Fall", "2027-2028", "2027-09-01", "2028-01-31", "active")


# ================================================================
# CONTEXT
# ================================================================
def _bs_context():
    """``(department_id, campus_id)`` for the BS department, or ``(None, None)``."""
    dept = query("SELECT id FROM departments WHERE code='BS'", one=True)
    if not dept:
        return None, None
    campus = query(
        "SELECT id FROM campuses WHERE department_id=%s ORDER BY id LIMIT 1",
        (dept["id"],), one=True
    )
    return dept["id"], (campus["id"] if campus else None)


# ================================================================
# IDEMPOTENT UPSERTS  —  each returns the row id, creating only if absent
# ================================================================
def _ensure_program(dept_id, campus_id):
    row = query("SELECT id FROM bs_programs WHERE code=%s AND department_id=%s",
                (PROGRAM_CODE, dept_id), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_programs
            (name, code, degree_type, duration_years, total_semesters,
             required_credit_hours, status, department_id, campus_id)
        VALUES (%s,%s,'BS',4.0,8,133,'active',%s,%s)
    """, (PROGRAM_NAME, PROGRAM_CODE, dept_id, campus_id), commit=True), True


def _ensure_session(dept_id, campus_id, spec):
    name, term, year, start, end, status = spec
    row = query("SELECT id FROM bs_academic_sessions WHERE name=%s AND department_id=%s",
                (name, dept_id), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_academic_sessions
            (name, term, academic_year, start_date, end_date, status,
             department_id, campus_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (name, term, year, start, end, status, dept_id, campus_id), commit=True), True


def _ensure_course(dept_id, campus_id, code, name, ch, ctype):
    """
    A course carries NO semester — that is the whole point of the design
    (spec Rule 1).  The semester lives on the curriculum entry and on the
    offering, never here.
    """
    row = query("SELECT id FROM bs_courses WHERE code=%s AND department_id=%s",
                (code, dept_id), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_courses
            (code, name, credit_hours, course_type, status, department_id, campus_id)
        VALUES (%s,%s,%s,%s,'active',%s,%s)
    """, (code, name, ch, ctype, dept_id, campus_id), commit=True), True


def _ensure_curriculum(dept_id, campus_id, program_id):
    name, year = CURRICULUM
    row = query("SELECT id FROM bs_curriculums WHERE program_id=%s AND version_year=%s",
                (program_id, year), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_curriculums
            (program_id, name, version_year, status, is_default, department_id, campus_id)
        VALUES (%s,%s,%s,'active',1,%s,%s)
    """, (program_id, name, year, dept_id, campus_id), commit=True), True


def _ensure_curriculum_course(curriculum_id, course_id, semester, classification,
                              credit_hours, elective_group=None):
    row = query("""SELECT id FROM bs_curriculum_courses
                   WHERE curriculum_id=%s AND course_id=%s""",
                (curriculum_id, course_id), one=True)
    if row:
        return row["id"], False
    compulsory = 0 if classification == "elective" else 1
    return query("""
        INSERT INTO bs_curriculum_courses
            (curriculum_id, course_id, recommended_semester, classification,
             is_compulsory, elective_group, credit_hours)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (curriculum_id, course_id, semester, classification, compulsory,
          elective_group, credit_hours), commit=True), True


def _ensure_elective_group(curriculum_id, semester, name, required):
    row = query("""SELECT id FROM bs_elective_groups
                   WHERE curriculum_id=%s AND semester=%s AND name=%s""",
                (curriculum_id, semester, name), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_elective_groups (curriculum_id, semester, name, required_courses)
        VALUES (%s,%s,%s,%s)
    """, (curriculum_id, semester, name, required), commit=True), True


def _ensure_batch(dept_id, campus_id, program_id, curriculum_id, admit_session_id):
    row = query("SELECT id FROM bs_batches WHERE name=%s AND department_id=%s",
                (BATCH_NAME, dept_id), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_batches
            (program_id, curriculum_id, admission_session_id, name, current_semester,
             status, department_id, campus_id)
        VALUES (%s,%s,%s,%s,2,'active',%s,%s)
    """, (program_id, curriculum_id, admit_session_id, BATCH_NAME,
          dept_id, campus_id), commit=True), True


def _ensure_offering(dept_id, campus_id, course_id, session_id, program_id,
                     curriculum_id, actual_semester, status="ongoing"):
    row = query("""
        SELECT id FROM bs_course_offerings
        WHERE course_id=%s AND session_id=%s AND actual_semester=%s AND program_id=%s
    """, (course_id, session_id, actual_semester, program_id), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_course_offerings
            (course_id, session_id, program_id, curriculum_id, actual_semester,
             status, department_id, campus_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (course_id, session_id, program_id, curriculum_id, actual_semester,
          status, dept_id, campus_id), commit=True), True


def _ensure_section(offering_id, name, capacity=40, room=None):
    row = query("SELECT id FROM bs_offering_sections WHERE offering_id=%s AND name=%s",
                (offering_id, name), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_offering_sections (offering_id, name, capacity, room)
        VALUES (%s,%s,%s,%s)
    """, (offering_id, name, capacity, room), commit=True), True


def _ensure_teaching(teacher_id, section_id, role="lead"):
    row = query("""SELECT id FROM bs_teaching_assignments
                   WHERE teacher_id=%s AND offering_section_id=%s""",
                (teacher_id, section_id), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_teaching_assignments (teacher_id, offering_section_id, role)
        VALUES (%s,%s,%s)
    """, (teacher_id, section_id, role), commit=True), True


def _ensure_slot(section_id, day, start, end, room=None):
    row = query("""SELECT id FROM bs_timetable_slots
                   WHERE offering_section_id=%s AND day_of_week=%s AND start_time=%s""",
                (section_id, day, start), one=True)
    if row:
        return row["id"], False
    return query("""
        INSERT INTO bs_timetable_slots
            (offering_section_id, day_of_week, start_time, end_time, room)
        VALUES (%s,%s,%s,%s,%s)
    """, (section_id, day, start, end, room), commit=True), True


def _ensure_enrollment(student_id, section_id, batch_id, offering_id, course_id,
                       session_label):
    """
    Enrolls a student and opens the matching attempt.

    Refuses — quietly, by returning ``None`` — when the student already holds
    a place in ANY section of the same offering.  That is the rule the
    specification's own test scenario probes by asking for the same student in
    both Section A and Section B of one course (spec §40, Rule 9).
    """
    exists = query("""SELECT id FROM bs_enrollments
                      WHERE student_id=%s AND offering_section_id=%s""",
                   (student_id, section_id), one=True)
    if exists:
        return None

    clash = query("""
        SELECT en.id FROM bs_enrollments en
        JOIN bs_offering_sections os ON os.id = en.offering_section_id
        WHERE en.student_id=%s AND os.offering_id=%s
    """, (student_id, offering_id), one=True)
    if clash:
        return None

    query("""INSERT INTO bs_enrollments (student_id, offering_section_id, batch_id, status)
             VALUES (%s,%s,%s,'enrolled')""",
          (student_id, section_id, batch_id), commit=True)

    open_attempt = query("""SELECT id FROM bs_course_attempts
                            WHERE student_id=%s AND course_id=%s AND status='in_progress'""",
                         (student_id, course_id), one=True)
    if not open_attempt:
        nxt = query("""SELECT COALESCE(MAX(attempt_no),0)+1 AS n FROM bs_course_attempts
                       WHERE student_id=%s AND course_id=%s""",
                    (student_id, course_id), one=True)["n"]
        query("""INSERT INTO bs_course_attempts
                    (student_id, course_id, offering_id, attempt_no, session_label, status)
                 VALUES (%s,%s,%s,%s,%s,'in_progress')""",
              (student_id, course_id, offering_id, nxt, session_label), commit=True)
    return True


# ================================================================
# BACKFILL  (spec §36, §37)
# ================================================================
def _backfill_students(dept_id, program_id, batch_id, curriculum_id):
    """
    Attach existing BS students to the new model without touching anything
    an administrator has already set.  Each column is filled independently
    and only where it is still NULL, so a hand-assigned student keeps their
    own program / batch / curriculum.
    """
    rows = query("""
        SELECT id FROM students
        WHERE department_id=%s
              AND (bs_program_id IS NULL OR bs_batch_id IS NULL
                   OR bs_curriculum_id IS NULL OR bs_current_semester IS NULL)
    """, (dept_id,))
    if not rows:
        return 0
    query("""
        UPDATE students
        SET bs_program_id       = COALESCE(bs_program_id, %s),
            bs_batch_id         = COALESCE(bs_batch_id, %s),
            bs_curriculum_id    = COALESCE(bs_curriculum_id, %s),
            bs_current_semester = COALESCE(bs_current_semester, 2)
        WHERE department_id=%s
    """, (program_id, batch_id, curriculum_id, dept_id), commit=True)
    return len(rows)


# ================================================================
# ENTRY POINT
# ================================================================
def seed_bs_academic():
    """Build the BS academic model if it is not there yet.  Safe to re-run."""
    dept_id, campus_id = _bs_context()
    if not dept_id:
        print("[bs-academic] BS department not found - seed skipped")
        return

    created = []

    # ---- 1. Program, sessions, curriculum ---------------------------------
    program_id, new = _ensure_program(dept_id, campus_id)
    if new:
        created.append(PROGRAM_NAME)

    admit_id, new = _ensure_session(dept_id, campus_id, ADMIT_SESSION)
    if new:
        created.append(ADMIT_SESSION[0])
    demo_id, new = _ensure_session(dept_id, campus_id, DEMO_SESSION)
    if new:
        created.append(DEMO_SESSION[0])

    curriculum_id, new = _ensure_curriculum(dept_id, campus_id, program_id)
    if new:
        created.append(CURRICULUM[0])

    # ---- 2. Courses and the curriculum that recommends them --------------
    course_ids = {}
    for code, name, ch, ctype, sem, classification in _COURSES:
        cid, new = _ensure_course(dept_id, campus_id, code, name, ch, ctype)
        course_ids[code] = cid
        if new:
            created.append(f"{code} {name}")
        _ensure_curriculum_course(curriculum_id, cid, sem, classification, ch)

    for code, name, ch, ctype, sem, classification, group in _ELECTIVES:
        cid, new = _ensure_course(dept_id, campus_id, code, name, ch, ctype)
        course_ids[code] = cid
        if new:
            created.append(f"{code} {name}")
        _ensure_curriculum_course(curriculum_id, cid, sem, classification, ch, group)
    _ensure_elective_group(curriculum_id, 5, "CS Elective I", 1)

    # ---- 3. Batch, pinned to program + curriculum + admission session ----
    batch_id, new = _ensure_batch(dept_id, campus_id, program_id, curriculum_id, admit_id)
    if new:
        created.append(BATCH_NAME)

    # ---- 4. Offerings in Fall 2027 ---------------------------------------
    # THE point of the whole architecture: Programming Fundamentals is
    # recommended in semester 1 by the curriculum, yet Fall 2027 offers it at
    # ACTUAL semester 2.  The curriculum row above is not modified in any way
    # — both facts are true at the same time (spec §9, Rules 2-4).
    pf_offering, new = _ensure_offering(dept_id, campus_id, course_ids["CS-101"],
                                        demo_id, program_id, curriculum_id, 2)
    if new:
        created.append("Offering CS-101 @ actual semester 2 (recommended 1)")
    oop_offering, new = _ensure_offering(dept_id, campus_id, course_ids["CS-201"],
                                         demo_id, program_id, curriculum_id, 2)
    if new:
        created.append("Offering CS-201 @ actual semester 2")
    stat_offering, _ = _ensure_offering(dept_id, campus_id, course_ids["STAT-201"],
                                        demo_id, program_id, curriculum_id, 2)

    # ---- 5. Sections: one course, several sections -----------------------
    pf_a,  _ = _ensure_section(pf_offering,  "A", 40, "Lab-1")
    pf_b,  _ = _ensure_section(pf_offering,  "B", 40, "Lab-2")
    oop_a, _ = _ensure_section(oop_offering, "A", 40, "Room-201")
    oop_b, _ = _ensure_section(oop_offering, "B", 40, "Room-202")
    st_a,  _ = _ensure_section(stat_offering, "A", 60, "Hall-A")

    # ---- 6. Teaching assignments -----------------------------------------
    # Different teachers on different sections of the SAME course (Rule 7),
    # and one teacher holding sections of two different courses (Rule 5).
    teachers = [t["id"] for t in query(
        "SELECT id FROM teachers WHERE department_id=%s ORDER BY id", (dept_id,))]
    if teachers:
        def t(i):
            return teachers[i % len(teachers)]
        _ensure_teaching(t(0), pf_a)
        _ensure_teaching(t(1), pf_b)      # same course, different teacher
        _ensure_teaching(t(2), oop_a)
        _ensure_teaching(t(0), oop_b)     # teacher 0 now teaches two courses
        _ensure_teaching(t(3), st_a)

    # ---- 7. Timetable — a separate concept from the assignment (Rule 12) --
    _ensure_slot(pf_a,  "Mon", "09:00:00", "10:30:00", "Lab-1")
    _ensure_slot(pf_a,  "Wed", "09:00:00", "10:30:00", "Lab-1")
    _ensure_slot(pf_b,  "Mon", "11:00:00", "12:30:00", "Lab-2")
    _ensure_slot(oop_a, "Tue", "09:00:00", "10:30:00", "Room-201")
    _ensure_slot(oop_b, "Tue", "11:00:00", "12:30:00", "Room-202")
    _ensure_slot(st_a,  "Thu", "09:00:00", "10:30:00", "Hall-A")

    # ---- 8. Backfill the real students, then enroll them -----------------
    touched = _backfill_students(dept_id, program_id, batch_id, curriculum_id)

    students = [s["id"] for s in query(
        "SELECT id FROM students WHERE department_id=%s ORDER BY roll_no, id", (dept_id,))]

    enrolled = 0
    for idx, sid in enumerate(students):
        # Programming Fundamentals: split across A and B.  Note each student
        # lands in exactly ONE of them — a second call for the same student
        # would be refused by _ensure_enrollment (spec §40, Rule 9).
        section = pf_a if idx % 2 == 0 else pf_b
        if _ensure_enrollment(sid, section, batch_id, pf_offering,
                              course_ids["CS-101"], DEMO_SESSION[0]):
            enrolled += 1
        section = oop_a if idx % 2 == 0 else oop_b
        if _ensure_enrollment(sid, section, batch_id, oop_offering,
                              course_ids["CS-201"], DEMO_SESSION[0]):
            enrolled += 1
        if _ensure_enrollment(sid, st_a, batch_id, stat_offering,
                              course_ids["STAT-201"], DEMO_SESSION[0]):
            enrolled += 1

    # ---- 9. One completed history, so progress and repeats are visible ---
    # The first student gets a graded past attempt at Calculus and a FAILED
    # one at ICT, which is what a repeat offering later attaches to as
    # attempt 2 rather than as a duplicate course (Rules 10, 14, 15).
    if students:
        _seed_history(students[0], course_ids, ADMIT_SESSION[0])

    if created:
        print(f"[bs-academic] created: {', '.join(created[:6])}"
              + (f" (+{len(created) - 6} more)" if len(created) > 6 else ""))
    print(f"[bs-academic] {len(students)} BS student(s) linked to {BATCH_NAME}"
          f" ({touched} updated), {enrolled} enrollment(s) created")


def _seed_history(student_id, course_ids, session_label):
    """A small graded past, so CGPA and repeat handling are demonstrable."""
    for code, grade, points, status in [("MATH-101", "B+", 3.33, "passed"),
                                        ("ICT-101",  "F",  0.00, "failed")]:
        cid = course_ids.get(code)
        if not cid:
            continue
        if query("SELECT id FROM bs_course_attempts WHERE student_id=%s AND course_id=%s",
                 (student_id, cid), one=True):
            continue
        query("""
            INSERT INTO bs_course_attempts
                (student_id, course_id, attempt_no, session_label, status, grade, gpa_points)
            VALUES (%s,%s,1,%s,%s,%s,%s)
        """, (student_id, cid, session_label, status, grade, points), commit=True)


if __name__ == "__main__":
    seed_bs_academic()
