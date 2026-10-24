REQUIREMENT STATUS
CONFIRMED
- Faculty subject allocation
- Assessment plan
- CAM
- Question paper validation (ISE and ESE theory papers only)
- Marksheet generation (faculty creates the marksheet; the lab assistant fills and uploads marks; faculty approves)
- CO-PO attainment
- Coordinator subject allocation
- Coordinator threshold/target configuration
- CO attainment formula (confirmed 25 Oct 2026, see ATTAINMENT FORMULA below)
- PO attainment formula (confirmed 25 Oct 2026, see ATTAINMENT FORMULA below)
- Indirect attainment inputs (course exit, examiner and additional surveys per CO)
- Strictly ordered faculty lifecycle (see FACULTY LIFECYCLE below)
- Cumulative CO-PO attainment with faculty approval (see FACULTY LIFECYCLE below)
- Live course workbook and its population logic (see COURSE WORKBOOK below)

PENDING SPECIFICATION
- Cell-level formatting of the downloadable marksheet template and exported workbook
- Student workflow
- HOD workflow
- Guest workflow

DO NOT IMPLEMENT UNTIL SPECIFIED
- Student features
- HOD features
- Guest features

REMOVED FROM SCOPE
- Separate AI "report analysis" screen for faculty: the live course workbook replaces it.

FACULTY LIFECYCLE (API_CONTRACT §7.1)
- Strictly ordered; the backend enforces locks (409 STAGE_LOCKED), the frontend only displays them.
- A. Setup: subject selection -> assessment plan -> CAM.
- B. Assessment cycles, one after another in plan order (ISE-2 opens only after ISE-1's attainment is approved):
    exams (ISE, ESE theory): paper validation -> marksheet -> lab upload -> marks approval -> attainment approval
    activities, practicals, tutorials, POE/OE: marksheet -> lab upload -> marks approval -> attainment approval
- C. Close-out: indirect surveys -> final attainment approval -> submit to HOD.
- Attainment per cycle: approved marks appear in the workbook -> "Calculate CO-PO attainment" -> calculation page with
  read-only inputs and targets -> calculate -> every step shown -> faculty approves -> workbook updated.
- Cumulative runs use only approved assessments. Before any ESE marks exist, ESE, direct, overall and PO/PSO values are
  shown as pending (option a): no rescaling, and ESE is never assumed to be 0.

COURSE WORKBOOK (API_CONTRACT §14.4)
- One workbook per course, from the theory or practical reference template (Main, CO1..COn, PO & PSO attainment, Data).
- Maintained by the backend only. Faculty view it in the app and download it; they never edit it.
- Filled automatically from allocation, coordinator targets, assessment plan, CAM, marksheets, approved marks,
  indirect surveys and approved attainment runs.

ATTAINMENT FORMULA
- Source of truth: the institution workbooks "CO Attainment_60 ESE(TH)V0.2.xlsx" (theory) and
  "CO Attainment_60 ESE(PR)V0.1.xlsx" (practical), transcribed in frontend/API_CONTRACT.md §14.1.
- Owner: backend (Abhijeet, Spring Boot). The formula is implemented ONLY in the backend.
- Frontend: displays the results returned by the API. It must never calculate, re-derive or
  "correct" attainment levels, direct/indirect/overall CO attainment, or PO/PSO attainment.
- Every weight and threshold is coordinator-configurable (API_CONTRACT §15.3), defaulting to the
  workbook values: ISE 0.4 / ESE 0.6, direct 0.8 / indirect 0.2, ISE target 60 % with levels
  50/60/70 % of students, ESE target 50 % with levels 60/70/80 (theory) or 50/60/70 (practical).
- Open points that do not block implementation: API_CONTRACT O-17 (PO count), O-18 (CAM per-CO
  targets), O-19 (theory workbook ESE-threshold bug), O-20 (absentees).
