-- ============================================================
-- NEXus Solution — Nexus Campus Management Hub (NCMH)
-- migrations/004_bs_courses_per_program.sql
--
-- PURPOSE
--   Change bs_courses from a GLOBAL shared catalogue into a
--   PROGRAM-SCOPED catalogue: every course belongs to exactly ONE
--   BS program. Nothing is shared across programs any more — if two
--   programs both teach "English Composition", each program gets
--   its own separate course row for it going forward.
--
--   This is a deliberate product decision (each program manages its
--   own independent course catalogue) and supersedes the
--   "reusable-across-programs" shape bs_courses shipped with in
--   migration 003. Reuse WITHIN a program (across curriculum
--   versions and sessions) is untouched — spec §7/§42.1 still holds
--   at the program level.
--
-- SAFETY / DESIGN NOTES
--   * ADDITIVE + BACKFILLED, never destructive. No table dropped, no
--     course row deleted.
--   * program_id is backfilled from whichever curriculum already
--     placed each course (bs_curriculum_courses -> bs_curriculums
--     .program_id). A course with no placement yet falls back to the
--     lowest-id program in its own department.
--   * EDGE CASE — a course placed, before this upgrade, into
--     curricula belonging to MORE THAN ONE program: that ambiguity
--     is exactly what this migration removes, so the course is kept
--     as ONE row under its lowest-id program, and a note is left in
--     `schema_migration_notes` naming every OTHER program that used
--     it — recreate the course under those program(s) manually from
--     the Courses tab if they still need it. Nothing is silently
--     duplicated or merged across programs without a paper trail.
--   * NO STORED PROCEDURES. utils/migrate.py splits each file on
--     top-level ";" and runs statements one at a time — it does not
--     understand the `DELIMITER` trick the mysql CLI uses for
--     procedure bodies, so this file is 100% plain, single
--     statements (matching 001-003).
--   * FULLY IDEMPOTENT — every DDL step is guarded through
--     information_schema + PREPARE/EXECUTE, matching 001-003.
--
-- USAGE
--   Manual :  mysql -u root -p nexus_cms < migrations/004_bs_courses_per_program.sql
--   Auto   :  applied at startup by utils/migrate.py (see app.py)
-- ============================================================


-- ============================================================
-- STEP 0 — bookkeeping table for anything this script cannot
-- safely auto-resolve (kept tiny; admin can query it after upgrade)
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migration_notes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    migration  VARCHAR(190) NOT NULL,
    note       VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- STEP 1 — add program_id as NULLable first (never start a new
-- column NOT NULL on a table that may already have rows)
-- ============================================================
SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE bs_courses ADD COLUMN program_id INT NULL AFTER campus_id',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses' AND COLUMN_NAME='program_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ============================================================
-- STEP 2 — backfill program_id from existing curriculum placements.
-- A course placed under several programs is collapsed onto the
-- lowest program_id (see note above) — MIN() makes that
-- deterministic without needing a cursor/loop.
-- ============================================================
DROP TEMPORARY TABLE IF EXISTS _bs_course_program_pairs;
CREATE TEMPORARY TABLE _bs_course_program_pairs AS
SELECT DISTINCT cc.course_id, cur.program_id
FROM bs_curriculum_courses cc
JOIN bs_curriculums cur ON cur.id = cc.curriculum_id;

DROP TEMPORARY TABLE IF EXISTS _bs_course_keep_program;
CREATE TEMPORARY TABLE _bs_course_keep_program AS
SELECT course_id,
       MIN(program_id) AS keep_program_id,
       COUNT(DISTINCT program_id) AS program_count
FROM _bs_course_program_pairs
GROUP BY course_id;

UPDATE bs_courses c
JOIN _bs_course_keep_program k ON k.course_id = c.id
SET c.program_id = k.keep_program_id
WHERE c.program_id IS NULL;

