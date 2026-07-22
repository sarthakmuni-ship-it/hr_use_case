import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Mail,
  Plus,
  UploadCloud,
} from "lucide-react";
import { docVerificationApi, emailsApi } from "../api";
import ProfileDropdown from "../components/ProfileDropdown";
import { formatDateTime } from "../utils/date";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeeklyCounts(items, dateField) {
  const today = startOfDay(new Date());
  const buckets = new Array(7).fill(0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  items.forEach((item) => {
    const raw = item[dateField];
    if (!raw) return;
    const day = startOfDay(new Date(raw));
    const diffDays = Math.round((day - weekStart) / 86400000);
    if (diffDays >= 0 && diffDays < 7) buckets[diffDays] += 1;
  });

  return buckets;
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function DashboardPage({ account, onLogout, onNavigate, onError }) {
  const [emails, setEmails] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [emailData, submissionData] = await Promise.all([
          emailsApi.list(),
          docVerificationApi.list(),
        ]);
        if (!cancelled) {
          setEmails(emailData);
          setSubmissions(submissionData);
        }
      } catch (err) {
        if (!cancelled) onError?.(err.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    const interval = setInterval(load, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onError]);

  const stats = useMemo(() => {
    const mailsProcessed = emails.filter((e) => e.status === "completed").length;
    const mailsPending = emails.filter((e) => e.status !== "completed").length;
    const docsVerified = submissions.filter((s) => s.status === "VERIFIED").length;
    const docsNeedsReview = submissions.filter((s) => s.status === "NEEDS_HUMAN_REVIEW").length;

    const candidateNames = new Set([
      ...submissions.map((s) => s.candidate_name).filter(Boolean),
      ...emails.map((e) => e.sender).filter(Boolean),
    ]);

    const totalPendingReview = mailsPending + docsNeedsReview;
    const totalVerifiedLike = mailsProcessed + docsVerified;
    const totalRecords = emails.length + submissions.length;
    const progressPct = totalRecords
      ? Math.round((totalVerifiedLike / totalRecords) * 100)
      : 0;

    return {
      totalCandidates: candidateNames.size,
      mailsProcessed,
      pendingReview: totalPendingReview,
      docsVerified,
      progressPct,
    };
  }, [emails, submissions]);

  const weeklyCounts = useMemo(() => {
    const mailCounts = buildWeeklyCounts(emails, "received_at");
    const docCounts = buildWeeklyCounts(submissions, "created_at");
    return mailCounts.map((count, i) => count + docCounts[i]);
  }, [emails, submissions]);

  const maxWeeklyCount = Math.max(...weeklyCounts, 1);

  const attentionItems = useMemo(() => {
    const newMails = emails
      .filter((e) => e.status === "new")
      .map((e) => ({
        id: `mail-${e.id}`,
        title: e.subject,
        subtitle: `${e.sender} - ${formatDateTime(e.received_at)}`,
      }));

    return newMails.slice(0, 5);
  }, [emails]);

  const documentVerificationLogs = useMemo(() => {
    return submissions
      .map((s) => ({
        id: `doc-${s.id}`,
        name: s.candidate_name,
        subtitle: s.verdict_summary || "Document verification",
        status: s.status,
        updatedAt: s.updated_at || s.created_at,
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
  }, [submissions]);

  function statusBadgeClass(status) {
    if (["VERIFIED", "completed"].includes(status)) return "badge badgeMatch";
    if (["NEEDS_HUMAN_REVIEW", "pending"].includes(status)) return "badge badgeToggle";
    return "badge";
  }

  function statusLabel(status) {
    const map = {
      VERIFIED: "Verified",
      NEEDS_HUMAN_REVIEW: "Needs review",
      PROCESSING: "Processing",
      completed: "Completed",
      pending: "Pending",
      new: "New",
    };
    return map[status] || status;
  }

  const circumference = 2 * Math.PI * 60;
  const arcOffset = circumference - (circumference * Math.min(stats.progressPct, 100)) / 100;

  return (
    <section className="contentPage">
      <div className="pageTitleRow">
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="primaryAction"
            onClick={() => onNavigate("verification")}
            type="button"
          >
            <UploadCloud size={16} />
            Upload documents
          </button>
          <button
            className="iconAction"
            onClick={() => onNavigate("mails")}
            style={{ width: "auto", padding: "0 13px", gap: 8, display: "inline-flex" }}
            type="button"
          >
            <Mail size={16} />
            Check inbox
          </button>
          <ProfileDropdown account={account} onLogout={onLogout} />
        </div>
      </div>

      <section className="metricGrid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <article className="metricCard">
          <span className="metricIcon"><ArrowUpRight size={18} /></span>
          <div><small>Total candidates</small><strong>{stats.totalCandidates}</strong></div>
        </article>
        <article className="metricCard">
          <span className="metricIcon success"><Mail size={18} /></span>
          <div><small>Mails processed</small><strong>{stats.mailsProcessed}</strong></div>
        </article>
        <article className="metricCard">
          <span className="metricIcon warning"><AlertTriangle size={18} /></span>
          <div><small>Pending review</small><strong>{stats.pendingReview}</strong></div>
        </article>
        <article className="metricCard">
          <span className="metricIcon success"><FileCheck2 size={18} /></span>
          <div><small>Docs verified</small><strong>{stats.docsVerified}</strong></div>
        </article>
      </section>

      {/* Top Row: Weekly submissions and Verification progress */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 14,
          marginTop: 14,
        }}
      >
        <section className="panel">
          <div className="panelHeader"><h2>Weekly submissions</h2></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 130 }}>
            {weeklyCounts.map((count, i) => (
              <div
                key={i}
                style={{
                  width: "12%",
                  height: `${Math.max((count / maxWeeklyCount) * 100, 6)}%`,
                  background: count === 0 ? "var(--border)" : "var(--primary)",
                  borderRadius: 20,
                }}
                title={`${count} on ${DAY_LABELS[i]}`}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
            {DAY_LABELS.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </section>

        <section className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="panelHeader" style={{ alignSelf: "flex-start" }}><h2>Verification progress</h2></div>
          <svg width="140" height="90" viewBox="0 0 140 90">
            <path d="M10,80 A60,60 0 0,1 130,80" fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round" />
            <path
              d="M10,80 A60,60 0 0,1 130,80"
              fill="none"
              stroke="var(--success)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference / 2}
              strokeDashoffset={arcOffset / 2}
            />
          </svg>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: -6 }}>{stats.progressPct}%</div>
          <div className="emptyText">Fully verified</div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
            <span><CheckCircle2 size={12} color="#22c55e" /> Verified</span>
            <span><Plus size={12} /> Pending</span>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 14, marginTop: 14 }}>

        <section
          className="panel"
          onClick={() => onNavigate("mails")}
          style={{ display: "flex", flexDirection: "column", height: "100%", cursor: "pointer" }}
        >
          <div className="panelHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h2>Mails</h2>
            <span className="badge badgeToggle"><Mail size={12} />{attentionItems.length} new</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {attentionItems.length === 0 ? (
              <p className="emptyText">No new mails right now.</p>
            ) : (
              attentionItems.map((item) => (
                <div
                  className="emailRow"
                  key={item.id}
                  style={{ textAlign: "left", width: "100%", cursor: "default" }}
                >
                  <span className="emailSubject">{item.title}</span>
                  <span className="emailMeta">{item.subtitle}</span>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <button 
              className="secondaryAction" 
              onClick={(event) => {
                event.stopPropagation();
                onNavigate("mails");
              }}
              style={{ width: "100%", justifyContent: "center" }}
              type="button"
            >
              Open inbox
            </button>
          </div>
        </section>

        <section
          className="panel"
          onClick={() => onNavigate("verification")}
          style={{ display: "flex", flexDirection: "column", height: "100%", cursor: "pointer" }}
        >
          <div className="panelHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h2>Candidates in progress</h2>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {!loaded ? (
              <p className="emptyText">Loading...</p>
            ) : documentVerificationLogs.length === 0 ? (
              <p className="emptyText">No candidates yet.</p>
            ) : (
              documentVerificationLogs.map((c) => (
                <div
                  className="emailRow"
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "default" }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "var(--primary-soft)",
                      color: "#93c5fd",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initials(c.name)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="emailSubject" style={{ display: "block" }}>{c.name}</span>
                    <span className="emailMeta" style={{ display: "block" }}>{c.subtitle}</span>
                  </span>
                  <span className={statusBadgeClass(c.status)}>{statusLabel(c.status)}</span>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <button 
              className="secondaryAction" 
              onClick={(event) => {
                event.stopPropagation();
                onNavigate("verification");
              }}
              style={{ width: "100%", justifyContent: "center" }}
              type="button"
            >
              Open document verification
            </button>
          </div>
        </section>

      </div>
    </section>
  );
}
