-- ============================================================
-- NEXus Solution — Nexus Campus Management Hub (NCMH)
-- migrations/001_departments_campuses.sql
--
-- PURPOSE
--   Introduce the institution hierarchy:
--       NCMH
--        ├── BS DEPARTMENT            (independent, single campus)
--        └── INTERMEDIATE DEPARTMENT
--              ├── BOYS CAMPUS
--              └── GIRLS CAMPUS
--
--   and add the context columns (department_id / campus_id) that make
--   BACKEND-LEVEL data isolation possible for one shared codebase.
--
-- SAFETY / DESIGN NOTES
--   * ADDITIVE ONLY.  This script never drops a table and never drops a
--     data column.  No DROP DATABASE.  All existing rows are preserved
--     and re-associated with the BS department.
--   * FULLY IDEMPOTENT.  Safe to run any number of times.  MySQL 8 has
--     no "ADD COLUMN IF NOT EXISTS", so every DDL statement is guarded
--     by an information_schema lookup and executed through
--     PREPARE / EXECUTE / DEALLOCATE.  When the change is already in
--     place the guard degrades to the no-op statement "DO 0".
--   * Context columns are left NULLABLE on purpose.  A NULL context is
--     invisible to every context filter (department_id = %s never
--     matches NULL), so the failure mode is fail-CLOSED, never a data
--     leak across departments/campuses.
--
-- USAGE
--   Manual :  mysql -u root -p nexus_cms < migrations/001_departments_campuses.sql
--   Auto   :  applied at startup by utils/migrate.py (see app.py)
--
-- NOTE FOR FRESH INSTALLS
--   nexus_master.sql remains the baseline schema (it begins with
--   DROP DATABASE and must therefore NEVER be used on a live database).
--   Run nexus_master.sql once, then this migration.
-- ============================================================


-- ============================================================
-- SECTION 1: INSTITUTION HIERARCHY TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT NULL,
    logo_path   VARCHAR(255) DEFAULT NULL,
    has_campuses TINYINT(1)  NOT NULL DEFAULT 0,
    sort_order  INT          NOT NULL DEFAULT 0,
    status      ENUM('active','inactive') DEFAULT 'active',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_departments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Top-level institutions: BS Department, Intermediate Department';

