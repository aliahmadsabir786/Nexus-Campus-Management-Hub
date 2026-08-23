-- ============================================================
-- NEXus Solution - Nexus Campus Management Hub (NCMH)
-- migrations/003_bs_academic_architecture.sql
--
-- PURPOSE
--   Introduce the proper BS-DEPARTMENT academic architecture:
--
--     BS PROGRAM
--       -> CURRICULUM VERSION      (2024 / 2026 / 2028, historically intact)
--            -> CURRICULUM COURSE   (course + recommended semester + type)
--       -> BATCH / ADMISSION SESSION
--     ACADEMIC SESSION             (Fall 2026, Spring 2027 ...)
--       -> COURSE OFFERING          (course + session + ACTUAL semester)
--            -> OFFERING SECTION     (A / B / C - the same course, not new courses)
--                 -> TEACHING ASSIGNMENT   (teacher teaches one section)
--                 -> STUDENT ENROLLMENT    (student takes one section)
--                 -> TIMETABLE SLOT        (weekly lectures)
--     COURSE ATTEMPT               (repeat / fail history per student+course)
--
--   The core principle the schema encodes:
--     * A COURSE is reusable and is NEVER hard-coded to a semester.
--     * CURRICULUM defines the RECOMMENDED semester.
--     * COURSE OFFERING defines the ACTUAL semester in a given session.
--       Both coexist - a shifted course does not mutate the curriculum.
--
-- SCOPE
--   BS DEPARTMENT ONLY. This migration adds NEW tables and touches NO
--   existing table belonging to Intermediate / Boys / Girls. It never
--   drops or rewrites an existing BS table either - it is purely additive.
--
-- SAFETY / DESIGN NOTES
--   * ADDITIVE ONLY. No DROP, no data loss. Safe to re-run (idempotent):
--     every table uses CREATE TABLE IF NOT EXISTS and every seed row uses
--     INSERT IGNORE with a fixed id.
--   * Context columns (department_id / campus_id) are carried by the
--     aggregate-root tables that are queried directly and filtered by
--     ctx_clause() (programs, courses, sessions, curriculums, offerings,
--     batches). Child tables inherit their context through their parent
--     via a foreign key (see utils/context.py _CTX_SOURCE_SQL) so the
--     context is never duplicated unnecessarily (spec section 33).
--   * ASCII-only. This file may be piped through the mysql CLI, which
--     decodes it with the console codepage - a UTF-8 dash would corrupt.
--   * No semicolons inside any string literal or COMMENT: utils/migrate.py
--     splits statements on ";".
--
-- USAGE
--   Auto : applied at startup by utils/migrate.py (see app.py)
--   Data : the demonstrable Fall-2027 scenario (spec section 40) and the
--          backfill of existing BS students are seeded idempotently by
--          utils/seed_bs_academic.py, NOT here - schema and data stay apart.
-- ============================================================


