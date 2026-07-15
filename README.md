# JADE HR Background Verification Assistant

A human-in-the-loop JADE HR background verification dashboard.

The system ingests employment verification emails, extracts the candidate details, compares them with Workday data, prepares a safe reply, and lets an HR user approve or reject the response exactly once.

## What This Project Does

- Authenticates HR users with JWT login.
- Reads incoming verification emails from Gmail/database mode or local JSON file mode.
- Uses an LLM to extract candidate details from email content.
- Falls back to regex parsing if the LLM extraction fails.
- Looks up employee data from Workday RaaS.
- Falls back to the base Workday employee list if the filtered Workday search fails with authentication/server errors.
- Compares claimed values against Workday values.
- Shows the comparison to HR before any outbound response is sent.
- Lets HR edit the recommended reply.
- Sends the reply through SMTP after approval/rejection.
- Stores decision logs for audit review.

## Tech Stack

- Backend: FastAPI
- Frontend: React + Vite
- Auth: JWT bearer token
- Database: MySQL-compatible SQLAlchemy async setup
- Email ingestion: Gmail IMAP or local JSON file
- AI extraction: Llama/Ollama-compatible chat endpoint
- Workday lookup: Workday RaaS JSON endpoint
- Outbound mail: SMTP

## Project Flow

```text
HR user logs in
    ↓
Incoming email is ingested
    ↓
Email appears in Mails as NEW
    ↓
Background processor extracts fields with LLM
    ↓
Processor looks up Workday record
    ↓
Claimed values are compared with Workday values
    ↓
HR opens the email
    ↓
Email status becomes PENDING
    ↓
HR reviews original email, comparison table, and editable reply
    ↓
HR approves or rejects
    ↓
Reply is queued through SMTP
    ↓
Email status becomes COMPLETED
    ↓
Decision appears in Logs
```

## Status Model

The app intentionally separates the HR workflow status from the LLM/background processing status.

### Mail Workflow Status

Shown in the frontend Mails page.

```text
new        Incoming mail, not opened by HR yet
pending    HR opened the mail, decision not sent yet
completed  HR approved/rejected and the reply was queued
```

### LLM Processing Status

Used internally by the background verification processor.

```text
new        Email has not been processed by LLM yet
pending    Email is currently being processed
processed  LLM + Workday comparison data was stored
error      Processing failed and should be debugged
```

## One-Time Decision Rule

Each email can be approved or rejected only once.

After a decision is recorded:

- the email becomes `completed`
- the approve/reject buttons disappear
- the reply text becomes read-only
- repeated API decision attempts return `409 Conflict`

## Verification Fields

The current comparison supports these fields:

```text
candidate_name
employee_id
nature_of_employment
start_date
end_date
last_designation
location
exit_formalities_completed
```

Text fields are compared case-insensitively after trimming. Date fields are compared strictly after date normalization.

## Workday Lookup Flow

The Workday service first tries the filtered/search URL:

```text
WORKDAY_RAAS_URL?format=json&employee_id=<id>&candidate_name=<name>
```

If that returns `401`, `403`, or `500`, the backend falls back to the base URL:

```text
WORKDAY_RAAS_URL?format=json
```

It then searches the returned employee list locally using employee ID and candidate name. Workday logs are prefixed with:

```text
[WORKDAY]
```

These logs include filtered call status, fallback behavior, row counts, match/no-match messages, invalid JSON diagnostics, and unexpected exceptions.

## Frontend Pages

Source folder:

```text
frontend/src/pages
```

Pages:

- `MailsPage.jsx`: inbox, mail filters, verification detail, approve/reject flow
- `LogsPage.jsx`: audit log, user filter, professional comparison dropdown
- `SettingsPage.jsx`: account details and compact dark-mode toggle

Reusable UI lives in:

```text
frontend/src/components
```

## Key Backend Files

- `backend/app/main.py`: FastAPI app creation, CORS, startup tasks
- `backend/app/api/routes.py`: email, verification, decision, logs, attachments, LLM test routes
- `backend/app/api/auth.py`: signup, login, current user
- `backend/app/services/gmail_imap_ingestor.py`: Gmail IMAP ingestion
- `backend/app/services/verification_processor.py`: LLM extraction, Workday lookup, comparison storage
- `backend/app/services/workday_raas.py`: Workday RaaS filtered lookup and fallback lookup
- `backend/app/services/reply_builder.py`: recommended outbound reply generation
- `backend/app/services/smtp_client.py`: outbound SMTP delivery
- `backend/app/services/email_source_factory.py`: selects file or database email source

## Environment

Create `backend/.env` using:

```text
backend/.env.example
```

Important values:

```env
EMAIL_SOURCE=gmail
DATABASE_URL=mysql+aiomysql://USER:PASSWORD@HOST:3306/hr_background_verification_db

LLAMA_BASE_URL=https://your-llama-host.example.com/ollama/api
LLAMA_MODEL=llama3.1:8b
LLAMA_VERIFY_SSL=false

SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
```

Workday RaaS URL and field mappings are defined in `backend/app/core/config.py`, not in `.env`.

## Run Backend

From the backend folder:

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend API docs:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/api/health
```

## Run Frontend

From the frontend folder:

```powershell
cd frontend
npm install
npm run dev -- --port 5174
```

Frontend:

```text
http://127.0.0.1:5174
```

Production build:

```powershell
npm run build
```

## Useful API Actions

Test backend health:

```powershell
curl http://127.0.0.1:8000/api/health
```

Test LLM connection:

```powershell
curl -k -X POST "http://127.0.0.1:8000/api/llm/test" -H "Content-Type: application/json" -d "{\"prompt\":\"Hello from laptop\"}"
```

Manually ingest Gmail:

```text
POST /api/ingest/gmail
```

Manually process pending emails:

```text
POST /api/process
```

## Demo And Seed Data

File-backed demo inbox:

```text
backend/app/data/emails.json
```

Temporary local employee data:

```text
backend/app/data/employees.json
```

MySQL seed script:

```powershell
cd backend
python seed_db.py
```

Direct SQL seed:

```text
backend/test_emails_seed.sql
```

## Troubleshooting

If the frontend shows `Failed to fetch`, make sure the backend is running on port `8000`.

If login or protected APIs fail, check that `JWT_SECRET_KEY` exists in `backend/.env`.

If Gmail ingestion inserts nothing, check Gmail IMAP credentials and `GMAIL_IMAP_SEARCH_CRITERIA`.

If Workday values are empty, check backend logs for `[WORKDAY]` messages.

If Workday filtered search fails but base URL works, the fallback should search the base employee list locally.

If SMTP does not send mail, check `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD`.

If frontend dependencies are missing, run:

```powershell
cd frontend
npm install
```
