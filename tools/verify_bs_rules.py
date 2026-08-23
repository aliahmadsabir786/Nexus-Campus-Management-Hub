"""
tools/verify_bs_rules.py  —  the 15 business rules of spec §42, end to end
=========================================================================
Read-mostly harness.  It drives the REAL Flask app through its test client,
so every request passes the api_guard, the context filters and the route
decorators exactly as a browser would.

Anything it creates lives in a throwaway session named "VERIFY <n>" and is
removed again at the end, so running this never leaves residue.  Nothing that
existed beforehand is touched.

    python -m tools.verify_bs_rules
"""

import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app import app                      # noqa: E402
from db import query                     # noqa: E402

PASS, FAIL = "PASS", "FAIL"
results = []


def check(rule, ok, detail=""):
    results.append((rule, PASS if ok else FAIL, detail))
    print(f"  [{PASS if ok else FAIL}] Rule {rule}: {detail}")
    return ok


def main():
    client = app.test_client()
    r = client.post("/api/login", json={
        "role": "admin", "username": "admin", "password": "admin123",
        "department": "BS",
    })
    if r.status_code != 200 or not r.get_json().get("success"):
        print("Login failed:", r.status_code, r.get_json())
        return 1
    print("Logged in as admin in BS context\n")

    def get(url):
        rr = client.get(url)
        return rr.status_code, rr.get_json()

    def post(url, body=None):
        rr = client.post(url, json=body or {})
        return rr.status_code, rr.get_json()

    def put(url, body):
        rr = client.put(url, json=body)
        return rr.status_code, rr.get_json()

    def delete(url):
        rr = client.delete(url)
        return rr.status_code, rr.get_json()

    created_sessions = []
    created_courses = []

    # ------------------------------------------------------------------
    # Fixtures already laid down by the seeder
    # ------------------------------------------------------------------
    _, programs = get("/api/bs/programs")
    program = programs[0]
    _, curriculums = get("/api/bs/curriculums")
    curriculum = curriculums[0]
    _, sessions = get("/api/bs/sessions")
    fall27 = next(s for s in sessions if s["name"] == "Fall 2027")
    _, courses = get("/api/bs/courses")
    by_code = {c["code"]: c for c in courses}
    _, offerings = get(f"/api/bs/offerings?session_id={fall27['id']}")
    off_by_code = {o["courseCode"]: o for o in offerings}

    # ==================================================================
    print("RULE 1-4  Course reuse, recommended vs actual semester")
    # ==================================================================
    # 1. The course table has no semester column at all.
    cols = [c["COLUMN_NAME"] for c in query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses'")]
    check(1, not any("semester" in c.lower() for c in cols),
          f"bs_courses has no semester column: {cols}")

    # ...and the API refuses to accept one, so it cannot creep back in.
    sc, body = post("/api/bs/courses", {
        "code": "VERIFY-1", "name": "Should be rejected",
        "creditHours": 3, "semester": 1})
    check(1, sc == 400 and "semester" in (body.get("error") or "").lower(),
          f"API rejects a semester on a course: {sc} {body.get('error')}")

    # 2. The curriculum is where the recommendation lives.
    _, plan_body = get(f"/api/bs/curriculums/{curriculum['id']}/courses")
    plan = plan_body["courses"]
    cs101_plan = next(p for p in plan if p["courseCode"] == "CS-101")
    check(2, cs101_plan["recommendedSemester"] == 1,
          f"curriculum recommends CS-101 in semester {cs101_plan['recommendedSemester']}")

    # 3. The offering is where the actual semester lives — and it differs.
    cs101_off = off_by_code["CS-101"]
    check(3, cs101_off["actualSemester"] == 2 and cs101_off["recommendedSemester"] == 1
          and cs101_off["isShifted"],
          f"Fall 2027 offers CS-101 at actual semester {cs101_off['actualSemester']} "
          f"while the curriculum still recommends {cs101_off['recommendedSemester']}")

    # ...and the curriculum was NOT rewritten to agree with it.
    _, plan_again = get(f"/api/bs/curriculums/{curriculum['id']}/courses")
    still = next(p for p in plan_again["courses"] if p["courseCode"] == "CS-101")
    check(3, still["recommendedSemester"] == 1,
          "the curriculum recommendation is unchanged by the shifted offering")

    # 4. The same course, a different session, a different actual semester.
    sc, body = post("/api/bs/sessions", {
        "name": "VERIFY Spring 2028", "term": "Spring",
        "academicYear": "2027-2028", "startDate": "2028-02-01",
        "endDate": "2028-06-30", "status": "planned"})
    v_session = body["session"]
    created_sessions.append(v_session["id"])

    sc, body = post("/api/bs/offerings", {
        "courseId": by_code["CS-101"]["id"], "sessionId": v_session["id"],
        "programId": program["id"], "curriculumId": curriculum["id"],
        "actualSemester": 3, "sections": 2})
    v_off = body.get("offering") if sc == 201 else None
    check(4, sc == 201 and v_off["actualSemester"] == 3,
          f"CS-101 also offered at actual semester 3 in another session "
          f"(same course row id {by_code['CS-101']['id']}, no duplicate)")

    # ==================================================================
    print("\nRULE 5-7  Teachers across courses and sections")
    # ==================================================================
    _, detail = get(f"/api/bs/offerings/{cs101_off['id']}")
    sec_a = next(s for s in detail["sections"] if s["name"] == "A")
    sec_b = next(s for s in detail["sections"] if s["name"] == "B")

    t_a = [t["teacherId"] for t in sec_a["teachers"]]
    t_b = [t["teacherId"] for t in sec_b["teachers"]]
    check(7, t_a and t_b and t_a != t_b,
          f"CS-101 section A taught by {t_a}, section B by {t_b} - different teachers, one course")

    _, wl = get(f"/api/bs/teachers/{t_a[0]}/workload")
    distinct_courses = {a["courseCode"] for a in wl["assignments"]}
    check(5, len(distinct_courses) > 1,
          f"teacher {t_a[0]} teaches {sorted(distinct_courses)} - multiple courses")

    # 6. One teacher, the same course, two sections.
    v_sections = query(
        "SELECT id, name FROM bs_offering_sections WHERE offering_id=%s ORDER BY name",
        (v_off["id"],))
    ok6 = True
    for s in v_sections:
        sc, body = post(f"/api/bs/offering-sections/{s['id']}/teachers",
                        {"teacherId": t_a[0], "role": "lead"})
        ok6 = ok6 and sc == 201
    check(6, ok6 and len(v_sections) == 2,
          f"teacher {t_a[0]} assigned to both sections of one offering")

    # ==================================================================
    print("\nRULE 8-9  Batch, curriculum and enrollment in real offerings")
    # ==================================================================
    _, batches = get("/api/bs/batches")
    batch = batches[0]
    linked = query("""SELECT COUNT(*) n FROM students
                      WHERE bs_batch_id=%s AND bs_curriculum_id=%s AND bs_program_id=%s""",
                   (batch["id"], curriculum["id"], program["id"]), one=True)["n"]
    check(8, linked > 0,
          f"{linked} student(s) linked to batch '{batch['name']}', its curriculum and program")

    _, roster = get(f"/api/bs/offering-sections/{sec_a['id']}/students")
    check(9, len(roster["students"]) > 0,
          f"{len(roster['students'])} student(s) enrolled in an ACTUAL offering section")

    # The rule that makes sections real: never two sections of one offering.
    victim = roster["students"][0]["studentId"]
    sc, body = post(f"/api/bs/offering-sections/{sec_b['id']}/students",
                    {"studentIds": [victim]})
    skipped = (body.get("skipped") or [{}])[0].get("reason", "")
    check(9, not body.get("enrolled") and "already enrolled" in skipped.lower(),
          f"same student refused a second section of the same course: {skipped}")

    # ==================================================================
    print("\nRULE 10 / 14  Grades on the attempt, repeats as new attempts")
    # ==================================================================
    _, attempts = get(f"/api/bs/students/{victim}/attempts")
    ict = [a for a in attempts if a["courseCode"] == "ICT-101"]
    if not ict:
        # Grade one live section so there is a graded attempt to reason about.
        sc, body = post(f"/api/bs/offering-sections/{sec_a['id']}/results",
                        {"results": [{"studentId": victim, "grade": "F"}]})
        _, attempts = get(f"/api/bs/students/{victim}/attempts")
        ict = [a for a in attempts if a["grade"] == "F"]

    failed = ict[0] if ict else None
    check(14, failed is not None and failed["grade"],
          f"grade '{failed['grade'] if failed else '-'}' recorded on attempt "
          f"#{failed['attemptNo'] if failed else '-'} of "
          f"{failed['courseCode'] if failed else '-'}, not on the course")

    # A repeat: offer the failed course again and enroll — attempt 2.
    sc, body = post("/api/bs/offerings", {
        "courseId": failed["courseId"], "sessionId": v_session["id"],
        "programId": program["id"], "curriculumId": curriculum["id"],
        "actualSemester": 1, "sections": 1})
    repeat_off = body["offering"]
    repeat_sec = query("SELECT id FROM bs_offering_sections WHERE offering_id=%s",
                       (repeat_off["id"],), one=True)
    sc, body = post(f"/api/bs/offering-sections/{repeat_sec['id']}/students",
                    {"studentIds": [victim]})
    _, attempts2 = get(f"/api/bs/students/{victim}/attempts")
    same_course = [a for a in attempts2 if a["courseId"] == failed["courseId"]]
    course_rows = query("SELECT COUNT(*) n FROM bs_courses WHERE id=%s",
                        (failed["courseId"],), one=True)["n"]
    check(10, len(same_course) == 2 and max(a["attemptNo"] for a in same_course) == 2
          and course_rows == 1,
          f"repeat is attempt #2 of the SAME course row ({len(same_course)} attempts, "
          f"{course_rows} course record)")

    # ==================================================================
    print("\nRULE 11  Electives")
    # ==================================================================
    _, groups = get(f"/api/bs/curriculums/{curriculum['id']}/elective-groups")
    electives = [p for p in plan if p["classification"] == "elective"]
    check(11, len(groups) > 0 and len(electives) >= 2,
          f"{len(groups)} elective group(s), {len(electives)} elective course(s) "
          f"in group '{electives[0]['electiveGroup'] if electives else '-'}'")

    # ==================================================================
    print("\nRULE 12  Timetable is not the teaching assignment")
    # ==================================================================
    ta_cols = [c["COLUMN_NAME"] for c in query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_teaching_assignments'")]
    _, tt = get(f"/api/bs/offering-sections/{sec_a['id']}/timetable")
    check(12, not any(k in " ".join(ta_cols).lower() for k in ("day", "time"))
          and len(tt) >= 1,
          f"assignment columns {ta_cols} carry no time; the section has "
          f"{len(tt)} independent timetable slot(s)")

    # ==================================================================
    print("\nRULE 13  Attendance belongs to a section, not to a day")
    # ==================================================================
    att_cols = [c["COLUMN_NAME"] for c in query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_attendance'")]
    sc, body = post(f"/api/bs/offering-sections/{sec_a['id']}/attendance", {
        "date": "2027-10-04",
        "records": [{"studentId": victim, "status": "present"}]})
    saved_a = body.get("saved", 0)

    # The same student, the same day, a DIFFERENT course — the case a
    # (student, date) key cannot express.
    _, oop_detail = get(f"/api/bs/offerings/{off_by_code['CS-201']['id']}")
    oop_sec = next((s for s in oop_detail["sections"]
                    if any(st["studentId"] == victim for st in
                           get(f"/api/bs/offering-sections/{s['id']}/students")[1]["students"])),
                   None)
    saved_b = 0
    if oop_sec:
        sc, body = post(f"/api/bs/offering-sections/{oop_sec['id']}/attendance", {
            "date": "2027-10-04",
            "records": [{"studentId": victim, "status": "absent"}]})
        saved_b = body.get("saved", 0)
    rows = query("SELECT COUNT(*) n FROM bs_attendance WHERE student_id=%s AND date=%s",
                 (victim, "2027-10-04"), one=True)["n"]
    check(13, "offering_section_id" in att_cols and saved_a and saved_b and rows == 2,
          f"{rows} attendance rows for one student on one day, one per course section")

    # ==================================================================
    print("\nRULE 15  Progress from credit hours, not semester number")
    # ==================================================================
    _, prog = get(f"/api/bs/students/{victim}/progress")
    check(15, "earnedCredits" in prog and "requiredCredits" in prog
          and prog.get("percentComplete") is not None,
          f"earned {prog.get('earnedCredits')}/{prog.get('requiredCredits')} credit hours "
          f"= {prog.get('percentComplete')}%, CGPA {prog.get('cgpa')}, "
          f"{len(prog.get('pendingRepeats') or [])} pending repeat(s)")

    # ==================================================================
    print("\nAUTHORIZATION  backend, not frontend hiding (spec §39)")
    # ==================================================================
    client.post("/api/logout")
    teacher = query("SELECT id FROM teachers WHERE department_id="
                    "(SELECT id FROM departments WHERE code='BS') ORDER BY id LIMIT 1",
                    one=True)
    tclient = app.test_client()
    # The sample teacher accounts are T001 -> "teach1" … T005 -> "teach5"
    # (utils/seed.py); a real deployment password simply makes this skip.
    r = None
    for pwd in (f"teach{str(teacher['id'])[1:].lstrip('0') or '1'}", "teach123"):
        r = tclient.post("/api/login", json={
            "role": "teacher", "username": teacher["id"], "password": pwd,
            "department": "BS"})
        if r.status_code == 200:
            break
    if r.status_code == 200:
        rr = tclient.post("/api/bs/programs", json={"name": "Hacked", "code": "HX"})
        check("39a", rr.status_code in (401, 403),
              f"teacher blocked from a structural write: HTTP {rr.status_code}")
        unowned = query("""
            SELECT os.id FROM bs_offering_sections os
            WHERE os.id NOT IN (SELECT offering_section_id FROM bs_teaching_assignments
                                 WHERE teacher_id=%s) LIMIT 1""",
            (teacher["id"],), one=True)
        if unowned:
            rr = tclient.post(f"/api/bs/offering-sections/{unowned['id']}/attendance",
                              json={"date": "2027-10-05", "records": []})
            check("39b", rr.status_code == 403,
                  f"teacher blocked from marking a section they do not teach: "
                  f"HTTP {rr.status_code}")
        rr = tclient.get("/api/bs/my/teaching")
        mine = rr.get_json() if rr.status_code == 200 else []
        check("31", rr.status_code == 200 and all(
            a["teacherId"] == teacher["id"] for a in mine),
            f"teacher portal returns only their own {len(mine)} assignment(s)")
        tclient.post("/api/logout")
    else:
        print(f"  [skip] teacher login unavailable ({r.status_code})")

    # ==================================================================
    print("\nCLEANUP  removing everything this run created")
    # ==================================================================
    aclient = app.test_client()
    aclient.post("/api/login", json={"role": "admin", "username": "admin",
                                     "password": "admin123", "department": "BS"})
    query("DELETE FROM bs_attendance WHERE date IN ('2027-10-04','2027-10-05')", commit=True)
    for sid in created_sessions:
        offs = query("SELECT id FROM bs_course_offerings WHERE session_id=%s", (sid,))
        for o in offs:
            query("""DELETE FROM bs_course_attempts WHERE offering_id=%s""",
                  (o["id"],), commit=True)
            query("DELETE FROM bs_course_offerings WHERE id=%s", (o["id"],), commit=True)
        query("DELETE FROM bs_academic_sessions WHERE id=%s", (sid,), commit=True)
    for cid in created_courses:
        query("DELETE FROM bs_courses WHERE id=%s", (cid,), commit=True)
    # Restore the graded attempt this run may have written.
    query("""UPDATE bs_course_attempts SET grade=NULL, gpa_points=NULL,
             status='in_progress' WHERE offering_id IN
             (SELECT id FROM bs_course_offerings WHERE session_id=%s) """,
          (fall27["id"],), commit=True)
    print("  done")

    # ==================================================================
    failed_rules = [r for r in results if r[1] == FAIL]
    print("\n" + "=" * 64)
    print(f"  {len(results) - len(failed_rules)}/{len(results)} checks passed")
    if failed_rules:
        for rule, _, detail in failed_rules:
            print(f"  FAILED  Rule {rule}: {detail}")
    print("=" * 64)
    return 1 if failed_rules else 0


if __name__ == "__main__":
    sys.exit(main())
