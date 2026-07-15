from datetime import datetime, timezone
import logging
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import get_current_user
from app.db.models import User
from app.db.models import Email, EmailAttachment, VerificationDecision
from app.db.session import AsyncSessionLocal
from app.models.schemas import (
    DecisionRequest,
    DecisionResponse,
    DecisionLogResponse,
    EmailSummaryResponse,
    LlmTestRequest,
    LlmTestResponse,
    SafeReplyResponse,
    VerificationResponse,
)
from app.core.config import get_settings
from app.services.email_source_factory import get_email_source
from app.services.email_sources.file_source import FileEmailSource
from app.services.llm_client import test_llama_connection
from app.services.reply_builder import build_recommended_reply
from app.services.gmail_imap_ingestor import ingest_gmail_messages
from app.services.verification import verify_email
from app.services.verification_processor import process_pending_emails
from app.services.smtp_client import send_outbound_email  # Added SMTP client import

router = APIRouter(prefix="/api", tags=["HR Verification"])
logger = logging.getLogger(__name__)


def raise_database_unavailable(exc: SQLAlchemyError) -> None:
    """Return a clear API error when MySQL is not reachable."""

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database unavailable. Start MySQL on localhost:3306 and ensure hr_background_verification_db exists.",
    ) from exc


def _file_decision_logs(current_user: User) -> list[DecisionLogResponse]:
    email_source = get_email_source()

    if not isinstance(email_source, FileEmailSource):
        return []

    logs: list[DecisionLogResponse] = []

    for item in email_source._load_emails():
        stored_decision = item.get("decision")
        status_value = item.get("status")

        if stored_decision in {"approve_reply", "reject_reply"}:
            decision = stored_decision
        elif status_value in {"approved", "rejected"}:
            decision = "approve_reply" if status_value == "approved" else "reject_reply"
        else:
            continue

        decided_at = item.get("decision_at") or item.get("received_at")

        logs.append(
            DecisionLogResponse(
                id=item["id"],
                email_id=item["id"],
                email_subject=item["subject"],
                user_full_name=item.get("decision_by_name") or current_user.full_name,
                user_email=item.get("decision_by_email") or current_user.email,
                decision=decision,
                note=item.get("decision_note"),
                sent_reply=item.get("sent_reply"),
                decided_at=decided_at,
            )
        )

    return sorted(logs, key=lambda log: log.decided_at, reverse=True)


@router.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> dict[str, str]:
    """Return a simple health signal for local demos and UI checks."""

    return {"status": "ok"}


@router.post("/llm/test", response_model=LlmTestResponse)
def test_llm_connection(request: LlmTestRequest) -> LlmTestResponse:
    """Test connectivity to the configured Llama chat endpoint."""

    settings = get_settings()

    try:
        message = test_llama_connection(request.prompt)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM connection failed: {exc}",
        ) from exc

    return LlmTestResponse(
        provider=settings.llm_provider,
        model=settings.llama_model,
        success=True,
        message=message,
    )


@router.get("/emails", response_model=list[EmailSummaryResponse])
async def list_emails(current_user: User = Depends(get_current_user)) -> list[EmailSummaryResponse]:
    """List emails available from the configured source."""

    try:
        return await get_email_source().list_pending_emails()
    except SQLAlchemyError as exc:
        raise_database_unavailable(exc)


@router.post("/ingest/gmail", status_code=status.HTTP_202_ACCEPTED)
async def ingest_gmail(current_user: User = Depends(get_current_user)) -> dict[str, int]:
    """Manually pull Gmail IMAP messages into SQL."""

    logger.info("[API] Gmail ingestion requested by user=%s", current_user.email)
    inserted = await ingest_gmail_messages()
    logger.info("[API] Gmail ingestion completed inserted=%s", inserted)
    return {"inserted": inserted}


