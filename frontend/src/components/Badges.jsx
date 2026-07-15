export function StatusBadge({ match }) {
  return (
    <span className={match ? "badge badgeMatch" : "badge badgeMismatch"}>
      {match ? "Match" : "Flag"}
    </span>
  );
}

export function MailStatusBadge({ status }) {
  const statusMap = {
    pending: ["workflowBadge workflowPending", "PENDING"],
    completed: ["workflowBadge workflowCompleted", "COMPLETED"],
  };
  const [className, label] = statusMap[status] || [
    "workflowBadge workflowNew",
    "NEW",
  ];

  return <span className={className}>{label}</span>;
}