CREATE TABLE IF NOT EXISTS campuses (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    department_id INT          NOT NULL,
    name          VARCHAR(100) NOT NULL,
    code          VARCHAR(20)  NOT NULL UNIQUE,
    description   VARCHAR(255) DEFAULT NULL,
    logo_path     VARCHAR(255) DEFAULT NULL,
    sort_order    INT          NOT NULL DEFAULT 0,
    status        ENUM('active','inactive') DEFAULT 'active',
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_campus_dept_name (department_id, name),
    INDEX idx_campuses_status (status),
    CONSTRAINT fk_campuses_department FOREIGN KEY (department_id)
        REFERENCES departments(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Campuses belonging to a department (Intermediate -> Boys / Girls)';


-- ============================================================
-- SECTION 2: SEED THE HIERARCHY  (fixed IDs — referenced by code)
--   departments : 1 = BS,          2 = Intermediate
--   campuses    : 1 = BS-MAIN,     2 = BOYS,  3 = GIRLS
-- INSERT IGNORE keeps this re-runnable without touching edited rows.
-- Values are deliberately ASCII-only: this file may be piped through the
-- `mysql` CLI, which decodes it with the console codepage unless told
-- otherwise, and a UTF-8 dash would land in the table as mojibake.
-- ============================================================

INSERT IGNORE INTO departments (id, name, code, description, logo_path, has_campuses, sort_order, status) VALUES
 (1, 'BS Department',           'BS',    'Four-year BS degree programs - Computer Science, Business Administration and allied disciplines.', '/static/assets/logos/bs-logo.png',           0, 1, 'active'),
 (2, 'Intermediate Department', 'INTER', 'Intermediate (11th & 12th) programs delivered across two separate campuses.',                       '/static/assets/logos/intermediate-logo.png', 1, 2, 'active');

INSERT IGNORE INTO campuses (id, department_id, name, code, description, logo_path, sort_order, status) VALUES
 (1, 1, 'Main BS Campus', 'BS-MAIN', 'Primary campus of the BS Department.',            '/static/assets/logos/bs-logo.png',    1, 'active'),
 (2, 2, 'Boys Campus',    'BOYS',    'Intermediate Boys Campus - separate records.',    '/static/assets/logos/boys-logo.png',  1, 'active'),
 (3, 2, 'Girls Campus',   'GIRLS',   'Intermediate Girls Campus - separate records.',   '/static/assets/logos/girls-logo.png', 2, 'active');


-- ============================================================
-- SECTION 3: CONTEXT COLUMNS
--
-- Tables that OWN a context (columns added here):
--   students, teachers, classes   → required by the specification
--   exams, assignments, notices   → these CANNOT reliably inherit a
--     context through relationships:
--       · assignments.teacher_id is written as the caller's id (an admin
--         id is possible) and is ON DELETE SET NULL
--       · exams.class_id is nullable
--       · notices have no relation to any context-bearing table
--   sub_admins                    → scoped administrator accounts
--     (NULL department_id = global administrator, may pick any context)
--
-- Tables that INHERIT their context through foreign keys (no columns
-- added, per the "do not unnecessarily duplicate context" rule):
--   sections, class_students  → classes / sections
--   attendance, grades, complaints, fee_vouchers, fee_plans,
--   fee_installments          → students
--   teacher_assignments, timetables → teachers
--   submissions               → assignments / students
-- ============================================================

-- students -------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE students ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- teachers -------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE teachers ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- classes --------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE classes ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='classes' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- exams ----------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE exams ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- assignments ----------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE assignments ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assignments' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- notices --------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE notices ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notices' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sub_admins -----------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE sub_admins ADD COLUMN department_id INT NULL, ADD COLUMN campus_id INT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sub_admins' AND COLUMN_NAME='department_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- SECTION 4: MIGRATE EXISTING DATA → BS DEPARTMENT / MAIN BS CAMPUS
--   Every record that already existed belongs to the BS department, so
--   the current application keeps behaving exactly as before.
--   Only rows with a missing context are touched (WHERE ... IS NULL),
--   which also makes this section idempotent.
-- ============================================================

UPDATE students    SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE teachers    SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE classes     SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE exams       SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE assignments SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE notices     SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE sub_admins  SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;


-- ============================================================
-- SECTION 5: FOREIGN KEYS + COMPOSITE LOOKUP INDEXES
--   Added AFTER the backfill so no existing row can violate them.
--   The (department_id, campus_id) index backs every scoped query
--   built by utils/context.py.
-- ============================================================

-- students -------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE students ADD INDEX idx_students_ctx (department_id, campus_id), ADD CONSTRAINT fk_students_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_students_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students' AND CONSTRAINT_NAME='fk_students_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- teachers -------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE teachers ADD INDEX idx_teachers_ctx (department_id, campus_id), ADD CONSTRAINT fk_teachers_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_teachers_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers' AND CONSTRAINT_NAME='fk_teachers_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- classes --------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE classes ADD INDEX idx_classes_ctx (department_id, campus_id), ADD CONSTRAINT fk_classes_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_classes_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='classes' AND CONSTRAINT_NAME='fk_classes_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- exams ----------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE exams ADD INDEX idx_exams_ctx (department_id, campus_id), ADD CONSTRAINT fk_exams_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_exams_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='exams' AND CONSTRAINT_NAME='fk_exams_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- assignments ----------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE assignments ADD INDEX idx_assignments_ctx (department_id, campus_id), ADD CONSTRAINT fk_assignments_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_assignments_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assignments' AND CONSTRAINT_NAME='fk_assignments_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- notices --------------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE notices ADD INDEX idx_notices_ctx (department_id, campus_id), ADD CONSTRAINT fk_notices_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_notices_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='notices' AND CONSTRAINT_NAME='fk_notices_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sub_admins -----------------------------------------------------------
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE sub_admins ADD INDEX idx_subadmins_ctx (department_id, campus_id), ADD CONSTRAINT fk_subadmins_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT fk_subadmins_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sub_admins' AND CONSTRAINT_NAME='fk_subadmins_dept');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- SECTION 6: CLASS UNIQUENESS BECOMES CONTEXT-SCOPED
--   classes.name and classes.code were GLOBALLY unique, which makes it
--   impossible for the Boys and Girls campuses to both own a class
--   called e.g. "FSc Pre-Medical".  Uniqueness is therefore rebuilt as
--   (department_id, campus_id, name) and (department_id, campus_id, code).
--   Existing BS class names stay unique inside the BS context, so no
--   current data is affected.
-- ============================================================

-- New composite unique key on (department_id, campus_id, code)
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE classes ADD UNIQUE KEY uq_class_code_ctx (department_id, campus_id, code)',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='classes' AND INDEX_NAME='uq_class_code_ctx');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- New composite unique key on (department_id, campus_id, name)
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE classes ADD UNIQUE KEY uq_class_name_ctx (department_id, campus_id, name)',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='classes' AND INDEX_NAME='uq_class_name_ctx');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Retire the old global UNIQUE index on classes.name (auto-named "name")
SET @sql := (SELECT IF(COUNT(*)>0,
  'ALTER TABLE classes DROP INDEX name',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='classes' AND INDEX_NAME='name');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Retire the old global UNIQUE index on classes.code (auto-named "code")
SET @sql := (SELECT IF(COUNT(*)>0,
  'ALTER TABLE classes DROP INDEX code',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='classes' AND INDEX_NAME='code');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- SECTION 7: REPORTING VIEWS — now context aware
--   Both views gain department_id / campus_id (plus readable labels)
--   so report queries can filter on the caller's context.
-- ============================================================

CREATE OR REPLACE VIEW v_students_full AS
SELECT
    s.id,
    s.name,
    s.cls,
    s.roll_no,
    s.email,
    s.phone,
    s.guardian_phone,
    s.fee_status,
    s.dob,
    s.portal,
    s.subject_group,
    s.class_id,
    s.section_id,
    s.department_id,
    s.campus_id,
    d.name   AS department_name,
    d.code   AS department_code,
    cp.name  AS campus_name,
    cp.code  AS campus_code,
    c.name   AS class_name,
    c.code   AS class_code,
    sec.name AS section_name
FROM students s
LEFT JOIN classes     c   ON c.id   = s.class_id
LEFT JOIN sections    sec ON sec.id = s.section_id
LEFT JOIN departments d   ON d.id   = s.department_id
LEFT JOIN campuses    cp  ON cp.id  = s.campus_id;

CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
    a.student_id,
    s.name        AS student_name,
    s.cls,
    s.class_id,
    s.section_id,
    s.department_id,
    s.campus_id,
    COUNT(*)                                             AS total_days,
    SUM(a.status = 'present')                            AS present_days,
    SUM(a.status = 'absent')                             AS absent_days,
    SUM(a.status = 'late')                               AS late_days,
    ROUND(SUM(a.status = 'present') / COUNT(*) * 100, 1) AS attendance_pct
FROM attendance a
JOIN students s ON s.id = a.student_id
GROUP BY a.student_id, s.name, s.cls, s.class_id, s.section_id, s.department_id, s.campus_id;

-- ============================================================
-- END OF MIGRATION 001
-- Sample Intermediate (Boys / Girls) records are created by
-- utils/seed_institutions.py, which uses the project's existing
-- Werkzeug password-hashing helper — never plain-text passwords.
-- ============================================================
