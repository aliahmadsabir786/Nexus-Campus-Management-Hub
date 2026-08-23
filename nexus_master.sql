-- ============================================================
-- NEXus Solution — College Management System
-- nexus_master.sql  |  SINGLE MASTER DATABASE FILE  (v2)
--
-- ✅ All tables in correct creation order (no FK forward-reference)
-- ✅ Full referential integrity: classes → sections → students → attendance
-- ✅ teacher_assignments table included (access-control mapping)
-- ✅ All migration files merged — only run THIS file for a fresh install
-- ✅ Production-ready: indexes, constraints, ENUMs, utf8mb4 charset
--
-- Usage (fresh install):
--   mysql -u root -p < nexus_master.sql
--
-- Default Credentials:
--   Admin    → username: admin      | password: admin123
--   Teachers → T001–T005            | password: teach1–teach5
--   Students → S001–S009            | password: 1234
-- ============================================================

DROP DATABASE IF EXISTS nexus_cms;
CREATE DATABASE nexus_cms
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE nexus_cms;

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- SECTION 1: ADMIN & AUTH
-- ============================================================

CREATE TABLE admin_config (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    password_hash VARCHAR(256) NOT NULL,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stores admin password hash — single row expected';

CREATE TABLE sub_admins (
    id            VARCHAR(30)  PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    username      VARCHAR(80)  NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    permissions   JSON         NOT NULL DEFAULT (JSON_ARRAY()),
    portal        ENUM('active','inactive') DEFAULT 'active',
    created_at    DATE         DEFAULT NULL,
    INDEX idx_subadmins_username (username),
    INDEX idx_subadmins_portal   (portal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sub-admin accounts with granular permission sets';

-- ============================================================
-- SECTION 2: CLASSES  (must be created before sections, teachers, students)
-- ============================================================

CREATE TABLE classes (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    description VARCHAR(255),
    status      ENUM('active','inactive') DEFAULT 'active',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_classes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Top-level academic classes / programs (e.g. Computer Science, BBA)';

-- ============================================================
-- SECTION 3: SECTIONS  (child of classes)
-- ============================================================

CREATE TABLE sections (
    id         INT         AUTO_INCREMENT PRIMARY KEY,
    class_id   INT         NOT NULL,
    name       VARCHAR(50) NOT NULL,
    capacity   INT         DEFAULT 40,
    room       VARCHAR(50),
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_section (class_id, name),
    CONSTRAINT fk_sections_class
        FOREIGN KEY (class_id) REFERENCES classes(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_sections_class (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sections within a class (e.g. Section A, Section B)';

-- ============================================================
-- SECTION 4: TEACHERS  (references classes + sections — must come after both)
-- ============================================================

CREATE TABLE teachers (
    id            VARCHAR(10)  PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    subject       VARCHAR(100),
    dept          VARCHAR(100),
    qualification VARCHAR(100),
    phone         VARCHAR(20),
    email         VARCHAR(120),
    join_date     DATE,
    password_hash VARCHAR(256) NOT NULL,
    portal        ENUM('active','inactive') DEFAULT 'active',
    photo         LONGTEXT     COMMENT 'Base64-encoded profile photo',
    class_id      INT          DEFAULT NULL  COMMENT 'Primary/home class assignment',
    section_id    INT          DEFAULT NULL  COMMENT 'Primary/home section assignment',
    CONSTRAINT fk_teachers_class
        FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_teachers_section
        FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_teachers_class   (class_id),
    INDEX idx_teachers_section (section_id),
    INDEX idx_teachers_portal  (portal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Teacher profiles; class_id/section_id = primary assignment (use teacher_assignments for multi-class)';

-- ============================================================
-- SECTION 5: TEACHER ASSIGNMENTS  (many-to-many: teacher ↔ class/section/subject)
-- ============================================================

CREATE TABLE teacher_assignments (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(10)  NOT NULL,
    class_id   INT          NOT NULL,
    section_id INT          NOT NULL,
    subject_id VARCHAR(100) NOT NULL  COMMENT 'Subject name matching grades.subject',
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_teacher_assignment (teacher_id, class_id, section_id, subject_id),
    CONSTRAINT fk_ta_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)  ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ta_class
        FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ta_section
        FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_ta_teacher (teacher_id),
    INDEX idx_ta_class   (class_id),
    INDEX idx_ta_section (section_id),
    INDEX idx_ta_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Access-control mapping: which teacher teaches which subject in which class/section';

-- ============================================================
-- SECTION 6: CLASS STUDENTS  (lightweight roster for Class Management module)
-- ============================================================

CREATE TABLE class_students (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    section_id INT          NOT NULL,
    name       VARCHAR(100) NOT NULL,
    roll_no    VARCHAR(20)  NOT NULL,
    email      VARCHAR(120),
    phone      VARCHAR(20),
    status     ENUM('active','inactive') DEFAULT 'active',
    created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_roll_section (section_id, roll_no),
    CONSTRAINT fk_class_students_section
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_cs_section (section_id),
    INDEX idx_cs_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lightweight student roster used by the Class Management module';

-- ============================================================
-- SECTION 7: STUDENTS  (main student records; references classes + sections)
-- ============================================================

CREATE TABLE students (
    id             VARCHAR(10)  PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    cls            VARCHAR(20)  NOT NULL  COMMENT 'Legacy human-readable class label (e.g. CS-A)',
    roll_no        VARCHAR(10),
    phone          VARCHAR(20),
    guardian_phone VARCHAR(20),
    email          VARCHAR(120),
    fee_status     ENUM('paid','pending','overdue') DEFAULT 'pending',
    dob            DATE,
    password_hash  VARCHAR(256) NOT NULL,
    portal         ENUM('active','inactive') DEFAULT 'active',
    subject_group  VARCHAR(50)  DEFAULT 'Computer Science'
                   COMMENT 'Determines which subjects the student takes',
    photo          LONGTEXT     COMMENT 'Base64-encoded profile photo',
    class_id       INT          DEFAULT NULL  COMMENT 'FK → classes.id',
    section_id     INT          DEFAULT NULL  COMMENT 'FK → sections.id',
    CONSTRAINT fk_students_class
        FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_students_section
        FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_students_class      (class_id),
    INDEX idx_students_section    (section_id),
    INDEX idx_students_fee_status (fee_status),
    INDEX idx_students_portal     (portal),
    INDEX idx_students_cls        (cls)   COMMENT 'Supports legacy cls-string filtering'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Main student records. class_id/section_id are the authoritative FK fields.';

-- ============================================================
-- SECTION 8: ATTENDANCE  (references students)
-- ============================================================

CREATE TABLE attendance (
    id         INT         AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(10) NOT NULL,
    date       DATE        NOT NULL,
    status     ENUM('present','absent','late') DEFAULT 'absent',
    marked_by  VARCHAR(10) DEFAULT NULL  COMMENT 'teacher_id or NULL (admin)',
    marked_at  DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_attendance (student_id, date),
    CONSTRAINT fk_attendance_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_attendance_date    (date),
    INDEX idx_attendance_student (student_id),
    INDEX idx_attendance_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Daily attendance records. One row per student per date (UPSERT pattern).';

-- ============================================================
-- SECTION 9: GRADES
-- ============================================================

CREATE TABLE grades (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    student_id  VARCHAR(10)  NOT NULL,
    subject     VARCHAR(100) NOT NULL,
    midterm     INT          DEFAULT 0 CHECK (midterm >= 0),
    final_marks INT          DEFAULT 0 CHECK (final_marks >= 0),
    internal    INT          DEFAULT 0 CHECK (internal >= 0),
    total       INT          GENERATED ALWAYS AS (midterm + final_marks + internal) STORED,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_grade (student_id, subject),
    CONSTRAINT fk_grades_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_grades_student (student_id),
    INDEX idx_grades_subject (subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Subject-wise marks. total is a generated (computed) column.';

-- ============================================================
-- SECTION 10: EXAMS
-- ============================================================

CREATE TABLE exams (
    id          VARCHAR(10)  PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    subject     VARCHAR(100),
    cls         VARCHAR(20)  COMMENT 'Legacy class label',
    class_id    INT          DEFAULT NULL  COMMENT 'FK → classes.id (preferred)',
    section_id  INT          DEFAULT NULL  COMMENT 'FK → sections.id (optional)',
    exam_date   DATE,
    exam_time   VARCHAR(20),
    duration    VARCHAR(30),
    room        VARCHAR(50),
    total_marks INT          DEFAULT 100,
    CONSTRAINT fk_exams_class
        FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_exams_section
        FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_exams_class   (class_id),
    INDEX idx_exams_date    (exam_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Scheduled exam events. class_id is the authoritative class reference.';

-- ============================================================
-- SECTION 11: ASSIGNMENTS & SUBMISSIONS
-- ============================================================

CREATE TABLE assignments (
    id           VARCHAR(30)  PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    subject      VARCHAR(100),
    cls          VARCHAR(20)  COMMENT 'Legacy class label',
    class_id     INT          DEFAULT NULL,
    section_id   INT          DEFAULT NULL,
    teacher_id   VARCHAR(10),
    teacher_name VARCHAR(100),
    due_date     DATE,
    description  TEXT,
    created_date DATE         DEFAULT NULL,
    CONSTRAINT fk_assignments_class
        FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_assignments_section
        FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_assignments_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_assignments_class   (class_id),
    INDEX idx_assignments_teacher (teacher_id),
    INDEX idx_assignments_due     (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE submissions (
    id             VARCHAR(30) PRIMARY KEY,
    assignment_id  VARCHAR(30),
    student_id     VARCHAR(10),
    student_name   VARCHAR(100),
    cls            VARCHAR(20),
    file_name      VARCHAR(200),
    file_data      LONGTEXT,
    submitted_date DATE        DEFAULT NULL,
    grade          INT,
    feedback       TEXT,
    status         ENUM('submitted','graded') DEFAULT 'submitted',
    CONSTRAINT fk_submissions_assignment
        FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_submissions_student
        FOREIGN KEY (student_id)    REFERENCES students(id)    ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_submissions_assignment (assignment_id),
    INDEX idx_submissions_student    (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 12: NOTICES, COMPLAINTS, TIMETABLES
-- ============================================================

CREATE TABLE notices (
    id           BIGINT       AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    type         VARCHAR(50)  DEFAULT 'academic',
    author       VARCHAR(100) DEFAULT 'Admin',
    created_date DATE         DEFAULT NULL,
    INDEX idx_notices_date (created_date),
    INDEX idx_notices_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE complaints (
    id             BIGINT       AUTO_INCREMENT PRIMARY KEY,
    student_id     VARCHAR(10),
    student_name   VARCHAR(100),
    guardian_phone VARCHAR(20),
    teacher_id     VARCHAR(10),
    teacher_name   VARCHAR(100),
    message        TEXT,
    status         ENUM('open','resolved') DEFAULT 'open',
    created_date   DATE         DEFAULT NULL,
    CONSTRAINT fk_complaints_student
        FOREIGN KEY (student_id)  REFERENCES students(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_complaints_teacher
        FOREIGN KEY (teacher_id)  REFERENCES teachers(id)  ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_complaints_student (student_id),
    INDEX idx_complaints_teacher (teacher_id),
    INDEX idx_complaints_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE timetables (
    teacher_id    VARCHAR(10) PRIMARY KEY,
    name          VARCHAR(200),
    data          LONGTEXT    COMMENT 'Base64-encoded timetable file',
    uploaded_date DATE        DEFAULT NULL,
    CONSTRAINT fk_timetables_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SECTION 13: FEE MANAGEMENT
-- ============================================================

CREATE TABLE fee_vouchers (
    id         INT         AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(10) NOT NULL,
    month      VARCHAR(30),
    amount     INT         DEFAULT 15000 CHECK (amount >= 0),
    due_date   DATE,
    status     ENUM('paid','pending','overdue') DEFAULT 'pending',
    voucher_no VARCHAR(50) UNIQUE,
    paid_date  DATE,
    CONSTRAINT fk_fee_vouchers_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_fv_student (student_id),
    INDEX idx_fv_status  (status),
    INDEX idx_fv_month   (month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fee_plans (
    id         INT         AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(10) NOT NULL UNIQUE,
    total_fee  INT         CHECK (total_fee >= 0),
    session    VARCHAR(20),
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fee_plans_student
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fee_installments (
    id         INT  AUTO_INCREMENT PRIMARY KEY,
    plan_id    INT  NOT NULL,
    inst_no    INT,
    amount     INT  CHECK (amount >= 0),
    due_date   DATE,
    status     ENUM('paid','pending') DEFAULT 'pending',
    voucher_no VARCHAR(50),
    paid_date  DATE,
    receipt_no VARCHAR(50),
    CONSTRAINT fk_fee_installments_plan
        FOREIGN KEY (plan_id) REFERENCES fee_plans(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_fi_plan   (plan_id),
    INDEX idx_fi_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SECTION 14: SEED DATA
-- ============================================================

-- ── Admin (password: admin123) ───────────────────────────────
INSERT INTO admin_config (password_hash) VALUES
('scrypt:32768:8:1$hFr90qZCuQEyozju$f8aae7811e353c21cf7909c856f63ca2c5efee60c9168d9438bf61cabef9ed68d0c7d4f5c3b2541803f61ca1376c2047bd7590249db923c8726cc780c9f5c891');

-- ── Classes ──────────────────────────────────────────────────
INSERT INTO classes (id, name, code, description, status) VALUES
(1, 'Computer Science', 'CS',  'Programming, algorithms, databases',  'active'),
(2, 'Business Admin',   'BBA', 'Commerce, economics, management',     'active'),
(3, 'Medical Sciences', 'MED', 'Biology, chemistry, pre-med studies', 'active'),
(4, 'Non-Medical',      'NM',  'Physics, mathematics, engineering',   'active');

-- ── Sections ─────────────────────────────────────────────────
INSERT INTO sections (id, class_id, name, capacity, room) VALUES
(1, 1, 'Section A', 40, 'Room 101'),  -- CS / Section A
(2, 1, 'Section B', 40, 'Room 102'),  -- CS / Section B
(3, 2, 'Section A', 38, 'Room 201'),  -- BBA / Section A
(4, 2, 'Section B', 35, 'Room 202'),  -- BBA / Section B
(5, 3, 'Section A', 42, 'Room 301'),  -- Medical / Section A
(6, 4, 'Section A', 40, 'Room 401');  -- Non-Medical / Section A

-- ── Teachers (password: teach1–teach5) ───────────────────────
INSERT INTO teachers (id, name, subject, dept, qualification, phone, email, join_date, password_hash, portal, class_id, section_id) VALUES
('T001','Dr. Khalid Mehmood','Data Structures',    'Computer Science','PhD CS',      '03001111111','khalid@cms.edu','2015-03-01','scrypt:32768:8:1$M4FkO93Jb9wIh4Es$652e40ea61f743612e6a886a32a18102770277d4d30f24175020e31c321b21420d25a954b743ad6e831118b7fe2355f769f2a4cfcb5348982fdb73f479b1cf1a','active',1,1),
('T002','Prof. Amina Syed',  'Calculus',           'Mathematics',    'MPhil Math',  '03112222222','amina@cms.edu', '2018-08-15','scrypt:32768:8:1$taVMLAcQu5MM0bn6$25003d29741fb491f9cd415124aa220e718d87bfa10b4153ef8b9e30287c526f56a51ef5cc7f378ac3994011c30a7ee31985ad682bdb874471558497ca1f6440','active',1,1),
('T003','Mr. Tariq Javed',   'English Literature', 'English',        'MA English',  '03333333333','tariq@cms.edu', '2020-01-10','scrypt:32768:8:1$2BS2yyBlcOU9qdxn$15e54420eb8ec2674f8c465a13a84f1c8715e233c07b7dfa6870a32a6568afd8dd2bebe73b1c732bfd32fc72a141fb25a8b87f34f446a3e508a5223aff248c0b','active',1,2),
('T004','Ms. Rabia Nawaz',   'Microeconomics',     'Business Admin', 'MBA',         '03214444444','rabia@cms.edu', '2019-06-20','scrypt:32768:8:1$UA1kbyJeffKNsv1w$88dc858d1084df80c3a527a9a6399383deba9eed383207afb56b41144575c6fbd702eec530f24c3962b0f0cb612395e86f8fb1c3e30f9450f3f6d09ac06e1862','active',2,3),
('T005','Dr. Imran Sheikh',  'Physics',            'Sciences',       'PhD Physics', '03455555555','imran@cms.edu', '2012-09-01','scrypt:32768:8:1$ZjE71zEkscDeKmeX$f9441c4c8dc091b3173b5d32bd7558dfef017e13d1489799ff7e4b54d435efa64303c64136e775ea04c05cdeb9691ca56ea1b45c55d32c2fde1f13a6b1d023f7','active',4,6);

-- ── Teacher Assignments ───────────────────────────────────────
INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject_id) VALUES
('T001', 1, 1, 'Data Structures'),
('T001', 1, 2, 'Data Structures'),
('T002', 1, 1, 'Calculus'),
('T002', 2, 3, 'Calculus'),
('T003', 1, 2, 'English Literature'),
('T004', 2, 3, 'Microeconomics'),
('T004', 2, 4, 'Microeconomics'),
('T005', 4, 6, 'Physics');

-- ── Students (password: 1234) ─────────────────────────────────
-- cls = legacy label, class_id + section_id = authoritative FK references
INSERT INTO students (id, name, cls, roll_no, phone, guardian_phone, email, fee_status, dob, password_hash, portal, subject_group, class_id, section_id) VALUES
('S001','Ayesha Khan',     'CS-A', '01','03001234567','03009876543','ayesha@cms.edu', 'paid',    '2003-04-12','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Computer Science',1,1),
('S002','Hassan Raza',     'CS-A', '02','03119876543','03118765432','hassan@cms.edu', 'pending', '2003-07-22','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Computer Science',1,1),
('S003','Zara Ahmed',      'CS-B', '01','03335551234','03334441234','zara@cms.edu',   'paid',    '2004-01-09','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Medical',         1,2),
('S004','Ali Hamza',       'CS-B', '02','03217774321','03216664321','ali@cms.edu',    'paid',    '2003-11-30','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Non-Medical',     1,2),
('S005','Sara Malik',      'BBA-A','01','03452223344','03453334455','sara@cms.edu',   'overdue', '2004-03-15','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Business',        2,3),
('S006','Usman Tariq',     'BBA-A','02','03128889900','03127779900','usman@cms.edu',  'paid',    '2003-08-05','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Business',        2,3),
('S007','Hina Butt',       'BBA-B','01','03231112233','03232223344','hina@cms.edu',   'pending', '2004-06-18','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Medical',         2,4),
('S008','Farhan Siddiqui', 'CS-A', '03','03014445566','03015556677','farhan@cms.edu', 'paid',    '2003-12-01','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Computer Science',1,1),
('S009','Bilal Ahmed',     'CS-B', '03','03321112233','03322223344','bilal@cms.edu',  'paid',    '2004-02-10','scrypt:32768:8:1$4vqsEe7Qs9f7JtZ4$f7d038954f369d234a477b3bea6f27f69e48bb885b046ce7c3abf206f0f9d1ac7c9487f6d6752f8804631ac0738e8e4819e1ebe6ac2b6c9494138f3bda1de064','active','Computer Science',1,2);

-- ============================================================
-- SECTION 15: USEFUL VIEWS  (optional but recommended for reports)
-- ============================================================

-- View: student with their class and section names (avoids repeated JOINs)
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
    c.name  AS class_name,
    c.code  AS class_code,
    sec.name AS section_name
FROM students s
LEFT JOIN classes  c   ON c.id   = s.class_id
LEFT JOIN sections sec ON sec.id = s.section_id;

-- View: attendance summary per student (useful for report generation)
CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
    a.student_id,
    s.name        AS student_name,
    s.cls,
    s.class_id,
    s.section_id,
    COUNT(*)                                             AS total_days,
    SUM(a.status = 'present')                            AS present_days,
    SUM(a.status = 'absent')                             AS absent_days,
    SUM(a.status = 'late')                               AS late_days,
    ROUND(SUM(a.status = 'present') / COUNT(*) * 100, 1) AS attendance_pct
FROM attendance a
JOIN students s ON s.id = a.student_id
GROUP BY a.student_id, s.name, s.cls, s.class_id, s.section_id;

-- ============================================================
-- MIGRATION GUIDE (for existing databases — SKIP on fresh install)
-- Run these only if you have an EXISTING nexus_cms database
-- that was created from the old schema.sql without class_id/section_id
-- on teachers, or without the teacher_assignments table.
-- ============================================================
--
-- Step 1: Add class_id / section_id to teachers (if missing)
--
--   ALTER TABLE teachers
--     ADD COLUMN IF NOT EXISTS class_id   INT DEFAULT NULL AFTER photo,
--     ADD COLUMN IF NOT EXISTS section_id INT DEFAULT NULL AFTER class_id;
--   ALTER TABLE teachers
--     ADD CONSTRAINT fk_teachers_class
--       FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL ON UPDATE CASCADE,
--     ADD CONSTRAINT fk_teachers_section
--       FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE SET NULL ON UPDATE CASCADE,
--     ADD INDEX idx_teachers_class   (class_id),
--     ADD INDEX idx_teachers_section (section_id);
--
-- Step 2: Add class_id / section_id to exams (if missing)
--
--   ALTER TABLE exams
--     ADD COLUMN IF NOT EXISTS class_id   INT DEFAULT NULL,
--     ADD COLUMN IF NOT EXISTS section_id INT DEFAULT NULL,
--     ADD CONSTRAINT fk_exams_class   FOREIGN KEY (class_id)   REFERENCES classes(id)   ON DELETE SET NULL,
--     ADD CONSTRAINT fk_exams_section FOREIGN KEY (section_id) REFERENCES sections(id)  ON DELETE SET NULL;
--
-- Step 3: Create teacher_assignments (if missing)
--
--   CREATE TABLE IF NOT EXISTS teacher_assignments ( ... );  -- see SECTION 5 above
--
-- Step 4: Create the views
--
--   -- (copy VIEW definitions from SECTION 15 above)
--
-- ============================================================
-- DONE — Run: python app.py | Open: http://127.0.0.1:5000
-- ============================================================

-- ============================================================
-- FIX: Correct teacher password hashes (teach1–teach5)
-- Run this on existing databases where teachers cannot login
-- ============================================================
UPDATE teachers SET password_hash='scrypt:32768:8:1$M4FkO93Jb9wIh4Es$652e40ea61f743612e6a886a32a18102770277d4d30f24175020e31c321b21420d25a954b743ad6e831118b7fe2355f769f2a4cfcb5348982fdb73f479b1cf1a' WHERE id='T001';
UPDATE teachers SET password_hash='scrypt:32768:8:1$taVMLAcQu5MM0bn6$25003d29741fb491f9cd415124aa220e718d87bfa10b4153ef8b9e30287c526f56a51ef5cc7f378ac3994011c30a7ee31985ad682bdb874471558497ca1f6440' WHERE id='T002';
UPDATE teachers SET password_hash='scrypt:32768:8:1$2BS2yyBlcOU9qdxn$15e54420eb8ec2674f8c465a13a84f1c8715e233c07b7dfa6870a32a6568afd8dd2bebe73b1c732bfd32fc72a141fb25a8b87f34f446a3e508a5223aff248c0b' WHERE id='T003';
UPDATE teachers SET password_hash='scrypt:32768:8:1$UA1kbyJeffKNsv1w$88dc858d1084df80c3a527a9a6399383deba9eed383207afb56b41144575c6fbd702eec530f24c3962b0f0cb612395e86f8fb1c3e30f9450f3f6d09ac06e1862' WHERE id='T004';
UPDATE teachers SET password_hash='scrypt:32768:8:1$ZjE71zEkscDeKmeX$f9441c4c8dc091b3173b5d32bd7558dfef017e13d1489799ff7e4b54d435efa64303c64136e775ea04c05cdeb9691ca56ea1b45c55d32c2fde1f13a6b1d023f7' WHERE id='T005';
