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
        rows = [
            "<p>Hello,</p>",
            "<p>Based on our background check verification rules, the details match our internal database records:</p>",
            "<table style='border-collapse:collapse;width:100%;'>",
            "<thead><tr><th style='border:1px solid #ccc;padding:8px;text-align:left;'>Field Name</th>"
            "<th style='border:1px solid #ccc;padding:8px;text-align:left;'>Verified System Value</th></tr></thead>",
            "<tbody>"
        ]

        for res in field_results:
            clean_label = res.field.replace("_", " ").title()
            system_value = str(res.workday_value) if res.workday_value is not None else "N/A"
            rows.append(
                "<tr>"
                f"<td style='border:1px solid #ccc;padding:8px;'>{clean_label}</td>"
                f"<td style='border:1px solid #ccc;padding:8px;'>{system_value}</td>"
                "</tr>"
            )

        rows.extend([
            "</tbody>",
            "</table>",
            "<p>Regards,<br/>HR Verification Team</p>"
        ])
        body = "".join(rows)
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



