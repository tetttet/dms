-- CME301 / PROJECT #1: DATABASE FOR STUDENT TRANSCRIPTS
-- PostgreSQL 14+ | Complete, self-contained DEMO database setup
-- Project 1: Student Transcripts
--
-- This database stores student information, departments, courses,
-- semesters, enrollments, and grades. It also supports semester GPA,
-- cumulative GPA, student transcripts, and grade statistics.
--
-- Run the script in your existing PostgreSQL database using pgAdmin,
-- DBeaver, Neon SQL Editor, or psql.
-- The SELECT queries at the end can be used to check the results.
--
-- Note: Running this script again will delete and recreate the prj1
-- schema, including its existing data. Other schemas and databases
-- will not be affected. All sample data is fictional.
--
-- GPA calculation:
-- GPA = SUM(credits * grade points) / SUM(graded credits)
--
-- F counts as 0 grade points.
-- D and higher earn course credits.
-- P earns credits but does not affect GPA.
-- W and I are excluded from GPA calculations.
-- Retaken courses are counted as separate attempts.
--
-- These grading rules can be adjusted according to university policy.

BEGIN;
DROP SCHEMA IF EXISTS prj1 CASCADE;
CREATE SCHEMA prj1;
SET LOCAL search_path TO prj1, public;

-- ============================================================================
-- 1. CORE DATABASE TABLES AND RELATIONSHIPS
-- ============================================================================

CREATE TABLE departments (
    department_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           VARCHAR(12) NOT NULL UNIQUE,
    name           VARCHAR(120) NOT NULL UNIQUE,
    office         VARCHAR(80),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_department_code CHECK (code ~ '^[A-Z]{2,12}$')
);

CREATE TABLE degree_programs (
    program_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id  BIGINT NOT NULL REFERENCES departments(department_id),
    code           VARCHAR(20) NOT NULL UNIQUE,
    name           VARCHAR(150) NOT NULL,
    degree_level   VARCHAR(16) NOT NULL
                   CHECK (degree_level IN ('BACHELOR', 'MASTER', 'PHD')),
    duration_years SMALLINT NOT NULL CHECK (duration_years BETWEEN 1 AND 8),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (department_id, name, degree_level)
);

