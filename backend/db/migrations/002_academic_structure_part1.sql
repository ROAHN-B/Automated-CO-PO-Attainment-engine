-- ============================================================================
-- Module 1 Database Migration: Academic Structure (Part 1)
-- Target Database: CockroachDB (Aligned with existing departments table)
-- ============================================================================

-- 1. Academic Years Table (Institution-level academic timeline)
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    year_code STRING NOT NULL, -- e.g., '2026-2027'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOL DEFAULT FALSE,
    status STRING DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT uq_institution_year UNIQUE (institution_id, year_code)
);

-- 2. Programs Table (Degree/program offered by a department)
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
    program_code STRING NOT NULL, -- e.g., 'ECM'
    program_name STRING NOT NULL, -- e.g., 'Electronics and Computer Engineering'
    degree_type STRING NOT NULL, -- e.g., 'B_TECH', 'M_TECH'
    duration_years INT4 NOT NULL DEFAULT 4,
    status STRING DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT uq_department_program UNIQUE (department_id, program_code)
);

-- 3. Curriculums Table (Preserves curriculum revisions/history under a program)
CREATE TABLE IF NOT EXISTS curriculums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    curriculum_code STRING NOT NULL, -- e.g., 'CURR-2026'
    curriculum_name STRING NOT NULL, -- e.g., 'B.Tech ECM Revision 2026'
    effective_from_year STRING NOT NULL,
    total_semesters INT4 NOT NULL DEFAULT 8,
    status STRING DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT uq_program_curriculum UNIQUE (program_id, curriculum_code)
);

-- 4. Semesters Table (Semester structure specific to a curriculum version)
CREATE TABLE IF NOT EXISTS semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curriculums(id) ON DELETE CASCADE,
    semester_number INT4 NOT NULL, -- 1 to 8
    semester_code STRING NOT NULL, -- e.g., 'SEM-01'
    term_type STRING NOT NULL CHECK (term_type IN ('ODD', 'EVEN')),
    status STRING DEFAULT 'ACTIVE',
    CONSTRAINT uq_curriculum_semester UNIQUE (curriculum_id, semester_number)
);