-- ============================================================
-- 1. PROGRAM  (spec section 3) - owns context
--    e.g. BS Computer Science / BSCS / 4 years / 8 semesters / 130 CH
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_programs (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    code                  VARCHAR(30)  NOT NULL,
    degree_type           VARCHAR(40)  NOT NULL DEFAULT 'BS',
    duration_years        DECIMAL(3,1) NOT NULL DEFAULT 4.0,
    total_semesters       INT          NOT NULL DEFAULT 8,
    required_credit_hours INT          NOT NULL DEFAULT 130,
    status                ENUM('active','inactive') NOT NULL DEFAULT 'active',
    department_id         INT NOT NULL,
    campus_id             INT NULL,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_program_code (department_id, code),
    INDEX idx_bs_programs_ctx (department_id, campus_id),
    CONSTRAINT fk_bs_programs_dept   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_programs_campus FOREIGN KEY (campus_id)     REFERENCES campuses(id)    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='BS degree programs (BSCS, BBA ...)';


-- ============================================================
-- 2. ACADEMIC SESSION  (spec section 10) - owns context
--    Fall 2026, Spring 2027 ... the real-world term a course is offered in.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_academic_sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(80)  NOT NULL,
    term          ENUM('Fall','Spring','Summer') NULL,
    academic_year VARCHAR(20)  NULL,
    start_date    DATE NULL,
    end_date      DATE NULL,
    status        ENUM('planned','active','completed','archived') NOT NULL DEFAULT 'planned',
    department_id INT NOT NULL,
    campus_id     INT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_session_name (department_id, name),
    INDEX idx_bs_sessions_ctx (department_id, campus_id),
    CONSTRAINT fk_bs_sessions_dept   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_sessions_campus FOREIGN KEY (campus_id)     REFERENCES campuses(id)    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Real academic sessions/terms (Fall 2026 ...)';


-- ============================================================
-- 3. COURSE / SUBJECT  (spec section 7) - owns context
--    Reusable entity. NEVER carries a semester. type = theory or lab.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_courses (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(30)  NOT NULL,
    name          VARCHAR(150) NOT NULL,
    credit_hours  INT NOT NULL DEFAULT 3,
    course_type   ENUM('theory','lab') NOT NULL DEFAULT 'theory',
    description   VARCHAR(255) NULL,
    status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
    department_id INT NOT NULL,
    campus_id     INT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_course_code (department_id, code),
    INDEX idx_bs_courses_ctx (department_id, campus_id),
    CONSTRAINT fk_bs_courses_dept   FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_courses_campus FOREIGN KEY (campus_id)     REFERENCES campuses(id)    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reusable courses - no semester is stored here';


-- ============================================================
-- 4. CURRICULUM VERSION  (spec section 4) - owns context
--    A program has many curriculums (2024/2026/2028). Old versions stay
--    historically intact - a new version is a new row, never an overwrite.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_curriculums (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    program_id    INT NOT NULL,
    name          VARCHAR(120) NOT NULL,
    version_year  INT NOT NULL,
    status        ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
    is_default    TINYINT(1) NOT NULL DEFAULT 0,
    department_id INT NOT NULL,
    campus_id     INT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_curriculum_ver (program_id, version_year),
    INDEX idx_bs_curriculums_ctx (department_id, campus_id),
    CONSTRAINT fk_bs_curr_program FOREIGN KEY (program_id)    REFERENCES bs_programs(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_curr_dept    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_curr_campus  FOREIGN KEY (campus_id)     REFERENCES campuses(id)    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable curriculum versions per program';


-- ============================================================
-- 5. CURRICULUM COURSE MAPPING  (spec section 8) - inherits context via curriculum
--    Relationship = curriculum + course + RECOMMENDED semester + type.
--    This is where the recommended semester lives, NOT on the course.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_curriculum_courses (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id        INT NOT NULL,
    course_id            INT NOT NULL,
    recommended_semester INT NOT NULL,
    classification       ENUM('core','elective','university','department','lab') NOT NULL DEFAULT 'core',
    is_compulsory        TINYINT(1) NOT NULL DEFAULT 1,
    elective_group       VARCHAR(60) NULL,
    credit_hours         INT NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_curr_course (curriculum_id, course_id),
    INDEX idx_bs_curr_course_sem (curriculum_id, recommended_semester),
    CONSTRAINT fk_bs_cc_curriculum FOREIGN KEY (curriculum_id) REFERENCES bs_curriculums(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_cc_course     FOREIGN KEY (course_id)     REFERENCES bs_courses(id)     ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Course placement inside a curriculum (recommended semester + type)';


-- ============================================================
-- 6. ELECTIVE GROUP  (spec section 21) - inherits context via curriculum
--    e.g. Semester 6 - Elective Group A - Required Courses 1.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_elective_groups (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    curriculum_id    INT NOT NULL,
    semester         INT NOT NULL,
    name             VARCHAR(80) NOT NULL,
    required_courses INT NOT NULL DEFAULT 1,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_elective_group (curriculum_id, semester, name),
    CONSTRAINT fk_bs_eg_curriculum FOREIGN KEY (curriculum_id) REFERENCES bs_curriculums(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Elective selection rules per curriculum semester';


-- ============================================================
-- 7. BATCH / ADMISSION SESSION  (spec section 5) - owns context
--    Every BS student belongs to a batch tied to program + curriculum +
--    admission session, e.g. BSCS-2026.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_batches (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    program_id           INT NOT NULL,
    curriculum_id        INT NOT NULL,
    admission_session_id INT NULL,
    name                 VARCHAR(80) NOT NULL,
    current_semester     INT NOT NULL DEFAULT 1,
    status               ENUM('active','graduated','inactive') NOT NULL DEFAULT 'active',
    department_id        INT NOT NULL,
    campus_id            INT NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_batch_name (department_id, name),
    INDEX idx_bs_batches_ctx (department_id, campus_id),
    CONSTRAINT fk_bs_batch_program    FOREIGN KEY (program_id)           REFERENCES bs_programs(id)          ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_batch_curriculum FOREIGN KEY (curriculum_id)        REFERENCES bs_curriculums(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_batch_session    FOREIGN KEY (admission_session_id) REFERENCES bs_academic_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bs_batch_dept       FOREIGN KEY (department_id)        REFERENCES departments(id)          ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_batch_campus     FOREIGN KEY (campus_id)            REFERENCES campuses(id)             ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student cohorts tied to program + curriculum + admission session';


-- ============================================================
-- 8. COURSE OFFERING  (spec sections 11, 12, 9, 19) - owns context
--    The bridge between a reusable course and a real academic session.
--    actual_semester is AUTHORITATIVE for that session and may differ
--    from the curriculum recommended semester (a shifted course).
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_course_offerings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    session_id      INT NOT NULL,
    program_id      INT NULL,
    curriculum_id   INT NULL,
    actual_semester INT NOT NULL,
    status          ENUM('planned','open','ongoing','completed','cancelled') NOT NULL DEFAULT 'planned',
    department_id   INT NOT NULL,
    campus_id       INT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_offering (course_id, session_id, actual_semester, program_id),
    INDEX idx_bs_offerings_ctx (department_id, campus_id),
    INDEX idx_bs_offerings_session (session_id, status),
    CONSTRAINT fk_bs_off_course     FOREIGN KEY (course_id)     REFERENCES bs_courses(id)           ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_off_session    FOREIGN KEY (session_id)    REFERENCES bs_academic_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_off_program    FOREIGN KEY (program_id)    REFERENCES bs_programs(id)          ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bs_off_curriculum FOREIGN KEY (curriculum_id) REFERENCES bs_curriculums(id)       ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bs_off_dept       FOREIGN KEY (department_id) REFERENCES departments(id)          ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bs_off_campus     FOREIGN KEY (campus_id)     REFERENCES campuses(id)             ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Course offered in a real session at an actual semester';


-- ============================================================
-- 9. OFFERING SECTION  (spec section 13) - inherits context via offering
--    Multiple sections of the SAME course. Not new courses (no OOP-A course).
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_offering_sections (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    offering_id  INT NOT NULL,
    name         VARCHAR(20) NOT NULL,
    capacity     INT NOT NULL DEFAULT 50,
    room         VARCHAR(50) NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_offering_section (offering_id, name),
    CONSTRAINT fk_bs_os_offering FOREIGN KEY (offering_id) REFERENCES bs_course_offerings(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sections (A/B/C) of a single course offering';


-- ============================================================
-- 10. TEACHING ASSIGNMENT  (spec sections 14, 15, 16) - inherits via section
--     Teacher -> teaching assignment -> offering section. One teacher may
--     hold many; many teachers may teach one course via different sections.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_teaching_assignments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id          VARCHAR(10) NOT NULL,
    offering_section_id INT NOT NULL,
    role                ENUM('lead','co') NOT NULL DEFAULT 'lead',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_teach_assign (teacher_id, offering_section_id),
    INDEX idx_bs_teach_section (offering_section_id),
    CONSTRAINT fk_bs_ta_teacher FOREIGN KEY (teacher_id)          REFERENCES teachers(id)             ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_ta_section FOREIGN KEY (offering_section_id) REFERENCES bs_offering_sections(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Which teacher teaches which offering section';


-- ============================================================
-- 11. STUDENT ENROLLMENT  (spec section 17) - inherits via section / student
--     What the student actually takes this session.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_enrollments (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    student_id          VARCHAR(10) NOT NULL,
    offering_section_id INT NOT NULL,
    batch_id            INT NULL,
    status              ENUM('enrolled','completed','dropped','withdrawn') NOT NULL DEFAULT 'enrolled',
    enrolled_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_enrollment (student_id, offering_section_id),
    INDEX idx_bs_enroll_section (offering_section_id),
    CONSTRAINT fk_bs_en_student FOREIGN KEY (student_id)          REFERENCES students(id)             ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_en_section FOREIGN KEY (offering_section_id) REFERENCES bs_offering_sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_en_batch   FOREIGN KEY (batch_id)            REFERENCES bs_batches(id)           ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student enrollment into a specific offering section';


-- ============================================================
-- 12. COURSE ATTEMPT  (spec section 20) - inherits context via student
--     Repeat / fail history. Attempt 1 Fall 2027 = F, Attempt 2 Spring 2028 = B.
--     No duplicate permanent course records - history instead.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_course_attempts (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    student_id    VARCHAR(10) NOT NULL,
    course_id     INT NOT NULL,
    offering_id   INT NULL,
    attempt_no    INT NOT NULL DEFAULT 1,
    session_label VARCHAR(80) NULL,
    status        ENUM('in_progress','passed','failed','repeated','withdrawn') NOT NULL DEFAULT 'in_progress',
    grade         VARCHAR(4) NULL,
    gpa_points    DECIMAL(3,2) NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_attempt (student_id, course_id, attempt_no),
    INDEX idx_bs_attempt_student (student_id, status),
    CONSTRAINT fk_bs_at_student  FOREIGN KEY (student_id)  REFERENCES students(id)           ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_at_course   FOREIGN KEY (course_id)   REFERENCES bs_courses(id)         ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_at_offering FOREIGN KEY (offering_id) REFERENCES bs_course_offerings(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-student per-course attempt history (repeat/fail)';


-- ============================================================
-- 13. TIMETABLE SLOT  (spec section 23) - inherits context via section
--     A separate concept from teacher assignment. The same course can have
--     several weekly lectures (Mon/Wed/Fri) as timetable rows.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_timetable_slots (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    offering_section_id INT NOT NULL,
    day_of_week         ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    room                VARCHAR(50) NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bs_tt_section (offering_section_id),
    CONSTRAINT fk_bs_tt_section FOREIGN KEY (offering_section_id) REFERENCES bs_offering_sections(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Weekly lecture slots for an offering section';


-- ============================================================
-- 14. BS COURSE ATTENDANCE  (spec section 24)
--
--     WHY A SEPARATE TABLE RATHER THAN THE EXISTING attendance TABLE
--     -------------------------------------------------------------
--     The existing attendance table carries UNIQUE KEY uq_attendance
--     (student_id, date) - exactly one row per student per DAY, which is
--     the correct grain for Intermediate, where a student attends one
--     class per day. Its whole marking path relies on that key via
--     INSERT ... ON DUPLICATE KEY UPDATE.
--
--     A BS student attends 5-6 DIFFERENT courses on the same date, so BS
--     attendance is per (student, offering section, date) - a different
--     grain that the existing key cannot represent.
--
--     Widening uq_attendance to include the offering section was rejected:
--     in MySQL a NULL column in a UNIQUE index never collides, so every
--     Intermediate row (NULL section) would stop de-duplicating and
--     ON DUPLICATE KEY UPDATE would silently start inserting duplicates -
--     breaking a working module, which spec section 35 forbids.
--
--     So this is a genuinely different fact at a different grain, not a
--     duplicate of an existing table (spec section 33). Intermediate
--     attendance keeps its table and its behaviour, untouched.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_attendance (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    student_id          VARCHAR(10) NOT NULL,
    offering_section_id INT NOT NULL,
    timetable_slot_id   INT NULL,
    date                DATE NOT NULL,
    status              ENUM('present','absent','late','leave') NOT NULL DEFAULT 'present',
    marked_by           VARCHAR(10) NULL,
    marked_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks             VARCHAR(255) NULL,
    UNIQUE KEY uq_bs_attendance (student_id, offering_section_id, date),
    INDEX idx_bs_att_section_date (offering_section_id, date),
    INDEX idx_bs_att_student (student_id),
    CONSTRAINT fk_bs_att_student FOREIGN KEY (student_id)          REFERENCES students(id)             ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_att_section FOREIGN KEY (offering_section_id) REFERENCES bs_offering_sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_att_slot    FOREIGN KEY (timetable_slot_id)   REFERENCES bs_timetable_slots(id)   ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-course BS attendance: student + offering section + date';


-- ============================================================
-- 15. STUDENT ACADEMIC PROFILE  (spec sections 5, 17, 32) - additive columns
--     Give the existing students table an optional link to its BS program +
--     batch + curriculum + current semester, WITHOUT disturbing the existing
--     free-text cls / subject_group columns the Intermediate side relies on.
--     All columns NULLABLE => Intermediate students are unaffected.
-- ============================================================
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE students ADD COLUMN bs_program_id INT NULL, ADD COLUMN bs_batch_id INT NULL, ADD COLUMN bs_curriculum_id INT NULL, ADD COLUMN bs_current_semester INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME='bs_program_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE students ADD INDEX idx_students_bs_batch (bs_batch_id), ADD CONSTRAINT fk_students_bs_program FOREIGN KEY (bs_program_id) REFERENCES bs_programs(id) ON DELETE SET NULL ON UPDATE CASCADE, ADD CONSTRAINT fk_students_bs_batch FOREIGN KEY (bs_batch_id) REFERENCES bs_batches(id) ON DELETE SET NULL ON UPDATE CASCADE, ADD CONSTRAINT fk_students_bs_curriculum FOREIGN KEY (bs_curriculum_id) REFERENCES bs_curriculums(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND CONSTRAINT_NAME='fk_students_bs_batch');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- END OF MIGRATION 003
-- The demonstrable Fall-2027 scenario (spec section 40) and the backfill of
-- the existing BS students/teachers are handled idempotently in Python by
-- utils/seed_bs_academic.py (called from app.py), keeping schema and data
-- concerns cleanly separated.
-- ============================================================