CREATE TABLE instructors (
    instructor_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id  BIGINT NOT NULL REFERENCES departments(department_id),
    employee_no    VARCHAR(20) NOT NULL UNIQUE,
    first_name     VARCHAR(60) NOT NULL,
    last_name      VARCHAR(60) NOT NULL,
    email          VARCHAR(160) NOT NULL UNIQUE,
    academic_title VARCHAR(50) NOT NULL DEFAULT 'Lecturer',
    hired_on       DATE NOT NULL,
    active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE students (
    student_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id       BIGINT NOT NULL REFERENCES degree_programs(program_id),
    student_number   VARCHAR(20) NOT NULL UNIQUE,
    first_name       VARCHAR(60) NOT NULL,
    last_name        VARCHAR(60) NOT NULL,
    email            VARCHAR(160) NOT NULL UNIQUE,
    birth_date       DATE,
    admission_date   DATE NOT NULL,
    graduation_date  DATE,
    academic_status  VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
                     CHECK (academic_status IN ('ACTIVE', 'ON_LEAVE', 'GRADUATED')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_graduation_date CHECK (
        graduation_date IS NULL OR graduation_date >= admission_date
    ),
    CONSTRAINT ck_graduated_has_date CHECK (
        academic_status <> 'GRADUATED' OR graduation_date IS NOT NULL
    )
);

CREATE TABLE courses (
    course_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id         BIGINT NOT NULL REFERENCES departments(department_id),
    default_instructor_id BIGINT REFERENCES instructors(instructor_id),
    code                  VARCHAR(16) NOT NULL UNIQUE,
    title                 VARCHAR(150) NOT NULL,
    credits               SMALLINT NOT NULL CHECK (credits BETWEEN 1 AND 12),
    course_level          SMALLINT NOT NULL CHECK (course_level IN (100, 200, 300, 400, 500, 600)),
    description           TEXT,
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_course_code CHECK (code ~ '^[A-Z]{2,8}[0-9]{3}$')
);

CREATE TABLE course_prerequisites (
    course_id         BIGINT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    prerequisite_id   BIGINT NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT,
    PRIMARY KEY (course_id, prerequisite_id),
    CONSTRAINT ck_not_own_prerequisite CHECK (course_id <> prerequisite_id)
);
-- This catalog records direct prerequisites; registration rules can validate
-- them in the future application's registration workflow.

CREATE TABLE academic_terms (
    term_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    term_code      VARCHAR(8) NOT NULL UNIQUE,
    academic_year  VARCHAR(9) NOT NULL,
    term_name      VARCHAR(12) NOT NULL
                   CHECK (term_name IN ('FALL', 'SPRING', 'SUMMER')),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    is_current     BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_term_dates CHECK (end_date > start_date),
    CONSTRAINT ck_academic_year CHECK (academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
    UNIQUE (academic_year, term_name)
);
CREATE UNIQUE INDEX uq_one_current_term ON academic_terms (is_current)
WHERE is_current;

CREATE TABLE course_offerings (
    offering_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id      BIGINT NOT NULL REFERENCES courses(course_id),
    term_id        BIGINT NOT NULL REFERENCES academic_terms(term_id),
    instructor_id  BIGINT NOT NULL REFERENCES instructors(instructor_id),
    section_code   VARCHAR(8) NOT NULL DEFAULT 'A',
    capacity       SMALLINT NOT NULL DEFAULT 40 CHECK (capacity BETWEEN 1 AND 500),
    delivery_mode  VARCHAR(12) NOT NULL DEFAULT 'ON_CAMPUS'
                   CHECK (delivery_mode IN ('ON_CAMPUS', 'ONLINE', 'HYBRID')),
    UNIQUE (course_id, term_id, section_code)
);

CREATE TABLE grade_scale (
    grade_code       VARCHAR(2) PRIMARY KEY,
    grade_points     NUMERIC(3,2),
    earns_credits    BOOLEAN NOT NULL DEFAULT FALSE,
    description      VARCHAR(100) NOT NULL,
    CONSTRAINT ck_valid_grade_points CHECK (
        grade_points IS NULL OR grade_points BETWEEN 0.00 AND 4.00
    )
);

CREATE TABLE enrollments (
    enrollment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id    BIGINT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    offering_id   BIGINT NOT NULL REFERENCES course_offerings(offering_id),
    status        VARCHAR(12) NOT NULL DEFAULT 'ENROLLED'
                  CHECK (status IN ('ENROLLED', 'COMPLETED', 'WITHDRAWN', 'INCOMPLETE')),
    grade_code    VARCHAR(2) REFERENCES grade_scale(grade_code),
    final_score   NUMERIC(5,2) CHECK (final_score BETWEEN 0 AND 100),
    enrolled_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    graded_at     DATE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, offering_id),
    CONSTRAINT ck_enrollment_grade_state CHECK (
        (status = 'ENROLLED' AND grade_code IS NULL AND graded_at IS NULL)
        OR
        (status = 'COMPLETED' AND grade_code IS NOT NULL
         AND grade_code NOT IN ('W', 'I') AND graded_at IS NOT NULL)
        OR
        (status = 'WITHDRAWN' AND grade_code = 'W' AND graded_at IS NULL)
        OR
        (status = 'INCOMPLETE' AND grade_code = 'I' AND graded_at IS NULL)
    ),
    CONSTRAINT ck_score_only_when_completed CHECK (
        final_score IS NULL OR status = 'COMPLETED'
    ),
    CONSTRAINT ck_grade_after_enrollment CHECK (
        graded_at IS NULL OR graded_at >= enrolled_at
    )
);

-- Application identities for the future website (NO demo passwords stored).
-- An actual website must use secure authentication, authorization and
-- student-specific access checks; this table alone is not login security.
CREATE TABLE app_users (
    user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    login_email    VARCHAR(160) NOT NULL UNIQUE,
    user_role      VARCHAR(12) NOT NULL
                   CHECK (user_role IN ('ADMIN', 'REGISTRAR', 'INSTRUCTOR', 'STUDENT')),
    student_id     BIGINT UNIQUE REFERENCES students(student_id) ON DELETE CASCADE,
    instructor_id  BIGINT UNIQUE REFERENCES instructors(instructor_id) ON DELETE CASCADE,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_user_role_relation CHECK (
        (user_role = 'STUDENT' AND student_id IS NOT NULL AND instructor_id IS NULL)
        OR (user_role = 'INSTRUCTOR' AND instructor_id IS NOT NULL AND student_id IS NULL)
        OR (user_role IN ('ADMIN', 'REGISTRAR')
            AND student_id IS NULL AND instructor_id IS NULL)
    )
);

-- ============================================================================
-- 2. INDEXES ON LOOKUP KEYS, FOREIGN KEYS, TRANSCRIPTS AND REPORTING
-- ============================================================================
CREATE INDEX idx_programs_department ON degree_programs(department_id);
CREATE INDEX idx_instructors_department ON instructors(department_id);
CREATE INDEX idx_students_program ON students(program_id);
CREATE INDEX idx_students_lastname ON students(last_name, first_name);
CREATE INDEX idx_courses_department ON courses(department_id);
CREATE INDEX idx_courses_instructor ON courses(default_instructor_id);
CREATE INDEX idx_prerequisites_required_course ON course_prerequisites(prerequisite_id);
CREATE INDEX idx_terms_dates ON academic_terms(start_date, end_date);
CREATE INDEX idx_offerings_term_course ON course_offerings(term_id, course_id);
CREATE INDEX idx_offerings_course ON course_offerings(course_id);
CREATE INDEX idx_offerings_instructor ON course_offerings(instructor_id);
CREATE INDEX idx_enrollments_student_status ON enrollments(student_id, status);
CREATE INDEX idx_enrollments_offering ON enrollments(offering_id);
CREATE INDEX idx_enrollments_grade ON enrollments(grade_code);

-- Automatically track row updates in the editable tables.
CREATE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enrollments_updated_at
BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. REFERENCE DATA: DEPARTMENTS, PROGRAMS, INSTRUCTORS, COURSES, TERMS
-- ============================================================================

INSERT INTO departments (code, name, office) VALUES
('CS',   'Computer Science',          'Technology Building, 2nd Floor'),
('MATH', 'Mathematics',               'Science Building, 1st Floor'),
('EE',   'Electrical Engineering',    'Engineering Building, 3rd Floor'),
('BUS',  'Business Administration',   'Business Building, 2nd Floor'),
('BIO',  'Biological Sciences',       'Science Building, 3rd Floor'),
('ENG',  'English and Writing',       'Humanities Building, 1st Floor'),
('HUM',  'Humanities and History',    'Humanities Building, 2nd Floor');

INSERT INTO degree_programs (department_id, code, name, degree_level, duration_years)
SELECT d.department_id, v.code, v.name, v.degree_level, v.duration_years
FROM (VALUES
    ('CS',   'CS-BSC',   'Computer Science',              'BACHELOR', 4),
    ('CS',   'DATA-BSC', 'Data Science',                  'BACHELOR', 4),
    ('CS',   'CS-MSC',   'Advanced Computer Science',     'MASTER',   2),
    ('MATH', 'MATH-BSC', 'Mathematics',                   'BACHELOR', 4),
    ('EE',   'EE-BSC',   'Electrical Engineering',        'BACHELOR', 4),
    ('BUS',  'BUS-BBA',  'Business Administration',       'BACHELOR', 4),
    ('BIO',  'BIO-BSC',  'Molecular Biology',             'BACHELOR', 4)
) AS v(dept_code, code, name, degree_level, duration_years)
JOIN departments d ON d.code = v.dept_code;

INSERT INTO instructors
(department_id, employee_no, first_name, last_name, email, academic_title, hired_on)
SELECT d.department_id, v.employee_no, v.first_name, v.last_name,
       v.email, v.academic_title, v.hired_on::date
FROM (VALUES
    ('CS',   'I001', 'Murat',    'Yilmaz',    'murat.yilmaz@example.com',    'Professor',           '2015-09-01'),
    ('CS',   'I002', 'Selin',    'Kaya',      'selin.kaya@example.com',      'Associate Professor', '2018-02-01'),
    ('CS',   'I003', 'Ahmet',    'Demir',     'ahmet.demir@example.com',     'Assistant Professor', '2020-09-01'),
    ('MATH', 'I004', 'Olga',     'Ivanova',   'olga.ivanova@example.com',   'Professor',           '2013-09-01'),
    ('MATH', 'I005', 'Emre',     'Arslan',    'emre.arslan@example.com',    'Lecturer',            '2022-02-01'),
    ('EE',   'I006', 'Derya',    'Celik',     'derya.celik@example.com',     'Associate Professor', '2017-09-01'),
    ('EE',   'I007', 'Kerem',    'Aydin',     'kerem.aydin@example.com',    'Lecturer',            '2021-09-01'),
    ('BUS',  'I008', 'Fatma',    'Ozdemir',   'fatma.ozdemir@example.com',   'Professor',           '2014-09-01'),
    ('BUS',  'I009', 'Can',      'Aksoy',     'can.aksoy@example.com',      'Lecturer',            '2020-02-01'),
    ('BIO',  'I010', 'Leyla',    'Koc',       'leyla.koc@example.com',       'Associate Professor', '2016-09-01'),
    ('ENG',  'I011', 'David',    'Wilson',    'david.wilson@example.com',    'Lecturer',            '2019-09-01'),
    ('HUM',  'I012', 'Nadia',    'Hassan',    'nadia.hassan@example.com',    'Professor',           '2012-09-01')
) AS v(dept_code, employee_no, first_name, last_name, email, academic_title, hired_on)
JOIN departments d ON d.code = v.dept_code;

INSERT INTO courses
(department_id, default_instructor_id, code, title, credits, course_level, description)
SELECT d.department_id, i.instructor_id, v.code, v.title,
       v.credits, v.course_level, v.description
FROM (VALUES
    ('CS',   'I001', 'CS101',   'Introduction to Programming',       3, 100, 'Programming basics, variables and control flow'),
    ('CS',   'I002', 'CS102',   'Object-Oriented Programming',         3, 100, 'Classes, inheritance and object-oriented design'),
    ('CS',   'I001', 'CS201',   'Data Structures',                    3, 200, 'Lists, stacks, trees and hash tables'),
    ('CS',   'I002', 'CS202',   'Database Management Systems',        3, 200, 'Relational modeling, SQL and indexing'),
    ('CS',   'I003', 'CS203',   'Computer Networks',                  3, 200, 'Networks and internet protocols'),
    ('CS',   'I001', 'CS301',   'Algorithms',                          3, 300, 'Algorithm analysis and optimization'),
    ('CS',   'I003', 'CS302',   'Software Engineering',              3, 300, 'Software lifecycle, testing and teamwork'),
    ('CS',   'I003', 'CS303',   'Web Development',                    3, 300, 'Client-server web application development'),
    ('CS',   'I002', 'CS304',   'Operating Systems',                  3, 300, 'Processes, scheduling and virtual memory'),
    ('MATH', 'I004', 'MATH101', 'Calculus I',                        4, 100, 'Limits, derivatives and integration'),
    ('MATH', 'I004', 'MATH102', 'Calculus II',                       4, 100, 'Series and multivariable foundations'),
    ('MATH', 'I005', 'MATH201', 'Linear Algebra',                    3, 200, 'Matrices, vector spaces and linear maps'),
    ('MATH', 'I005', 'MATH202', 'Probability and Statistics',       3, 200, 'Probability, distributions and inference'),
    ('EE',   'I006', 'EE101',   'Electrical Circuits I',              4, 100, 'DC and AC circuit analysis'),
    ('EE',   'I006', 'EE201',   'Electronics',                         4, 200, 'Semiconductors and amplifier circuits'),
    ('EE',   'I007', 'EE202',   'Digital Logic',                      3, 200, 'Boolean logic and digital systems'),
    ('BUS',  'I008', 'BUS101',  'Introduction to Business',          3, 100, 'Foundations of management and business'),
    ('BUS',  'I008', 'BUS201',  'Financial Accounting',               3, 200, 'Financial statements and accounting'),
    ('BUS',  'I009', 'BUS202',  'Marketing Principles',               3, 200, 'Market analysis and marketing strategy'),
    ('ENG',  'I011', 'ENG101',  'Academic English',                   2, 100, 'Academic writing and reading skills'),
    ('ENG',  'I011', 'ENG201',  'Technical Writing',                  2, 200, 'Technical documentation and reports'),
    ('BIO',  'I010', 'BIO101',  'Biology I',                          4, 100, 'Cell biology and general principles'),
    ('BIO',  'I010', 'BIO201',  'Genetics',                           4, 200, 'Inheritance, genes and molecular biology'),
    ('HUM',  'I012', 'HIS101',  'Modern History',                     2, 100, 'Modern global and regional history')
) AS v(dept_code, instructor_no, code, title, credits, course_level, description)
JOIN departments d ON d.code = v.dept_code
JOIN instructors i ON i.employee_no = v.instructor_no;

INSERT INTO course_prerequisites (course_id, prerequisite_id)
SELECT c.course_id, p.course_id
FROM (VALUES
    ('CS102',   'CS101'),
    ('CS201',   'CS102'),
    ('CS202',   'CS102'),
    ('CS203',   'CS102'),
    ('CS301',   'CS201'),
    ('CS302',   'CS201'),
    ('CS303',   'CS102'),
    ('CS304',   'CS201'),
    ('MATH102', 'MATH101'),
    ('MATH201', 'MATH101'),
    ('MATH202', 'MATH102'),
    ('EE201',   'EE101'),
    ('BUS201',  'BUS101'),
    ('BUS202',  'BUS101'),
    ('ENG201',  'ENG101'),
    ('BIO201',  'BIO101')
) AS v(course_code, prerequisite_code)
JOIN courses c ON c.code = v.course_code
JOIN courses p ON p.code = v.prerequisite_code;

INSERT INTO academic_terms
(term_code, academic_year, term_name, start_date, end_date, is_current) VALUES
('2023F', '2023/2024', 'FALL',   '2023-09-11', '2024-01-12', FALSE),
('2024S', '2023/2024', 'SPRING', '2024-02-05', '2024-06-07', FALSE),
('2024F', '2024/2025', 'FALL',   '2024-09-09', '2025-01-10', FALSE),
('2025S', '2024/2025', 'SPRING', '2025-02-03', '2025-06-06', FALSE),
('2025F', '2025/2026', 'FALL',   '2025-09-08', '2026-01-09', FALSE),
('2026S', '2025/2026', 'SPRING', '2026-02-02', '2026-06-05', FALSE),
('2026F', '2026/2027', 'FALL',   '2026-09-07', '2027-01-08', TRUE);

-- Offer lower-level subjects first; expand the catalog in later years.
-- Each matching course/term gets one section A; popular courses also get B.
INSERT INTO course_offerings
(course_id, term_id, instructor_id, section_code, capacity, delivery_mode)
SELECT c.course_id, t.term_id, c.default_instructor_id,
       'A',
       CASE WHEN c.code IN ('CS101', 'MATH101', 'ENG101') THEN 65 ELSE 40 END,
       CASE WHEN c.code IN ('ENG101', 'ENG201') AND t.term_code >= '2025F'
            THEN 'HYBRID' ELSE 'ON_CAMPUS' END
FROM courses c
CROSS JOIN academic_terms t
WHERE (t.term_code = '2023F' AND (c.course_level = 100 OR c.code = 'EE202'))
   OR (t.term_code = '2024S' AND c.course_level IN (100, 200))
   OR (t.term_code = '2024F' AND c.course_level IN (100, 200))
   OR (t.term_code IN ('2025S', '2025F', '2026S', '2026F'));

INSERT INTO course_offerings
(course_id, term_id, instructor_id, section_code, capacity, delivery_mode)
SELECT c.course_id, t.term_id, c.default_instructor_id,
       'B', 45, 'ONLINE'
FROM (VALUES
    ('CS101',   '2025F'),
    ('CS101',   '2026F'),
    ('MATH101', '2026F')
) AS v(course_code, term_code)
JOIN courses c ON c.code = v.course_code
JOIN academic_terms t ON t.term_code = v.term_code;

-- ============================================================================
-- 4. STUDENT, GRADE SCALE AND USER DEMO DATA
-- ============================================================================

INSERT INTO students
(program_id, student_number, first_name, last_name, email,
 birth_date, admission_date, academic_status)
SELECT p.program_id, v.student_no, v.first_name, v.last_name,
       v.email, v.birth_date::date, v.admitted::date, 'ACTIVE'
FROM (VALUES
    ('CS-BSC',   'S2023001', 'Aida',   'Karimova', 'aida.karimova@example.com',    '2005-03-12', '2023-09-01'),
    ('CS-BSC',   'S2023002', 'Timur',  'Bekov',    'timur.bekov@example.com',      '2005-07-21', '2023-09-01'),
    ('MATH-BSC', 'S2023003', 'Sofia',  'Petrova',  'sofia.petrova@example.com',    '2004-12-02', '2023-09-01'),
    ('EE-BSC',   'S2023004', 'Daniyar','Sadykov', 'daniyar.sadykov@example.com',   '2005-02-16', '2023-09-01'),
    ('BUS-BBA',  'S2023005', 'Elif',   'Yildiz',  'elif.yildiz@example.com',      '2005-05-30', '2023-09-01'),
    ('BIO-BSC',  'S2023006', 'Leyla',  'Aslan',   'leyla.aslan@example.com',      '2005-01-09', '2023-09-01'),
    ('CS-BSC',   'S2024001', 'Murat',  'Erdem',   'murat.erdem@example.com',      '2006-04-11', '2024-09-01'),
    ('CS-BSC',   'S2024002', 'Ayse',   'Cetin',   'ayse.cetin@example.com',       '2006-06-23', '2024-09-01'),
    ('EE-BSC',   'S2024003', 'Daniel', 'Park',    'daniel.park@example.com',      '2006-08-07', '2024-09-01'),
    ('BUS-BBA',  'S2024004', 'Maria',  'Lopez',   'maria.lopez@example.com',      '2006-10-13', '2024-09-01'),
    ('CS-BSC',   'S2025001', 'Amir',   'Nazarov', 'amir.nazarov@example.com',     '2007-02-18', '2025-09-01'),
    ('DATA-BSC', 'S2025002', 'Zeynep', 'Acar',    'zeynep.acar@example.com',      '2007-11-04', '2025-09-01'),
    ('BIO-BSC',  'S2025003', 'Ali',    'Rahman',  'ali.rahman@example.com',       '2007-01-15', '2025-09-01'),
    ('MATH-BSC', 'S2025004', 'Sara',   'Brown',   'sara.brown@example.com',       '2007-09-27', '2025-09-01'),
    ('CS-BSC',   'S2026001', 'Kemal',  'Sahin',   'kemal.sahin@example.com',      '2008-03-01', '2026-09-01'),
    ('BUS-BBA',  'S2026002', 'Nora',   'Ahmed',   'nora.ahmed@example.com',       '2008-05-22', '2026-09-01')
) AS v(program_code, student_no, first_name, last_name, email, birth_date, admitted)
JOIN degree_programs p ON p.code = v.program_code;

INSERT INTO grade_scale (grade_code, grade_points, earns_credits, description) VALUES
('A',  4.00, TRUE,  'Excellent'),
('A-', 3.70, TRUE,  'Very good (A-)'),
('B+', 3.30, TRUE,  'Very good (B+)'),
('B',  3.00, TRUE,  'Good'),
('B-', 2.70, TRUE,  'Good (B-)'),
('C+', 2.30, TRUE,  'Satisfactory (C+)'),
('C',  2.00, TRUE,  'Satisfactory'),
('D',  1.00, TRUE,  'Minimum pass'),
('F',  0.00, FALSE, 'Fail: affects GPA, no earned credits'),
('P', NULL, TRUE,  'Pass: earns credits but excluded from GPA'),
('W', NULL, FALSE, 'Withdrawn: excluded from GPA'),
('I', NULL, FALSE, 'Incomplete: excluded from GPA');

-- Website identities; only emails/relations, never plaintext passwords.
INSERT INTO app_users (login_email, user_role, student_id)
SELECT email, 'STUDENT', student_id FROM students;
INSERT INTO app_users (login_email, user_role, instructor_id)
SELECT email, 'INSTRUCTOR', instructor_id FROM instructors;
INSERT INTO app_users (login_email, user_role) VALUES
('admin@example.com', 'ADMIN'),
('registrar@example.com', 'REGISTRAR');

-- ============================================================================
-- 5. LARGE ENROLLMENT / GRADE TEST DATASET
-- ============================================================================
-- Row format: (student_number, term_code, course_code, grade_code, score).
-- Grade NULL => currently ENROLLED; W => WITHDRAWN; I => INCOMPLETE.
-- P => completed/pass, credits earned, no numerical GPA contribution.
-- All registrations use section A (section B is ready for future students).
-- These represent multiple cohorts, departments, retakes and GPA histories.

WITH seed(student_no, term_code, course_code, grade_code, score) AS (VALUES
    -- --------------------- FALL 2023 ---------------------
    ('S2023001','2023F','CS101',  'A',  96),
    ('S2023001','2023F','MATH101','B+', 87),
    ('S2023001','2023F','ENG101', 'A-', 91),
    ('S2023002','2023F','CS101',  'B',  82),
    ('S2023002','2023F','MATH101','C+', 77),
    ('S2023002','2023F','HIS101', 'P',  NULL),
    ('S2023003','2023F','MATH101','A',  97),
    ('S2023003','2023F','ENG101', 'A',  95),
    ('S2023003','2023F','HIS101', 'B+', 88),
    ('S2023004','2023F','EE101',  'B+', 89),
    ('S2023004','2023F','MATH101','B',  82),
    ('S2023004','2023F','EE202',  'B-', 79),
    ('S2023005','2023F','BUS101', 'A-', 92),
    ('S2023005','2023F','ENG101', 'B+', 87),
    ('S2023005','2023F','HIS101', 'C+', 76),
    ('S2023006','2023F','BIO101', 'A',  98),
    ('S2023006','2023F','ENG101', 'B',  84),
    ('S2023006','2023F','HIS101', 'B+', 88),

    -- --------------------- SPRING 2024 -------------------
    ('S2023001','2024S','CS102',  'A',  95),
    ('S2023001','2024S','MATH102','B',  84),
    ('S2023001','2024S','ENG201', 'A-', 91),
    ('S2023002','2024S','CS102',  'B-', 79),
    ('S2023002','2024S','MATH102','F',  43),
    ('S2023002','2024S','ENG101', 'B+', 87),
    ('S2023003','2024S','MATH102','A-', 93),
    ('S2023003','2024S','MATH201','F',  49),
    ('S2023003','2024S','ENG201', 'A',  96),
    ('S2023004','2024S','EE201',  'F',  44),
    ('S2023004','2024S','MATH102','C+', 76),
    ('S2023004','2024S','ENG201', 'B',  82),
    ('S2023005','2024S','BUS201', 'F',  41),
    ('S2023005','2024S','BUS202', 'B+', 88),
    ('S2023005','2024S','ENG201', 'A',  95),
    ('S2023006','2024S','BIO201', 'W',  NULL),
    ('S2023006','2024S','MATH101','B-', 78),
    ('S2023006','2024S','ENG201', 'B+', 89),

    -- --------------------- FALL 2024 ---------------------
    ('S2023001','2024F','CS201',  'A-', 93),
    ('S2023001','2024F','CS202',  'A',  98),
    ('S2023001','2024F','MATH201','B+', 88),
    ('S2023002','2024F','CS201',  'B',  84),
    ('S2023002','2024F','CS202',  'F',  39),
    ('S2023002','2024F','MATH201','C',  72),
    ('S2023003','2024F','MATH201','B+', 88),
    ('S2023003','2024F','MATH202','A-', 92),
    ('S2023003','2024F','ENG201', 'A',  96),
    ('S2023004','2024F','EE201',  'C+', 76),
    ('S2023004','2024F','EE202',  'B',  84),
    ('S2023004','2024F','MATH201','C',  70),
    ('S2023005','2024F','BUS201', 'B',  83),
    ('S2023005','2024F','BUS202', 'A-', 92),
    ('S2023005','2024F','ENG201', 'B+', 87),
    ('S2023006','2024F','BIO201', 'B+', 88),
    ('S2023006','2024F','MATH102','C',  73),
    ('S2023006','2024F','ENG101', 'B',  83),
    ('S2024001','2024F','CS101',  'A',  97),
    ('S2024001','2024F','MATH101','B+', 89),
    ('S2024001','2024F','ENG101', 'A-', 92),
    ('S2024002','2024F','CS101',  'B+', 87),
    ('S2024002','2024F','MATH101','B',  83),
    ('S2024002','2024F','HIS101', 'A',  96),
    ('S2024003','2024F','EE101',  'A-', 92),
    ('S2024003','2024F','MATH101','B',  84),
    ('S2024003','2024F','EE202',  'B+', 89),
    ('S2024004','2024F','BUS101', 'B+', 88),
    ('S2024004','2024F','ENG101', 'A',  96),
    ('S2024004','2024F','HIS101', 'B',  81),

    -- --------------------- SPRING 2025 -------------------
    ('S2023001','2025S','CS301',  'A-', 92),
    ('S2023001','2025S','CS303',  'A',  96),
    ('S2023001','2025S','MATH202','B+', 89),
    ('S2023002','2025S','CS203',  'B',  83),
    ('S2023002','2025S','CS303',  'A-', 90),
    ('S2023002','2025S','MATH202','C+', 76),
    ('S2023003','2025S','MATH202','A',  98),
    ('S2023003','2025S','MATH201','A-', 92),
    ('S2023003','2025S','ENG201', 'P',  NULL),
    ('S2023004','2025S','EE201',  'B-', 79),
    ('S2023004','2025S','EE202',  'B+', 88),
    ('S2023004','2025S','MATH202','C+', 77),
    ('S2023005','2025S','BUS202', 'A',  96),
    ('S2023005','2025S','BUS201', 'B+', 87),
    ('S2023005','2025S','MATH101','C',  70),
    ('S2023006','2025S','BIO201', 'A-', 92),
    ('S2023006','2025S','MATH202','B-', 79),
    ('S2023006','2025S','ENG201', 'A',  96),
    ('S2024001','2025S','CS102',  'A-', 91),
    ('S2024001','2025S','MATH102','B',  82),
    ('S2024001','2025S','ENG201', 'A',  96),
    ('S2024002','2025S','CS102',  'B+', 87),
    ('S2024002','2025S','MATH102','C+', 76),
    ('S2024002','2025S','ENG101', 'A-', 91),
    ('S2024003','2025S','EE201',  'B',  82),
    ('S2024003','2025S','MATH102','B-', 78),
    ('S2024003','2025S','ENG201', 'B+', 89),
    ('S2024004','2025S','BUS201', 'A-', 92),
    ('S2024004','2025S','BUS202', 'B',  84),
    ('S2024004','2025S','ENG201', 'A',  95),

    -- --------------------- FALL 2025 ---------------------
    ('S2023001','2025F','CS302',  'A',  97),
    ('S2023001','2025F','CS304',  'A-', 92),
    ('S2023001','2025F','CS203',  'B+', 88),
    ('S2023002','2025F','CS301',  'B',  82),
    ('S2023002','2025F','CS304',  'C+', 77),
    ('S2023002','2025F','CS202',  'B+', 88),
    ('S2023003','2025F','MATH202','A',  97),
    ('S2023003','2025F','MATH201','A',  98),
    ('S2023003','2025F','ENG101', 'P',  NULL),
    ('S2023004','2025F','EE201',  'B',  82),
    ('S2023004','2025F','MATH202','B-', 79),
    ('S2023004','2025F','EE202',  'B',  83),
    ('S2023005','2025F','BUS201', 'A-', 92),
    ('S2023005','2025F','BUS202', 'A',  95),
    ('S2023005','2025F','ENG201', 'B+', 87),
    ('S2023006','2025F','BIO201', 'A',  97),
    ('S2023006','2025F','ENG201', 'A-', 91),
    ('S2023006','2025F','MATH201','B',  83),
    ('S2024001','2025F','CS201',  'A-', 92),
    ('S2024001','2025F','CS202',  'A',  96),
    ('S2024001','2025F','MATH201','B+', 87),
    ('S2024002','2025F','CS201',  'B+', 88),
    ('S2024002','2025F','CS202',  'B',  83),
    ('S2024002','2025F','MATH201','C+', 76),
    ('S2024003','2025F','EE201',  'A-', 92),
    ('S2024003','2025F','EE202',  'B+', 87),
    ('S2024003','2025F','MATH201','B',  81),
    ('S2024004','2025F','BUS201', 'A',  96),
    ('S2024004','2025F','BUS202', 'A-', 91),
    ('S2024004','2025F','ENG201', 'B+', 88),
    ('S2025001','2025F','CS101',  'A-', 92),
    ('S2025001','2025F','MATH101','B+', 89),
    ('S2025001','2025F','ENG101', 'B',  84),
    ('S2025002','2025F','CS101',  'A',  97),
    ('S2025002','2025F','MATH101','A-', 92),
    ('S2025002','2025F','ENG101', 'B+', 88),
    ('S2025003','2025F','BIO101', 'B+', 88),
    ('S2025003','2025F','ENG101', 'B',  82),
    ('S2025003','2025F','HIS101', 'A-', 90),
    ('S2025004','2025F','MATH101','A',  97),
    ('S2025004','2025F','ENG101', 'B+', 87),
    ('S2025004','2025F','HIS101', 'A-', 93),

    -- --------------------- SPRING 2026 -------------------
    ('S2023001','2026S','CS302',  'A-', 93),
    ('S2023001','2026S','CS301',  'A',  98),
    ('S2023002','2026S','CS302',  'B+', 88),
    ('S2023002','2026S','CS203',  'B',  83),
    ('S2023003','2026S','MATH202','A',  96),
    ('S2023003','2026S','ENG201', 'A-', 92),
    ('S2023004','2026S','EE201',  'C',  72),
    ('S2023004','2026S','MATH202','B',  84),
    ('S2023005','2026S','BUS201', 'A',  97),
    ('S2023005','2026S','HIS101', 'P',  NULL),
    ('S2023006','2026S','BIO201', 'A-', 92),
    ('S2023006','2026S','MATH201','B+', 88),
    ('S2024001','2026S','CS301',  'A-', 92),
    ('S2024001','2026S','CS303',  'A',  96),
    ('S2024002','2026S','CS203',  'B+', 88),
    ('S2024002','2026S','CS303',  'A-', 91),
    ('S2024003','2026S','EE201',  'A',  95),
    ('S2024003','2026S','MATH202','B+', 87),
    ('S2024004','2026S','BUS201', 'A-', 92),
    ('S2024004','2026S','BUS202', 'A',  96),
    ('S2025001','2026S','CS102',  'B+', 88),
    ('S2025001','2026S','MATH102','B',  82),
    ('S2025001','2026S','ENG201', 'A-', 91),
    ('S2025002','2026S','CS102',  'A',  96),
    ('S2025002','2026S','MATH102','A-', 92),
    ('S2025002','2026S','ENG201', 'B+', 88),
    ('S2025003','2026S','BIO201', 'B',  83),
    ('S2025003','2026S','MATH101','C+', 77),
    ('S2025003','2026S','ENG201', 'A',  95),
    ('S2025004','2026S','MATH102','A-', 92),
    ('S2025004','2026S','MATH201','A',  98),
    ('S2025004','2026S','ENG201', 'B+', 88),

    -- --------------------- FALL 2026 (CURRENT) -----------
    ('S2023001','2026F','CS302',  NULL, NULL),
    ('S2023001','2026F','MATH202',NULL, NULL),
    ('S2023002','2026F','CS302',  NULL, NULL),
    ('S2023002','2026F','CS304',  NULL, NULL),
    ('S2023003','2026F','MATH202',NULL, NULL),
    ('S2023003','2026F','ENG201', NULL, NULL),
    ('S2023004','2026F','EE201',  NULL, NULL),
    ('S2023004','2026F','MATH201',NULL, NULL),
    ('S2023005','2026F','BUS202', NULL, NULL),
    ('S2023005','2026F','ENG201', NULL, NULL),
    ('S2023006','2026F','BIO201', NULL, NULL),
    ('S2023006','2026F','ENG201', NULL, NULL),
    ('S2024001','2026F','CS302',  NULL, NULL),
    ('S2024001','2026F','CS304',  NULL, NULL),
    ('S2024002','2026F','CS301',  NULL, NULL),
    ('S2024002','2026F','CS304',  NULL, NULL),
    ('S2024003','2026F','EE201',  NULL, NULL),
    ('S2024003','2026F','EE202',  NULL, NULL),
    ('S2024004','2026F','BUS202', NULL, NULL),
    ('S2024004','2026F','ENG201', NULL, NULL),
    ('S2025001','2026F','CS201',  NULL, NULL),
    ('S2025001','2026F','CS202',  NULL, NULL),
    ('S2025002','2026F','CS201',  NULL, NULL),
    ('S2025002','2026F','CS202',  NULL, NULL),
    ('S2025003','2026F','BIO201', NULL, NULL),
    ('S2025003','2026F','MATH102',NULL, NULL),
    ('S2025004','2026F','MATH202',NULL, NULL),
    ('S2025004','2026F','ENG201', NULL, NULL),
    ('S2026001','2026F','CS101',  NULL, NULL),
    ('S2026001','2026F','MATH101',NULL, NULL),
    ('S2026001','2026F','ENG101', NULL, NULL),
    ('S2026002','2026F','BUS101', NULL, NULL),
    ('S2026002','2026F','ENG101', NULL, NULL),
    ('S2026002','2026F','HIS101', NULL, NULL)
)
INSERT INTO enrollments
(student_id, offering_id, status, grade_code, final_score, enrolled_at, graded_at)
SELECT s.student_id,
       o.offering_id,
       CASE WHEN seed.grade_code IS NULL THEN 'ENROLLED'
            WHEN seed.grade_code = 'W' THEN 'WITHDRAWN'
            WHEN seed.grade_code = 'I' THEN 'INCOMPLETE'
            ELSE 'COMPLETED' END,
       seed.grade_code,
       seed.score,
       t.start_date - 14,
       CASE WHEN seed.grade_code IS NOT NULL AND seed.grade_code NOT IN ('W', 'I')
            THEN t.end_date + 7 ELSE NULL END
FROM seed
JOIN students s ON s.student_number = seed.student_no
JOIN academic_terms t ON t.term_code = seed.term_code
JOIN courses c ON c.code = seed.course_code
JOIN course_offerings o
  ON o.course_id = c.course_id
 AND o.term_id = t.term_id
 AND o.section_code = 'A';

-- One realistic incomplete test record (not graded, so excluded from GPA).
-- This extra record is in the already finished Spring 2026 term.
INSERT INTO enrollments
(student_id, offering_id, status, grade_code, enrolled_at)
SELECT s.student_id, o.offering_id, 'INCOMPLETE', 'I', t.start_date - 14
FROM students s
JOIN academic_terms t ON t.term_code = '2026S'
JOIN courses c ON c.code = 'CS304'
JOIN course_offerings o ON o.course_id = c.course_id AND o.term_id = t.term_id
                        AND o.section_code = 'A'
WHERE s.student_number = 'S2023002';

-- ============================================================================
-- 6. REPORTING VIEWS FOR TRANSCRIPTS, GPA AND WEBSITE CHARTS
-- ============================================================================

-- One row per student and semester, with term GPA and running cumulative GPA.
CREATE VIEW v_student_term_summary AS
WITH term_totals AS (
    SELECT
        e.student_id,
        t.term_id,
        t.term_code,
        t.academic_year,
        t.term_name,
        t.start_date,
        t.end_date,
        COUNT(*)::INTEGER AS registered_courses,
        COUNT(*) FILTER (WHERE e.status = 'COMPLETED')::INTEGER AS completed_courses,
        COUNT(*) FILTER (WHERE e.status = 'ENROLLED')::INTEGER AS active_courses,
        COUNT(*) FILTER (WHERE e.status = 'WITHDRAWN')::INTEGER AS withdrawn_courses,
        COUNT(*) FILTER (WHERE e.status = 'INCOMPLETE')::INTEGER AS incomplete_courses,
        COALESCE(SUM(c.credits) FILTER (
            WHERE e.status = 'COMPLETED' AND gs.grade_points IS NOT NULL
        ), 0)::INTEGER AS graded_credits,
        COALESCE(SUM(c.credits) FILTER (
            WHERE e.status = 'COMPLETED' AND gs.earns_credits
        ), 0)::INTEGER AS earned_credits,
        COALESCE(SUM(c.credits * gs.grade_points) FILTER (
            WHERE e.status = 'COMPLETED' AND gs.grade_points IS NOT NULL
        ), 0)::NUMERIC(12,2) AS term_grade_points
    FROM enrollments e
    JOIN course_offerings o ON o.offering_id = e.offering_id
    JOIN courses c ON c.course_id = o.course_id
    JOIN academic_terms t ON t.term_id = o.term_id
    LEFT JOIN grade_scale gs ON gs.grade_code = e.grade_code
    GROUP BY e.student_id, t.term_id, t.term_code, t.academic_year,
             t.term_name, t.start_date, t.end_date
), running AS (
    SELECT tt.*,
           SUM(graded_credits) OVER (
               PARTITION BY student_id ORDER BY start_date, term_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS cumulative_graded_credits,
           SUM(earned_credits) OVER (
               PARTITION BY student_id ORDER BY start_date, term_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS cumulative_earned_credits,
           SUM(term_grade_points) OVER (
               PARTITION BY student_id ORDER BY start_date, term_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS cumulative_grade_points
    FROM term_totals tt
)
SELECT r.student_id, r.term_id, r.term_code, r.academic_year,
       r.term_name, r.start_date, r.end_date,
       r.registered_courses, r.completed_courses, r.active_courses,
       r.withdrawn_courses, r.incomplete_courses,
       r.graded_credits, r.earned_credits, r.term_grade_points,
       ROUND(r.term_grade_points / NULLIF(r.graded_credits, 0), 2) AS term_gpa,
       r.cumulative_graded_credits, r.cumulative_earned_credits,
       r.cumulative_grade_points,
       ROUND(r.cumulative_grade_points /
             NULLIF(r.cumulative_graded_credits, 0), 2) AS cumulative_gpa
FROM running r;

-- The detailed transcript includes every course attempt and both GPAs.
CREATE VIEW v_student_transcript AS
SELECT
    s.student_id,
    s.student_number,
    s.first_name || ' ' || s.last_name AS student_name,
    p.code AS program_code,
    p.name AS program_name,
    d.name AS student_department,
    t.term_code,
    t.academic_year,
    t.term_name,
    t.start_date AS term_start_date,
    c.code AS course_code,
    c.title AS course_title,
    c.credits,
    o.section_code,
    i.first_name || ' ' || i.last_name AS instructor_name,
    e.status,
    e.final_score,
    e.grade_code,
    gs.grade_points,
    CASE WHEN e.status = 'COMPLETED' AND gs.earns_credits
         THEN c.credits ELSE 0 END AS earned_credits,
    e.graded_at,
    ts.term_gpa,
    ts.cumulative_gpa
FROM enrollments e
JOIN students s ON s.student_id = e.student_id
JOIN degree_programs p ON p.program_id = s.program_id
JOIN departments d ON d.department_id = p.department_id
JOIN course_offerings o ON o.offering_id = e.offering_id
JOIN courses c ON c.course_id = o.course_id
JOIN academic_terms t ON t.term_id = o.term_id
JOIN instructors i ON i.instructor_id = o.instructor_id
LEFT JOIN grade_scale gs ON gs.grade_code = e.grade_code
JOIN v_student_term_summary ts
  ON ts.student_id = e.student_id AND ts.term_id = t.term_id;

-- One row per student, including those with no grades yet.
CREATE VIEW v_student_overall_summary AS
SELECT
    s.student_id,
    s.student_number,
    s.first_name || ' ' || s.last_name AS student_name,
    p.code AS program_code,
    p.name AS program_name,
    d.name AS department_name,
    s.academic_status,
    COUNT(ts.term_id)::INTEGER AS semesters_registered,
    COALESCE(SUM(ts.registered_courses), 0)::INTEGER AS courses_registered,
    COALESCE(SUM(ts.completed_courses), 0)::INTEGER AS courses_completed,
    COALESCE(SUM(ts.graded_credits), 0)::INTEGER AS graded_credits,
    COALESCE(SUM(ts.earned_credits), 0)::INTEGER AS earned_credits,
    ROUND(COALESCE(SUM(ts.term_grade_points), 0) /
          NULLIF(COALESCE(SUM(ts.graded_credits), 0), 0), 2) AS cumulative_gpa
FROM students s
JOIN degree_programs p ON p.program_id = s.program_id
JOIN departments d ON d.department_id = p.department_id
LEFT JOIN v_student_term_summary ts ON ts.student_id = s.student_id
GROUP BY s.student_id, s.student_number, s.first_name, s.last_name,
         p.code, p.name, d.name, s.academic_status;

-- Aggregate data for bar/pie charts and course performance dashboards.
CREATE VIEW v_course_grade_statistics AS
SELECT
    t.term_code,
    c.code AS course_code,
    c.title AS course_title,
    c.credits,
    COUNT(e.enrollment_id)::INTEGER AS total_registrations,
    COUNT(e.enrollment_id) FILTER (
        WHERE e.status = 'COMPLETED'
    )::INTEGER AS completed_registrations,
    COUNT(e.enrollment_id) FILTER (
        WHERE e.status = 'ENROLLED'
    )::INTEGER AS active_registrations,
    COUNT(e.enrollment_id) FILTER (
        WHERE e.grade_code = 'F'
    )::INTEGER AS failed_registrations,
    ROUND(AVG(e.final_score) FILTER (
        WHERE e.status = 'COMPLETED'
    ), 2) AS average_final_score,
    ROUND(AVG(gs.grade_points) FILTER (
        WHERE e.status = 'COMPLETED' AND gs.grade_points IS NOT NULL
    ), 2) AS average_grade_points,
    ROUND(
        100.0 * COUNT(e.enrollment_id) FILTER (
            WHERE e.status = 'COMPLETED' AND gs.earns_credits
        ) / NULLIF(COUNT(e.enrollment_id) FILTER (
            WHERE e.status = 'COMPLETED'
        ), 0),
        2
    ) AS pass_rate_percent
FROM course_offerings o
JOIN courses c ON c.course_id = o.course_id
JOIN academic_terms t ON t.term_id = o.term_id
LEFT JOIN enrollments e ON e.offering_id = o.offering_id
LEFT JOIN grade_scale gs ON gs.grade_code = e.grade_code
GROUP BY t.term_code, c.code, c.title, c.credits;

CREATE VIEW v_department_gpa AS
SELECT department_name,
       COUNT(*)::INTEGER AS students_total,
       COUNT(cumulative_gpa)::INTEGER AS students_with_grades,
       ROUND(AVG(cumulative_gpa), 2) AS average_student_gpa
FROM v_student_overall_summary
GROUP BY department_name;

-- Convenient SQL functions for a future student-facing website.
CREATE FUNCTION get_student_transcript(p_student_number VARCHAR)
RETURNS SETOF v_student_transcript
LANGUAGE SQL STABLE AS $$
    SELECT * FROM prj1.v_student_transcript
    WHERE student_number = p_student_number;
$$;

CREATE FUNCTION get_student_gpa(p_student_number VARCHAR)
RETURNS NUMERIC
LANGUAGE SQL STABLE AS $$
    SELECT cumulative_gpa
    FROM prj1.v_student_overall_summary
    WHERE student_number = p_student_number;
$$;

-- ============================================================================
-- 7. SELF-CHECKS: FAIL/ROLL BACK THE TRANSACTION IF SEED DATA IS BROKEN
-- ============================================================================
DO $$
DECLARE
    v_students INTEGER;
    v_courses INTEGER;
    v_enrollments INTEGER;
    v_ungraded INTEGER;
    v_failures INTEGER;
    v_retakes INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_students FROM students;
    SELECT COUNT(*) INTO v_courses FROM courses;
    SELECT COUNT(*) INTO v_enrollments FROM enrollments;
    SELECT COUNT(*) INTO v_ungraded FROM enrollments WHERE status = 'ENROLLED';
    SELECT COUNT(*) INTO v_failures FROM enrollments WHERE grade_code = 'F';
    SELECT COUNT(*) INTO v_retakes
    FROM (
        SELECT e.student_id, o.course_id
        FROM enrollments e
        JOIN course_offerings o ON o.offering_id = e.offering_id
        GROUP BY e.student_id, o.course_id
        HAVING COUNT(*) > 1
    ) repeated_courses;

    IF v_students <> 16 THEN
        RAISE EXCEPTION 'Expected 16 students; found %', v_students;
    END IF;
    IF v_courses <> 24 THEN
        RAISE EXCEPTION 'Expected 24 courses; found %', v_courses;
    END IF;
    IF v_enrollments <> 205 THEN
        RAISE EXCEPTION 'Expected 205 enrollments; found %', v_enrollments;
    END IF;
    IF v_ungraded < 30 OR v_failures < 3 OR v_retakes < 3 THEN
        RAISE EXCEPTION 'Missing demo cases: active %, failures %, retakes %',
            v_ungraded, v_failures, v_retakes;
    END IF;
    IF (SELECT COUNT(*) FROM v_student_overall_summary) <> v_students THEN
        RAISE EXCEPTION 'Student summary does not match student count';
    END IF;
    RAISE NOTICE 'PRJ1 checks passed: % students, % courses, % enrollments, % active, % failed, % retakes',
        v_students, v_courses, v_enrollments, v_ungraded, v_failures, v_retakes;
END;
$$;

COMMIT;

-- ============================================================================
-- 8. READY-TO-RUN REPORT QUERIES / CHECKING QUERIES
-- ============================================================================
-- Table overview (all rows produced without needing to change search_path).
SELECT 'departments' AS entity, COUNT(*) AS total FROM prj1.departments
UNION ALL SELECT 'degree_programs', COUNT(*) FROM prj1.degree_programs
UNION ALL SELECT 'instructors', COUNT(*) FROM prj1.instructors
UNION ALL SELECT 'students', COUNT(*) FROM prj1.students
UNION ALL SELECT 'courses', COUNT(*) FROM prj1.courses
UNION ALL SELECT 'course_prerequisites', COUNT(*) FROM prj1.course_prerequisites
UNION ALL SELECT 'academic_terms', COUNT(*) FROM prj1.academic_terms
UNION ALL SELECT 'course_offerings', COUNT(*) FROM prj1.course_offerings
UNION ALL SELECT 'grade_scale', COUNT(*) FROM prj1.grade_scale
UNION ALL SELECT 'enrollments', COUNT(*) FROM prj1.enrollments
UNION ALL SELECT 'app_users', COUNT(*) FROM prj1.app_users
ORDER BY entity;

-- Example 1: complete course-by-course transcript for a student.
SELECT student_number, student_name, term_code, course_code,
       course_title, credits, status, grade_code, grade_points,
       term_gpa, cumulative_gpa
FROM prj1.v_student_transcript
WHERE student_number = 'S2023001'
ORDER BY term_start_date, course_code;

-- Example 2: GPA trend: one row per term (perfect for a line chart).
SELECT ts.term_code, ts.registered_courses, ts.earned_credits,
       ts.term_gpa, ts.cumulative_gpa
FROM prj1.v_student_term_summary ts
JOIN prj1.students s ON s.student_id = ts.student_id
WHERE s.student_number = 'S2023002'
ORDER BY ts.start_date;

-- Example 3: student leaderboard (GPA excludes current/ungraded classes).
SELECT student_number, student_name, program_code,
       courses_completed, earned_credits, cumulative_gpa
FROM prj1.v_student_overall_summary
ORDER BY cumulative_gpa DESC NULLS LAST, student_number;

-- Example 4: department comparison (bar chart).
SELECT * FROM prj1.v_department_gpa
ORDER BY average_student_gpa DESC NULLS LAST;

-- Example 5: grade distribution (pie/bar chart).
SELECT grade_code, COUNT(*) AS count_of_grades
FROM prj1.enrollments
WHERE grade_code IS NOT NULL
GROUP BY grade_code
ORDER BY count_of_grades DESC, grade_code;

-- Example 6: course pass rate and average final score.
SELECT term_code, course_code, total_registrations,
       completed_registrations, average_final_score, pass_rate_percent
FROM prj1.v_course_grade_statistics
WHERE total_registrations > 0
ORDER BY term_code, course_code;

-- Example 7: direct function calls.
SELECT prj1.get_student_gpa('S2023001') AS student_gpa;
SELECT * FROM prj1.get_student_transcript('S2023001')
ORDER BY term_start_date, course_code;

-- END OF PROJECT #1 SQL FILE.
