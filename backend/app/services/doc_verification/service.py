import logging
import asyncio
from pathlib import Path

from fastapi import UploadFile

from app.db.models import DocumentVerificationFile, User
from app.db.session import AsyncSessionLocal
from app.models.schemas import (
    DocumentVerificationFileResponse,
    DocumentVerificationSubmissionDetail,
    DocumentVerificationSubmissionSummary,
)
from app.services.doc_verification.pipeline.orchestrator import DocumentVerificationOrchestrator
from app.services.doc_verification.repository import (
    DocumentVerificationRepository,
    submission_extracted_documents,
    submission_issues,
    submission_pending_documents,
)
from app.services.doc_verification.google_drive import GoogleDriveImportService
from app.services.doc_verification.storage import DocumentStorageService


logger = logging.getLogger(__name__)
UNKNOWN_CANDIDATE_LABEL = "Analyzing documents"


class DocumentVerificationService:
    """Use cases for HR onboarding document verification."""

    def __init__(
        self,
        repository: DocumentVerificationRepository,
        storage: DocumentStorageService | None = None,
    ):
        self.repository = repository
        self.storage = storage or DocumentStorageService()

    async def submit(
        self,
        candidate_name: str,
        uploads: list[UploadFile],
        current_user: User,
    ) -> int:
        candidate_name = candidate_name.strip() or UNKNOWN_CANDIDATE_LABEL
        logger.info(
            "[DOC_VERIFY] Creating local document submission candidate=%r user_id=%s upload_count=%s",
            candidate_name,
            current_user.id,
            len(uploads),
        )
        submission = await self.repository.create_submission(candidate_name, current_user.id)
        stored_files = await self.storage.save_uploads(submission.id, candidate_name, uploads)
        if not stored_files:
            raise ValueError("No processable documents were found. Upload PDFs, images, or a ZIP containing them.")
        await self.repository.add_files(submission.id, stored_files)
        await self.repository.session.commit()
        logger.info(
            "[DOC_VERIFY] Local document submission saved submission_id=%s stored_files=%s",
            submission.id,
            len(stored_files),
        )
        return submission.id

    async def submit_from_google_drive(
        self,
        candidate_name: str | None,
        drive_url: str,
        current_user: User,
    ) -> int:
        candidate_name = (candidate_name or "").strip() or UNKNOWN_CANDIDATE_LABEL
        logger.info(
            "[DOC_VERIFY] Creating Google Drive document submission candidate=%r user_id=%s",
            candidate_name,
            current_user.id,
        )
        submission = await self.repository.create_submission(candidate_name, current_user.id)
        destination = self.storage.submission_dir(submission.id, candidate_name)
        # Google's Drive client is synchronous; keep it off the FastAPI event loop.
        drive_documents = await asyncio.to_thread(
            GoogleDriveImportService().import_documents,
            drive_url,
            destination,
        )
        await self.repository.add_files(submission.id, drive_documents)
        await self.repository.session.commit()
        logger.info(
            "[DOC_VERIFY] Google Drive document submission saved submission_id=%s stored_files=%s",
            submission.id,
            len(drive_documents),
        )
        return submission.id

    async def list_submissions(self) -> list[DocumentVerificationSubmissionSummary]:
        submissions = await self.repository.list_submissions()
        return [
            DocumentVerificationSubmissionSummary(
                id=submission.id,
                candidate_name=submission.candidate_name,
                status=submission.status,
                created_at=submission.created_at,
                updated_at=submission.updated_at,
                verdict_summary=submission.summary,
                summary=submission.summary,
                issue_count=len(submission_issues(submission)),
            )
            for submission in submissions
        ]

    async def detail(self, submission_id: int) -> DocumentVerificationSubmissionDetail | None:
        submission = await self.repository.get_submission(submission_id)
        if not submission:
            return None
        files = await self.repository.get_files(submission_id)
        return DocumentVerificationSubmissionDetail(
            id=submission.id,
            candidate_name=submission.candidate_name,
            status=submission.status,
            created_at=submission.created_at,
            updated_at=submission.updated_at,
            summary=submission.summary,
            issues=submission_issues(submission),
            pending_documents=submission_pending_documents(submission),
            extracted_documents=submission_extracted_documents(submission),
            files=[self._file_response(file) for file in files],
        )

    async def file(self, file_id: int) -> DocumentVerificationFile | None:
        return await self.repository.get_file(file_id)

    async def file_by_submission_and_name(
        self,
        submission_id: int,
        filename: str,
    ) -> DocumentVerificationFile | None:
        return await self.repository.get_file_by_submission_and_name(submission_id, filename)

    @staticmethod
    def _file_response(file: DocumentVerificationFile) -> DocumentVerificationFileResponse:
        return DocumentVerificationFileResponse(
            id=file.id,
            filename=file.filename,
            content_type=file.content_type,
            size_bytes=file.size_bytes,
            url=f"/doc-verification/files/{file.id}/download",
        )


async def process_document_verification_submission(submission_id: int) -> None:
    """Background job that runs the HRAI document pipeline for one submission."""

    # Load DB state first, then release the session before the long-running LLM work.
    async with AsyncSessionLocal() as session:
        repository = DocumentVerificationRepository(session)
        submission = await repository.get_submission(submission_id)
        if not submission:
            logger.warning("[DOC_VERIFY] Submission not found for processing submission_id=%s", submission_id)
            return
        files = await repository.get_files(submission_id)
        uploaded_files = [
            {"originalName": file.filename, "storedPath": file.file_path}
            for file in files
            if Path(file.file_path).exists()
        ]

    try:
        logger.info(
            "[DOC_VERIFY] Starting pipeline submission_id=%s candidate=%r file_count=%s",
            submission_id,
            submission.candidate_name,
            len(uploaded_files),
        )
        orchestrator = DocumentVerificationOrchestrator(
            candidate_profile={"name": submission.candidate_name}
        )
        result = await orchestrator.run(uploaded_files)
        async with AsyncSessionLocal() as session:
            repository = DocumentVerificationRepository(session)
            await repository.mark_completed(submission_id, result)
            await session.commit()
        logger.info(
            "[DOC_VERIFY] Pipeline completed submission_id=%s status=%s issues=%s",
            submission_id,
            result.get("status"),
            len(result.get("action_items", [])),
        )
    except Exception as exc:
        logger.exception("Document verification pipeline failed submission_id=%s", submission_id)
        async with AsyncSessionLocal() as session:
            repository = DocumentVerificationRepository(session)
            await repository.mark_failed(submission_id, str(exc))
            await session.commit()