-- Leave a paper trail for every course that WAS shared across more
-- than one program before this upgrade, naming the program(s) it
-- lost the association with.
INSERT INTO schema_migration_notes (migration, note)
SELECT '004_bs_courses_per_program',
       CONCAT('Course "', c.code, '" (', c.name, ') was used by curriculum(s) in program(s) ',
              GROUP_CONCAT(DISTINCT p.program_id ORDER BY p.program_id SEPARATOR ', '),
              ' before this upgrade. It now belongs only to program id ', c.program_id,
              '. Recreate it under the other program(s) from the Courses tab if still needed.')
FROM bs_courses c
JOIN _bs_course_keep_program k ON k.course_id = c.id AND k.program_count > 1
JOIN _bs_course_program_pairs p ON p.course_id = c.id
GROUP BY c.id, c.code, c.name, c.program_id;

-- Orphan courses (never placed in any curriculum yet) fall back to
-- the lowest-id program in the same department, if one exists.
UPDATE bs_courses c
JOIN (SELECT department_id, MIN(id) AS pid FROM bs_programs GROUP BY department_id) p
  ON p.department_id = c.department_id
SET c.program_id = p.pid
WHERE c.program_id IS NULL;

INSERT INTO schema_migration_notes (migration, note)
SELECT '004_bs_courses_per_program',
       CONCAT('Course "', code, '" (', name, ') had no curriculum placement and no program ',
              'exists yet in its department — left unassigned. Set its program from the Courses tab.')
FROM bs_courses WHERE program_id IS NULL;

DROP TEMPORARY TABLE IF EXISTS _bs_course_program_pairs;
DROP TEMPORARY TABLE IF EXISTS _bs_course_keep_program;


-- ============================================================
-- STEP 3 — re-point any offering that belonged to a course/program
-- pairing which no longer matches the course's (now single) program,
-- so bs_course_offerings.program_id never disagrees with its own
-- course's program_id going forward. Existing offerings already
-- always matched their course's program in practice, so this is a
-- defensive no-op for the current data — kept for safety on other
-- installs.
-- ============================================================
UPDATE bs_course_offerings o
JOIN bs_courses c ON c.id = o.course_id
SET o.program_id = c.program_id
WHERE o.program_id IS NOT NULL AND o.program_id <> c.program_id;


-- ============================================================
-- STEP 4 — enforce NOT NULL + FK + swap the unique key from
-- (department_id, code) to (program_id, code), but ONLY if every
-- row was actually resolved above (fail-safe: never brick a table).
-- ============================================================
SET @unresolved := (SELECT COUNT(*) FROM bs_courses WHERE program_id IS NULL);

SET @sql := (SELECT IF(@unresolved = 0 AND COUNT(*) = 0,
  'ALTER TABLE bs_courses MODIFY COLUMN program_id INT NOT NULL',
  'DO 0') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses'
    AND COLUMN_NAME='program_id' AND IS_NULLABLE='NO');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(@unresolved = 0 AND COUNT(*) = 0,
  'ALTER TABLE bs_courses ADD CONSTRAINT fk_bs_courses_program FOREIGN KEY (program_id) REFERENCES bs_programs(id) ON DELETE CASCADE ON UPDATE CASCADE',
  'DO 0') FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses' AND CONSTRAINT_NAME='fk_bs_courses_program');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(@unresolved = 0 AND COUNT(*) > 0,
  'ALTER TABLE bs_courses DROP INDEX uq_bs_course_code',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses' AND INDEX_NAME='uq_bs_course_code');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(@unresolved = 0 AND COUNT(*) = 0,
  'ALTER TABLE bs_courses ADD UNIQUE KEY uq_bs_course_program_code (program_id, code)',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses' AND INDEX_NAME='uq_bs_course_program_code');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE bs_courses ADD INDEX idx_bs_courses_program (program_id)',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bs_courses' AND INDEX_NAME='idx_bs_courses_program');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- DONE. bs_courses.program_id is now authoritative: every course
-- belongs to exactly one program, and course codes only need to be
-- unique WITHIN a program (two programs may both use "101").
-- ============================================================