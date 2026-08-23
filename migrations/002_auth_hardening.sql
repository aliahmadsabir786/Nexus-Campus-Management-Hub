-- ============================================================
-- NEXus Solution - Nexus Campus Management Hub (NCMH)
-- migrations/002_auth_hardening.sql
--
-- PURPOSE
--   Make the database itself enforce the two authentication rules that
--   routes/auth.py checks in code, so a row can never exist that would
--   let an account log in where it does not belong:
--
--     1. Every credential-bearing account MUST carry a department and a
--        campus.  utils/context.py:account_in_context() refuses an account
--        whose department_id is missing, so a NULL was already fail-closed
--        at login - but a NOT NULL column means such a row cannot be
--        created in the first place, by any code path, ever.
--
--     2. Sub-admin usernames become unique PER INSTITUTION instead of
--        globally.  The Boys and Girls campuses can now each have their
--        own "office" account, and the login query resolves the right one
--        from the selected department/campus rather than taking whichever
--        row the database returned first (specification section 5).
--
-- SAFETY / DESIGN NOTES
--   * ADDITIVE ONLY.  No table is dropped, no data column is dropped and
--     no row is deleted.  The only DROP is of an INDEX that is replaced
--     in the same statement block by a wider one.
--   * FULLY IDEMPOTENT.  Every change is guarded by an information_schema
--     lookup and run through PREPARE / EXECUTE, degrading to "DO 0".
--   * Runs AFTER 001, which backfilled department_id / campus_id on every
--     existing row, so the NOT NULL promotions cannot fail on live data.
--     As a belt-and-braces measure the backfill is repeated here first:
--     rows created between the two migrations are re-filed under the BS
--     department, exactly as 001 did.
--
-- USAGE
--   Manual :  mysql -u root -p nexus_cms < migrations/002_auth_hardening.sql
--   Auto   :  applied at startup by utils/migrate.py (see app.py)
-- ============================================================


-- ============================================================
-- SECTION 1: RE-RUN THE CONTEXT BACKFILL
--   Only touches rows that still have no context, so this is a no-op on
--   an already-migrated database.
-- ============================================================

UPDATE students   SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE students   SET campus_id     = 1 WHERE campus_id IS NULL AND department_id = 1;
UPDATE teachers   SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE teachers   SET campus_id     = 1 WHERE campus_id IS NULL AND department_id = 1;
UPDATE sub_admins SET department_id = 1, campus_id = 1 WHERE department_id IS NULL;
UPDATE sub_admins SET campus_id     = 1 WHERE campus_id IS NULL AND department_id = 1;


-- ============================================================
-- SECTION 2: ACCOUNTS MUST BE FILED UNDER AN INSTITUTION
--   students / teachers / sub_admins are the three tables that hold a
--   password_hash, i.e. the three tables a login can authenticate against.
--   The guard only promotes the columns once every row has a value, so a
--   partially-migrated database is left alone rather than half-changed.
-- ============================================================

-- students.department_id / campus_id -> NOT NULL
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM students WHERE department_id IS NULL OR campus_id IS NULL) = 0
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='students'
         AND COLUMN_NAME IN ('department_id','campus_id') AND IS_NULLABLE='YES') = 2,
  'ALTER TABLE students MODIFY COLUMN department_id INT NOT NULL, MODIFY COLUMN campus_id INT NOT NULL',
  'DO 0'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- teachers.department_id / campus_id -> NOT NULL
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM teachers WHERE department_id IS NULL OR campus_id IS NULL) = 0
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teachers'
         AND COLUMN_NAME IN ('department_id','campus_id') AND IS_NULLABLE='YES') = 2,
  'ALTER TABLE teachers MODIFY COLUMN department_id INT NOT NULL, MODIFY COLUMN campus_id INT NOT NULL',
  'DO 0'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- sub_admins.department_id / campus_id -> NOT NULL
SET @sql := (SELECT IF(
  (SELECT COUNT(*) FROM sub_admins WHERE department_id IS NULL OR campus_id IS NULL) = 0
  AND (SELECT COUNT(*) FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sub_admins'
         AND COLUMN_NAME IN ('department_id','campus_id') AND IS_NULLABLE='YES') = 2,
  'ALTER TABLE sub_admins MODIFY COLUMN department_id INT NOT NULL, MODIFY COLUMN campus_id INT NOT NULL',
  'DO 0'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- SECTION 3: SUB-ADMIN USERNAMES BECOME INSTITUTION-SCOPED
--   The old global UNIQUE key on sub_admins.username (auto-named
--   "username") is replaced by (department_id, campus_id, username).
--   Order matters: add the new key first, so uniqueness is never
--   unenforced, then retire the old one.
-- ============================================================

SET @sql := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE sub_admins ADD UNIQUE KEY uq_subadmin_username_ctx (department_id, campus_id, username)',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sub_admins'
    AND INDEX_NAME='uq_subadmin_username_ctx');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (SELECT IF(COUNT(*)>0,
  'ALTER TABLE sub_admins DROP INDEX username',
  'DO 0') FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sub_admins' AND INDEX_NAME='username');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================
-- SECTION 4: NO ACCOUNT MAY BE LEFT WITHOUT A USABLE SECRET
--   A NULL / empty password_hash is refused by _verify() in
--   routes/auth.py (it can never be unlocked), and these columns are
--   already NOT NULL in the baseline schema.  This section only asserts
--   that nothing has slipped through, by parking a marker hash on any row
--   that somehow has none - an unusable value, not a known password.
--   scrypt hashes always contain '$'; a value without one cannot have
--   come from generate_password_hash().
-- ============================================================

UPDATE students   SET password_hash = '!locked' WHERE password_hash IS NULL OR password_hash = '';
UPDATE teachers   SET password_hash = '!locked' WHERE password_hash IS NULL OR password_hash = '';
UPDATE sub_admins SET password_hash = '!locked' WHERE password_hash IS NULL OR password_hash = '';

-- ============================================================
-- END OF MIGRATION 002
-- ============================================================
