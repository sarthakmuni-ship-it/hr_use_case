import httpx
import json
import logging
import re

from app.core.config import get_settings
from app.models.schemas import ClaimedEmployeeDetails


logger = logging.getLogger(__name__)


def test_llama_connection(prompt: str) -> str:
    """Send a single non-streaming chat request to the configured Llama endpoint."""

    settings = get_settings()
    base_url = settings.llama_base_url.rstrip("/")
    payload = {
        "model": settings.llama_model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    with httpx.Client(
        timeout=30.0,
        verify=settings.llama_verify_ssl,
        auth=(settings.llama_username, settings.llama_password),
    ) as client:
        response = client.post(
            f"{base_url}/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        data = response.json()

    message = data.get("message", {})
    if isinstance(message, dict) and message.get("content"):
        return str(message["content"])
    return str(data)


def _chat(prompt: str) -> str:
    """Send one non-streaming prompt to the configured Llama-compatible endpoint."""

    settings = get_settings()
    base_url = settings.llama_base_url.rstrip("/")
    logger.info("[LLM] Sending chat request model=%s prompt_chars=%s", settings.llama_model, len(prompt))
    payload = {
        "model": settings.llama_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an HR background verification assistant. "
                    "Always extract information accurately. "
                    "Always return ONLY valid JSON."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        "stream": False,
        "options": {
            "temperature": 0,
            "num_ctx": 8192,
        },
    }
    with httpx.Client(
        timeout=120.0,
        verify=settings.llama_verify_ssl,
        auth=(settings.llama_username, settings.llama_password),
    ) as client:
        response = client.post(
            f"{base_url}/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        logger.info("[LLM] HTTP Status = %s", response.status_code)
        response.raise_for_status()
        data = response.json()
        logger.info("[LLM] Raw response = %s", json.dumps(data, indent=2))

    message = data.get("message", {})
    content = str(message.get("content") if isinstance(message, dict) else data)
    logger.info("[LLM] Received chat response chars=%s", len(content))
    return content


def _json_from_text(value: str) -> dict:
    value = value.strip()

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", value, re.DOTALL)
    if match:
        return json.loads(match.group(0))

    raise ValueError(f"LLM did not return valid JSON:\n{value}")


def extract_claimed_details_with_llm(mail_text: str) -> ClaimedEmployeeDetails:
    """Use the LLM to extract the 8 required HR fields."""

    prompt = f"""
You are an HR Background Verification assistant.

Read the email carefully and extract ONLY the candidate details.
Extract ONLY these fields. Use null if a value is missing.
Convert all dates to YYYY-MM-DD format.

Return ONLY this valid JSON:
{{
  "candidate_name": "...",
  "employee_id": "...",
  "nature_of_employment": "...",
  "start_date": "...",
  "end_date": "...",
  "last_designation": "...",
  "location": "...",
  "exit_formalities_completed": "..."
}}

Email:

{mail_text}
"""
    data = _json_from_text(_chat(prompt))
    
    # Sanitize boolean field answers from the LLM into text before Pydantic validation
    ef = data.get("exit_formalities_completed")
    if isinstance(ef, bool):
        data["exit_formalities_completed"] = "Yes" if ef else "No"
    elif ef is not None:
        data["exit_formalities_completed"] = str(ef)

    return ClaimedEmployeeDetails(
        candidate_name=data.get("candidate_name"),
        employee_id=data.get("employee_id"),
        nature_of_employment=data.get("nature_of_employment"),
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        last_designation=data.get("last_designation"),
        location=data.get("location"),
        exit_formalities_completed=data.get("exit_formalities_completed"),
    )