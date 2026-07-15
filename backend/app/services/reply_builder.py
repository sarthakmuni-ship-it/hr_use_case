from app.models.schemas import FieldMatchResult, SafeReplyResponse




def build_recommended_reply(
    email_id: int,
    reply_to: str,
    subject: str,
    field_results: list[FieldMatchResult],
) -> SafeReplyResponse:
    """Build a rich outbound text response with dynamic tables or fallback rejection terms."""
   
    required_match_fields = [
        result for result in field_results
        if result.field != "exit_formalities_completed"
    ]
    all_match = all(result.matches for result in required_match_fields)
   
    if all_match:
        # Build plain-text data structure representation
        table_lines = [
            "Hello,\n",
            "Based on our background check verification rules, the details match our internal database records:\n",
            f"{'Field Name':<30} | {'Verified System Value':<30}",
            "-" * 65
        ]
        for res in field_results:
            clean_label = res.field.replace("_", " ").title()
            system_value = str(res.workday_value) if res.workday_value is not None else "N/A"
            table_lines.append(f"{clean_label:<30} | {system_value:<30}")
           
        table_lines.append("\nRegards,\nHR Verification Team")
        body = "\n".join(table_lines)
    else:
        body = (
            "Hello,\n\n"
            "You need to fill the fields that you require to verify.\n\n"
            "Regards,\nHR Verification Team"
        )


    return SafeReplyResponse(
        email_id=email_id,
        reply_to=reply_to,
        subject=f"Re: {subject}",
        body=body,
    )



