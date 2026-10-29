# Running the POE demo

Three processes: MongoDB, this Spring Boot backend, Mayuri's AI service. Then the Angular app.

| Process | Port | Command (from the repo root) |
| --- | --- | --- |
| MongoDB (Docker) | 27017 | `docker compose -f backend/compose.yaml up -d` |
| Backend (`dev` profile: local MongoDB, demo data) | 8081 | `cd backend` then `mvnw spring-boot:run -Dspring-boot.run.profiles=dev` |
| AI service | 8000 | `cd Mayuri/academic-ai-service` then `uvicorn app.main:app --port 8000` |
| Angular | 4200 | `cd frontend` then `npm start` |

The AI service needs `Mayuri/academic-ai-service/.env` with your own `GEMINI_API_KEY` (copy `.env.example`). Never commit it.

**Using the team's Atlas database instead of Docker:** set `MONGODB_URI` in the terminal that starts the backend
(PowerShell: `$env:MONGODB_URI = "mongodb+srv://copo_app_user:<password>@copo-dev.mm2mhwg.mongodb.net/co_po_attainment?authSource=admin"`),
then start it as above. Without it, the `dev` profile uses the local Docker MongoDB. Atlas only accepts connections from
IP addresses on the cluster's Network Access list. The demo data is seeded into whichever database it connects to.

## Demo accounts (dev profile only)

`faculty@wit.edu`, `coordinator@wit.edu`, `hod.ecm@wit.edu`, `superadmin@wit.edu`, all with the password from
`app.seed.demo-password` in `application-dev.properties`.

## What is live

The frontend's `environment.liveAreas` is `['auth', 'course']`: sign-in goes to this backend, and so does every course
the frontend mock doesn't know. For the POE that is **Network Security** (23ECU7E23T), allocated to `faculty@wit.edu`.
Computer Networks stays on the frontend mock, finished from start to close-out.

Live for Network Security, through the API_CONTRACT endpoints under `/api/v1`:

1. Sign-in (AUTH-1, AUTH-3, AUTH-4)
2. Dashboard and course (FAC-1 to FAC-4): accept the allocation
3. Assessment plan generated from the load distribution row (PLAN-1 to PLAN-3)
4. CAM pre-filled from the syllabus, with both AI stages from Mayuri's service; POs and PSOs editable (CAM-1 to CAM-6)
5. ISE question paper: issues, AI review, scores (QPV-1 to QPV-4, QPV-6, QPV-8)
6. Moderation sheet as Word and PDF (QPV-5)
7. Marksheet generated from the confirmed paper (MS-1, MS-3, MS-4 template)
8. Workbook with the marksheet's columns, read-only (WB-1, WB-2)

Marks entry, attainment and close-out come after the POE: those steps show as locked or waiting.

## Coordinator data

The coordinator backend comes after the POE, so `seed/PoeSeeder` hardcodes what the coordinator would provide: the
allocation, the load distribution row (ESE 60; ISE 2 × 15 tests + 2 × 5 activities), the syllabus (objectives, COs,
units), the department's 11 POs and 3 PSOs, and 30 students.

## Rehearsing again from step 1

Start the backend once with the reset switch; it deletes Network Security's plan, CAM, papers and marksheets and
allocates it again:

```
mvnw spring-boot:run -Dspring-boot.run.profiles=dev "-Dspring-boot.run.arguments=--app.seed.reset-course=true"
```

## Tests

`mvnw test` runs the whole flow above against a throwaway MongoDB in Docker, with the AI answers stubbed.
