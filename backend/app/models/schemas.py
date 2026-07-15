from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class EmailStatus(str, Enum):
    """Human review states shown in the inbox UI."""

    new = "new"
    pending = "pending"
    completed = "completed"

class ProcessingStatus(str, Enum):
    """Progress of an email through LLM/background processing."""

    new = "new"
    pending = "pending"
    processed = "processed"
    error = "error"
    completed = "completed"

class DecisionValue(str, Enum):
    """Allowed human review outcomes."""

    approve_reply = "approve_reply"
    reject_reply = "reject_reply"


class EmailSummaryResponse(BaseModel):
    """Small email summary used by the inbox table."""

    id: int
    sender: str
    subject: str

    status: EmailStatus
    processing_status: ProcessingStatus

    received_at: datetime


class ClaimedEmployeeDetails(BaseModel):
    """Details parsed from the requesting company's email."""

    candidate_name: str | None = None
    employee_id: str | None = None
    nature_of_employment: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    last_designation: str | None = None
    location: str | None = None
    exit_formalities_completed: str | None = None


class WorkdayEmployeeDetails(BaseModel):
    """Employee details returned from Workday."""

    employee_name: str | None = None
    employee_id: str | None = None
    nature_of_employment: str | None = None
    start_date: date | None = None
    end_date: date |None = None
    last_designation: str | None = None
    location: str | None = None
    exit_formalities_completed: str | None = None


class AttachmentResponse(BaseModel):
    """Attachment metadata shown in the review UI."""

    id: int
    filename: str
    content_type: str | None = None
    size_bytes: int


class FieldMatchResult(BaseModel):
    """Exact-match result for a single verification field."""

    field: str
    claimed_value: str | None
    workday_value: str | None
    matches: bool


class VerificationResponse(BaseModel):
    """Full review payload for the internal HR dashboard."""

    email_id: int
    sender: str
    subject: str
    body: str
    status: EmailStatus
    is_processed: bool = False
    claimed_details: ClaimedEmployeeDetails
    workday_details: WorkdayEmployeeDetails | None
    field_results: list[FieldMatchResult]
    all_fields_match: bool
    recommended_reply: str
    attachments: list[AttachmentResponse] = []


class SafeReplyResponse(BaseModel):
    """Minimal outbound reply preview that avoids leaking employee details."""

    email_id: int
    reply_to: str
    subject: str
    body: str


class DecisionRequest(BaseModel):
    """Human review decision request payload."""
    decision: str
    note: str | None = None
    reply_body: str | None = None  # Crucial field for capturing modified text


class DecisionResponse(BaseModel):
    """Confirmation returned after a human decision is stored."""

    email_id: int
    decision: DecisionValue
    message: str


class DecisionLogResponse(BaseModel):
    """Audit row showing which HR user handled an email."""

    id: int
    email_id: int
    email_subject: str
    user_full_name: str | None = None
    user_email: str | None = None
    decision: DecisionValue
    note: str | None = None
    sent_reply: str | None = None
    decided_at: datetime


class LlmTestRequest(BaseModel):
    """Prompt used to test the configured Llama/Ollama-compatible API."""

    prompt: str = Field(default="Hello from laptop", max_length=1000)


class LlmTestResponse(BaseModel):
    """Small connection-test result from the configured LLM provider."""

    provider: str
    model: str
    success: bool
    message: str
