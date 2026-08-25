-- ============================================================
-- NEXus Solution - Nexus Campus Management Hub (NCMH)
-- migrations/005_bs_sessional_marks.sql
--
-- PURPOSE
--   Configurable sessional / internal-assessment marks for a BS course
--   offering (spec section 13):
--
--     bs_sessional_components   the breakdown itself, per offering
--       e.g. Quiz=5, Assignment=5, Presentation=5, Midterm=15
--     bs_sessional_marks        one student's obtained marks per component
--
--   The breakdown is NOT hard-coded - admin configures it per offering, and
--   "obtained <= max" is enforced server-side in routes/bs_offerings.py,
--   never trusted from the frontend alone (spec section 26, section 39).
--
-- SCOPE
--   BS DEPARTMENT ONLY, additive. Touches no existing table. A component
--   belongs to a COURSE OFFERING (spec section 9), so the SAME course can
--   carry a different breakdown each academic session without rewriting
--   history - identical reasoning to bs_course_offerings.actual_semester.
--
-- SAFETY / DESIGN NOTES
--   * ADDITIVE ONLY. CREATE TABLE IF NOT EXISTS, idempotent.
--   * ASCII-only (see migration 003 for why).
--   * No semicolons inside string literals or COMMENT.
--   * Marks live at (student, component) grain, one row per component -
--     never overwritten across semesters because a new offering means new
--     components (spec section 22 - marks history is never mutated once
--     the offering/session is over).
-- ============================================================


-- ============================================================
-- 1. SESSIONAL COMPONENT  - the configurable breakdown itself
--    Owned by an offering. Deleting the offering removes its breakdown;
--    deleting a component cascades to the marks recorded against it.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_sessional_components (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    offering_id INT NOT NULL,
    name        VARCHAR(60)   NOT NULL,
    max_marks   DECIMAL(6,2)  NOT NULL DEFAULT 0,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_sessional_component (offering_id, name),
    INDEX idx_bs_sc_offering (offering_id),
    CONSTRAINT fk_bs_sc_offering FOREIGN KEY (offering_id)
        REFERENCES bs_course_offerings(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_bs_sc_max_marks CHECK (max_marks >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Configurable sessional-marks breakdown per course offering (Quiz, Assignment ...)';


-- ============================================================
-- 2. SESSIONAL MARK  - one student's obtained marks for one component
--    offering_section_id is carried alongside component_id so a teacher's
--    write can be scoped to the section they are actually assigned to
--    (spec section 11, section 26), matching the bs_attendance pattern.
--    obtained_marks <= component.max_marks is an application-level check
--    (routes/bs_offerings.py) - MySQL cannot express a cross-table CHECK.
-- ============================================================
CREATE TABLE IF NOT EXISTS bs_sessional_marks (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    student_id           VARCHAR(10) NOT NULL,
    component_id         INT NOT NULL,
    offering_section_id  INT NOT NULL,
    obtained_marks       DECIMAL(6,2) NOT NULL DEFAULT 0,
    entered_by           VARCHAR(10) NULL,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bs_sessional_mark (student_id, component_id),
    INDEX idx_bs_sm_section (offering_section_id),
    CONSTRAINT fk_bs_sm_student   FOREIGN KEY (student_id)
        REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_sm_component FOREIGN KEY (component_id)
        REFERENCES bs_sessional_components(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bs_sm_section   FOREIGN KEY (offering_section_id)
        REFERENCES bs_offering_sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_bs_sm_marks CHECK (obtained_marks >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-student obtained marks for one sessional component. obtained<=max enforced in app code.';