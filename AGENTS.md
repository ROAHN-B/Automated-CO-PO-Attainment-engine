REQUIREMENT STATUS
CONFIRMED
- Faculty subject allocation, accepted by the faculty (see COORDINATOR below)
- Assessment plan, generated from the coordinator's syllabus load distribution
- CAM
- Question paper validation (ISE and ESE theory papers only; the faculty types the paper, confirmed 28 Oct 2026, see
  QUESTION PAPER VALIDATION below)
- Marksheet generation and marks entry (faculty creates the marksheet and enters the marks: uploads the filled Excel
  template or types them in the app, then submits; confirmed 27 Oct 2026, see MARKS ENTRY below)
- CO-PO attainment
- Coordinator semester setup: faculty list (typed or imported from Excel), syllabus load distribution with declaration,
  11 POs and the department's 3 PSOs, subject allocation with email, acceptance tracking (confirmed 28 Oct 2026, see
  COORDINATOR below)
- Coordinator threshold/target configuration
- CO attainment formula (confirmed 25 Oct 2026, see ATTAINMENT FORMULA below)
- PO attainment formula (confirmed 25 Oct 2026, see ATTAINMENT FORMULA below)
- Indirect attainment inputs (course exit, examiner and additional surveys per CO)
- Strictly ordered faculty lifecycle (see FACULTY LIFECYCLE below)
- Cumulative CO-PO attainment with faculty approval (see FACULTY LIFECYCLE below)
- Live course workbook and its population logic (see COURSE WORKBOOK below)
- Two-stage CAM AI suggestions, every value faculty-confirmed (confirmed 25 Oct 2026, see CAM below)

PENDING SPECIFICATION
- Cell-level formatting of the downloadable marksheet template and exported workbook
- Official CAM scoring rubric and who maintains it (API_CONTRACT O-21); the proposed default is used until then
- Student workflow
- HOD workflow
- Guest workflow

DO NOT IMPLEMENT UNTIL SPECIFIED
- Student features
- HOD features
- Guest features

REMOVED FROM SCOPE
- Separate AI "report analysis" screen for faculty: the live course workbook replaces it.
- Lab assistant role and portal (removed 27 Oct 2026): faculty enter their own marks.
- Uploading and parsing question paper files (removed 28 Oct 2026): faculty type the paper into a form.
- Moderator role and "send to moderator" (removed 28 Oct 2026): moderation is done by hand on the college's
  moderation sheet, which the faculty downloads; the faculty confirms the paper.
- AI question generation, the question bank and question paper export (removed 28 Oct 2026; API_CONTRACT §11).
- Knowledge base / reference library (removed 28 Oct 2026; may return in a later version, do not build it now).
- Super Admin syllabus, course catalogue, elective, offering and PO/PSO screens (removed 28 Oct 2026): the coordinator
  owns that data. Super Admin keeps institution, academic years, departments, programs and users/roles.

