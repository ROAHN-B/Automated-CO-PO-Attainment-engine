-- ============================================================================
-- Module 1 Database Migration: Course & Offering Structure (Part 2)
-- Target Database: CockroachDB (Using CockroachDB native STRING / INT4 types)
-- ============================================================================

-- 1. Courses Master Table (What is being taught - reusable master identity)
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    course_code STRING NOT NULL,
    course_name STRING NOT NULL,
    credits INT4 NOT NULL,
    lecture_hours_per_week INT4 NOT NULL DEFAULT 0,
    tutorial_hours_per_week INT4 NOT NULL DEFAULT 0,
    practical_hours_per_week INT4 NOT NULL DEFAULT 0,
    course_type STRING NOT NULL CHECK (course_type IN ('THEORY', 'PRACTICAL', 'HYBRID')),
    status STRING DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT uq_institution_course_code UNIQUE (institution_id, course_code)
);

-- 2. Curriculum Courses Table (Course placement and category inside curriculum semester)
CREATE TABLE IF NOT EXISTS curriculum_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curriculums(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    course_category STRING NOT NULL CHECK (course_category IN ('CORE', 'PROFESSIONAL_ELECTIVE', 'OPEN_ELECTIVE', 'MANDATORY_AUDIT')),
    status STRING DEFAULT 'ACTIVE',
    CONSTRAINT uq_curriculum_semester_course UNIQUE (curriculum_id, semester_id, course_id)
);

-- 3. Elective Groups Table (Elective baskets and selection rules)
CREATE TABLE IF NOT EXISTS elective_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    group_name STRING NOT NULL, -- e.g., 'Professional Elective - I'
    min_selections INT4 NOT NULL DEFAULT 1,
    max_selections INT4 NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 4. Elective Group Courses Table (Allowed curriculum-course options per elective group)
CREATE TABLE IF NOT EXISTS elective_group_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elective_group_id UUID NOT NULL REFERENCES elective_groups(id) ON DELETE CASCADE,
    curriculum_course_id UUID NOT NULL REFERENCES curriculum_courses(id) ON DELETE CASCADE,
    CONSTRAINT uq_group_curriculum_course UNIQUE (elective_group_id, curriculum_course_id)
);

-- 5. Course Offerings Table (Actual course run in a particular academic year)
CREATE TABLE IF NOT EXISTS course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_course_id UUID NOT NULL REFERENCES curriculum_courses(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    status STRING DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT uq_offering_curr_year UNIQUE (curriculum_course_id, academic_year_id)
);

-- 6. Course Sections Table (Optional minimal section distinction like Section A, B)
CREATE TABLE IF NOT EXISTS course_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    section_code STRING NOT NULL, -- e.g., 'A', 'B'
    CONSTRAINT uq_offering_section UNIQUE (course_offering_id, section_code)
);

-- 7. Course Faculty Assignments Table (Faculty assignment to teaching context)
CREATE TABLE IF NOT EXISTS course_faculty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    section_id UUID REFERENCES course_sections(id) ON DELETE CASCADE, -- Optional, if section-specific
    faculty_user_id UUID NOT NULL, -- References users table PK
    assignment_role STRING NOT NULL CHECK (assignment_role IN ('PRIMARY_LECTURER', 'LAB_ASSISTANT', 'CO_INSTRUCTOR')),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);