@router.post("/process", status_code=status.HTTP_202_ACCEPTED)
async def process_emails(current_user: User = Depends(get_current_user)) -> dict[str, int]:
    """Manually process stored emails through LLM + Workday matching."""

    settings = get_settings()
    logger.info(
        "[API] Verification processing requested by user=%s batch_size=%s",
        current_user.email,
        settings.mail_processing_batch_size,
    )
    processed = await process_pending_emails()
    logger.info("[API] Verification processing completed processed=%s", processed)
    return {"processed": processed}


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Download an attachment saved during Gmail IMAP ingestion."""

    async with AsyncSessionLocal() as session:
        attachment = await session.get(EmailAttachment, attachment_id)

    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file missing.")

    return FileResponse(
        file_path,
        media_type=attachment.content_type or "application/octet-stream",
        filename=attachment.filename,
    )


@router.get("/logs", response_model=list[DecisionLogResponse])
async def list_decision_logs(
    current_user: User = Depends(get_current_user),
) -> list[DecisionLogResponse]:
    """Return decision audit rows for the dashboard logs page."""

    email_source = get_email_source()
    logger.info("[API] Decision logs requested by user=%s", current_user.email)

    if isinstance(email_source, FileEmailSource):
        return _file_decision_logs(current_user)

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(VerificationDecision, Email, User)
                .join(Email, VerificationDecision.email_id == Email.id)
                .outerjoin(User, VerificationDecision.user_id == User.id)
                .order_by(VerificationDecision.decided_at.desc())
            )
            rows = result.all()
    except SQLAlchemyError as exc:
        raise_database_unavailable(exc)

    return [
        DecisionLogResponse(
            id=decision.id,
            email_id=email.id,
            email_subject=email.subject,
            user_full_name=user.full_name if user else None,
            user_email=user.email if user else None,
            decision=decision.decision,
            note=decision.note,
            sent_reply=decision.sent_reply,
            decided_at=decision.decided_at,
        )
        for decision, email, user in rows
    ]


@router.get(
    "/emails/{email_id}/verification",
    response_model=VerificationResponse,
)
async def get_verification(
    email_id: int,
    current_user: User = Depends(get_current_user)
    ) -> VerificationResponse:
    """Return internal comparison details for human HR review."""

    email_source = get_email_source()

    try:
        # Mark NEW -> PENDING when HR opens the email
        await email_source.mark_reviewed(email_id)

        email = await email_source.get_email(email_id)

    except SQLAlchemyError as exc:
        raise_database_unavailable(exc)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found.",
        )

    return verify_email(email)


@router.get(
    "/emails/{email_id}/safe-reply",
    response_model=SafeReplyResponse,
)
async def get_safe_reply(email_id: int, current_user: User = Depends(get_current_user)) -> SafeReplyResponse:
    """Return only the minimal reply that can be sent outside the company."""

    try:
        email = await get_email_source().get_email(email_id)
    except SQLAlchemyError as exc:
        raise_database_unavailable(exc)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found.",
        )

    verification = verify_email(email)

    return build_recommended_reply(
        email_id=email["id"],
        reply_to=email["sender"],
        subject=email["subject"],
        field_results=verification.field_results,
    )


@router.post(
    "/emails/{email_id}/decision",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_decision(
    email_id: int,
    request: DecisionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
) -> DecisionResponse:
    """Store HR's final decision and dispatch an outbound email notification via SMTP."""

    email_source = get_email_source()

    try:
        email = await email_source.get_email(email_id)
    except SQLAlchemyError as exc:
        raise_database_unavailable(exc)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found.",
        )

    if email.get("status") == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A decision has already been recorded for this email.",
        )

    # ---------------- FILE MODE ---------------- #

    if isinstance(email_source, FileEmailSource):
        emails = email_source._load_emails()

        for item in emails:
            if item["id"] == email_id:
                item["status"] = "completed"
                item["decision"] = request.decision
                item["decision_by_name"] = current_user.full_name
                item["decision_by_email"] = current_user.email
                item["decision_note"] = request.note
                item["sent_reply"] = request.reply_body
                item["decision_at"] = datetime.now(timezone.utc).isoformat()
                break

        email_source._save_emails(emails)

    # ---------------- DATABASE MODE ---------------- #

    else:
        try:
            async with AsyncSessionLocal() as session:
                session.add(
                    VerificationDecision(
                        email_id=email_id,
                        user_id=current_user.id,
                        decision=request.decision,
                        note=request.note,
                        sent_reply=request.reply_body,
                    )
                )

                await session.execute(
                    update(Email)
                    .where(Email.id == email_id)
                    .values(
                        status="completed",
                    )
                )
                await session.commit()

        except SQLAlchemyError as exc:
            raise_database_unavailable(exc)

    # ---------------- Outbound SMTP Transmission Engine ---------------- #
    
    if request.reply_body:
        recipient_email = email.get("sender")
        email_subject = email.get("subject", "Background Verification Update")
        
        # Ensure we don't duplicate "Re: Re:" in the subject line
        reply_subject = email_subject if str(email_subject).lower().startswith("re:") else f"Re: {email_subject}"
        
        if recipient_email:
            background_tasks.add_task(
                send_outbound_email,
                to_addr=recipient_email,
                subject=reply_subject,
                body=request.reply_body
            )
            logger.info("[API] Queued outbound SMTP background task for email_id=%s", email_id)
        else:
            logger.warning("[API] No sender email found to send reply for email_id=%s", email_id)

    return DecisionResponse(
        email_id=email_id,
        decision=request.decision,
        message="Decision saved and email notification queued successfully.",
    )