QUESTION PAPER VALIDATION (API_CONTRACT §10)
- The faculty types the paper: set, maximum marks, duration, date; ticks the COs it covers from the finalized CAM; then
  enters each question (number, heading, optional attempt rule such as any 4 of 5), optional parts (a), (b), and
  sub-questions (text, MCQ options A-D when it's an MCQ, marks, expected Bloom level 1-6).
- The CO is set per question, or per part when a question has parts; sub-questions inherit it. Bloom level is per
  sub-question.
- The backend lists blocking issues (e.g. total with attempt rules must equal the maximum marks); validation runs only
  without issues. The AI returns per sub-question: CO alignment, detected Bloom level, MCQ check, score and notes.
- After the AI review the faculty can download the college's ISE moderation sheet (Word or PDF; API_CONTRACT §10.7.7):
  the paper setter's part is filled from the paper, the moderator's part, moderator names and moderation date stay
  blank for the hand-written moderation. ESE papers have no moderation sheet.
- "Confirm paper" locks the paper, completes the step, unlocks the marksheet and generates the marksheet structure
  from the paper. That marksheet is read-only; to change it the faculty reopens the paper (allowed until the
  marksheet is finalized). Finalizing the marksheet writes its question, max-marks and CO rows into the workbook and
  unlocks marks entry. The frontend never scores or derives alignment itself.

MARKS ENTRY (API_CONTRACT §13)
- Roles: Super Admin, HOD, Faculty, Coordinator (inside the Faculty portal). There is no lab assistant.
- The faculty creates the marksheet structure, then fills the marks either way on one draft: download the generated
  Excel template, fill it and import it, or type/correct marks in the in-app grid.
- The backend validates every value; invalid values are kept and flagged. Submitting needs no errors and a mark or
  "absent" for every student. One step: there is no separate marks approval.
- Submitting writes the marks into the workbook and unlocks that cycle's attainment calculation. Reopening returns the
  marks to draft (and reopens that cycle's attainment if it was already approved).

COORDINATOR (API_CONTRACT §15)
- A faculty member with the COORDINATOR role for ONE department, granted by Super Admin; shown as a "Coordination"
  section in the Faculty portal. Every coordinator call is limited to that department (the backend enforces it).
- Departments at launch: Computer Science, Information Technology, Electronics and Computer Engineering, Mechanical
  and Automation, Civil Engineering. They are data, not code.
- One semester setup per department + academic year + semester, semesters III to VIII only (first year excluded,
  O-26). Setups are isolated: nothing in one semester's syllabus or allocation affects another.
- Setup steps, server-enforced in order: semester -> faculty -> syllabus load distribution -> POs & PSOs ->
  declaration -> allocation -> complete.
- Faculty list: belongs to the department, reused every semester. First name, last name, college email (institution
  domain), phone. Typed in a form or imported from Excel (First Name, Last Name, Email ID, Phone Number): the backend
  validates and returns a preview with per-row errors; nothing is imported until the coordinator confirms, and only
  valid rows are imported. Adding faculty sends no email.
- Syllabus load distribution: the college's table (theory section, laboratory section, totals, grand total). Per row:
  group (PCC, PEC, MDM, RM, OJT, Capstone, or a department-added group), course code (placeholders like EN*3 allowed),
  name, L/T/P, credits, ESE, OE/POE, ISE, ICA. Each column with marks lists its items (category, count, marks each)
  and they must add up to the column total (O-27). A column with 0 marks means the component doesn't exist. Elective
  and MDM slots hold options; each offered option is its own subject. Rows can carry a MOOC alternative.
- The load distribution is the ONE source of truth for every subject's assessment structure: the faculty assessment
  plan, lifecycle, marksheets, workbook and reports are generated from it. Faculty never redefine it.
- Declaration: the coordinator ticks the confirmation; who, when and the syllabus version are recorded and the table
  locks. A revision makes a new version needing a new declaration, allowed only until the allocation is completed.
- POs and PSOs: exactly 11 POs shared by all departments (any coordinator can edit; versioned) and exactly 3 PSOs per
  department (only that department's coordinator). Faculty only view them.
- Allocation: one faculty member per subject and division; a faculty member can take any number of subjects in any
  semesters (separate records per semester). Views by subject and by faculty (with weekly hours across semesters).
  "Complete allocation" is refused while anything is unassigned; it creates the offerings and sends one email per
  faculty member listing their subjects, with a set-password link (never a password) or a sign-in link.
- Faculty accept each subject (first setup step, "Accept allocation"); there is no decline. The coordinator tracks
  Pending / Accepted per subject.

FACULTY LIFECYCLE (API_CONTRACT §7.1)
- Strictly ordered; the backend enforces locks (409 STAGE_LOCKED), the frontend only displays them.
- A. Setup: accept allocation -> assessment plan -> CAM.
- B. Assessment cycles, one after another in plan order (ISE-2 opens only after ISE-1's attainment is approved):
    exams (ISE, ESE theory): paper validation -> marksheet -> marks entry -> attainment approval
    activities, practicals, tutorials, POE/OE: marksheet -> marks entry -> attainment approval
  Only components the subject has produce cycles (from the coordinator's load distribution); never hard-code
  ESE -> ISE -> activities, and never show a section for a component the subject doesn't have.
- C. Close-out: indirect surveys -> final attainment approval -> submit to HOD.
- Attainment per cycle: submitted marks appear in the workbook -> "Calculate CO-PO attainment" -> calculation page with
  read-only inputs and targets -> calculate -> every step shown -> faculty approves -> workbook updated.
- Cumulative runs use only assessments whose marks are submitted. Before any ESE marks exist, ESE, direct, overall and PO/PSO values are
  shown as pending (option a): no rescaling, and ESE is never assumed to be 0.

CAM (API_CONTRACT §9)
- Four steps: course inputs -> unit -> CO mapping -> CO -> PO/PSO matrix -> finalize.
- Step 1, inputs: faculty type or paste the course objectives, COs and units (pre-filled from the syllabus when those
  exist). Until after the POE the faculty enters and edits the 11 POs and 3 PSOs here, starting from the
  department's (decided 29 Oct 2026); they move to the coordinator side once its backend exists. Activities, practicals
  and tutorials are one item per planned assessment; the faculty titles each and picks the COs it covers.
- COs have NO Bloom level (Bloom levels belong to questions only) and the CAM has NO expected proficiency or expected
  attainment percentages.
- Step 2 (stage 1): AI suggests unit -> CO links; faculty edits them and confirms the mapping. Every CO needs at least
  one unit. Changing COs or units later returns the mapping to draft.
- Step 3 (stage 2, only after stage 1 is confirmed): AI suggests CO -> PO/PSO levels (1/2/3/blank) with a rationale and
  the units/items it relies on; faculty accepts, edits or rejects each cell, and can set any cell by hand. Doubtful
  suggestions are flagged "needs review" and never accepted in bulk.
- Everything stays editable while the CAM is a draft; finalizing locks the whole CAM.
- AI only suggests; it never writes into the CAM and never overwrites a value the faculty set.
- The unit -> CO mapping belongs to the offering's CAM, not the syllabus.
- Activity/practical/tutorial -> CO links are faculty-entered only; AI never suggests them.
- Scoring rubric: Mayuri's proposed 3/2/1/blank criteria, labelled "proposed" in the UI and sent to the AI, until the
  institution confirms official wording (O-21).
- The frontend displays suggestions and saves faculty decisions; it never generates or scores CAM values itself.

COURSE WORKBOOK (API_CONTRACT §14.4)
- One workbook per course, from the theory or practical reference template (Main, CO1..COn, PO & PSO attainment, Data).
- Maintained by the backend only. Faculty view it in the app and download it; they never edit it.
- Filled automatically from allocation, coordinator targets, assessment plan, CAM, marksheets, approved marks,
  indirect surveys and approved attainment runs.
- Column blocks exist only for the subject's planned assessments: no blank blocks for components it doesn't have.

ATTAINMENT FORMULA
- Source of truth: the institution workbooks "CO Attainment_60 ESE(TH)V0.2.xlsx" (theory) and
  "CO Attainment_60 ESE(PR)V0.1.xlsx" (practical), transcribed in frontend/API_CONTRACT.md §14.1.
- Owner: backend (Abhijeet, Spring Boot). The formula is implemented ONLY in the backend.
- Frontend: displays the results returned by the API. It must never calculate, re-derive or
  "correct" attainment levels, direct/indirect/overall CO attainment, or PO/PSO attainment.
- Every weight and threshold is coordinator-configurable (API_CONTRACT §15.8), defaulting to the
  workbook values: ISE 0.4 / ESE 0.6, direct 0.8 / indirect 0.2, ISE target 60 % with levels
  50/60/70 % of students, ESE target 50 % with levels 60/70/80 (theory) or 50/60/70 (practical).
- Attainment uses only the coordinator's targets; the CAM holds no per-CO targets (O-18 resolved).
- Open points that do not block implementation: API_CONTRACT O-19 (theory workbook ESE-threshold bug),
  O-20 (absentees).
