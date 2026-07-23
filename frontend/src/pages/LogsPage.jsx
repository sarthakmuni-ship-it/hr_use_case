import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Filter,
  FileText,
  Mail,
  MessageSquareText,
  Search,
  UserRound,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { docVerificationApi, emailsApi, logsApi } from "../api";
import { StatusBadge, VerificationStatusBadge } from "../components/Badges";
import { formatDateTime } from "../utils/date";
import ProfileDropdown from "../components/ProfileDropdown";
import SubmissionDetailModal from "../components/SubmissionDetailModal";

function formatDecision(value) {
  return value === "approve_reply" ? "Approved" : "Rejected";
}

function decisionBadgeClass(value) {
  return value === "approve_reply" ? "badge badgeMatch" : "badge badgeMismatch";
}

export default function LogsPage({ account, onLogout, refreshSignal, onLoadingChange, onError }) {
  const [logs, setLogs] = useState([]);
  const [docLogs, setDocLogs] = useState([]);
  const [historyType, setHistoryType] = useState("background");
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [verificationByEmail, setVerificationByEmail] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [candidateFilter, setCandidateFilter] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  const normalizedUserFilter = userFilter.trim().toLowerCase();
  const normalizedCandidateFilter = candidateFilter.trim().toLowerCase();
  const filteredLogs = normalizedUserFilter
    ? logs.filter((log) => {
        const userName = log.user_full_name || "";
        const userEmail = log.user_email || "";
        return `${userName} ${userEmail}`.toLowerCase().includes(normalizedUserFilter);
      })
    : logs;
  const filteredDocLogs = docLogs.filter((log) => {
    if (
      normalizedCandidateFilter &&
      !String(log.candidate_name || "").toLowerCase().includes(normalizedCandidateFilter)
    ) {
      return false;
    }

    if (docStatusFilter !== "all" && log.status !== docStatusFilter) {
      return false;
    }

    return true;
  });

  const approvedCount = logs.filter((log) => log.decision === "approve_reply").length;
  const rejectedCount = logs.filter((log) => log.decision === "reject_reply").length;
  const decisionTotal = Math.max(logs.length, 1);
  const docVerifiedCount = docLogs.filter((log) => log.status === "VERIFIED").length;
  const docReviewCount = docLogs.filter((log) => log.status === "NEEDS_HUMAN_REVIEW").length;
  const selectedVerification = selectedLog ? verificationByEmail[selectedLog.email_id] : null;
  const sentReplyText =
    selectedLog?.sent_reply ||
    selectedVerification?.recommended_reply ||
    "No sent reply was captured for this log.";

  async function loadLogs() {
    onLoadingChange(true);
    onError("");

    try {
      const [mailLogs, documentLogs] = await Promise.all([
        logsApi.list(),
        docVerificationApi.list(),
      ]);
      setLogs(mailLogs);
      setDocLogs(documentLogs);
    } catch (err) {
      onError(err.message);
    } finally {
      onLoadingChange(false);
    }
  }

  async function openLog(log) {
    setSelectedLog(log);

    if (verificationByEmail[log.email_id]) return;

    try {
      const verification = await emailsApi.verification(log.email_id);
      setVerificationByEmail((current) => ({
        ...current,
        [log.email_id]: verification,
      }));
    } catch (err) {
      onError(err.message);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [refreshSignal]);

  useEffect(() => {
    setPage(1);
  }, [userFilter, candidateFilter, docStatusFilter, historyType]);

  const activeRows = historyType === "background" ? filteredLogs : filteredDocLogs;
  const totalPages = Math.ceil(activeRows.length / itemsPerPage) || 1;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, activeRows.length);
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  const paginatedDocLogs = filteredDocLogs.slice(startIndex, startIndex + itemsPerPage);
  const activeFilterCount =
    historyType === "background"
      ? Number(Boolean(userFilter))
      : [Boolean(candidateFilter), docStatusFilter !== "all"].filter(Boolean).length;

  return (
    <section className="contentPage">
      <div className="pageTitleRow">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1>History</h1>
        </div>
        <div className="logToolbar">
          <button
            aria-label="Filter history"
            aria-pressed={filtersOpen}
            className={filtersOpen || activeFilterCount ? "iconAction active" : "iconAction"}
            onClick={() => setFiltersOpen((current) => !current)}
            title="Filter history"
            type="button"
          >
            <Filter size={17} />
            {activeFilterCount > 0 && <span className="filterCount">{activeFilterCount}</span>}
          </button>
          <ProfileDropdown account={account} onLogout={onLogout} />
        </div>
      </div>
      <section className="historyToggleGroup" aria-label="History type">
        <button
          className={historyType === "background" ? "historyToggle active" : "historyToggle"}
          onClick={() => setHistoryType("background")}
          type="button"
        >
          <Mail size={16} />
          Background Verification
        </button>
        <button
          className={historyType === "documents" ? "historyToggle active" : "historyToggle"}
          onClick={() => setHistoryType("documents")}
          type="button"
        >
          <FileText size={16} />
          Document Verification
        </button>
      </section>
      <section className="metricGrid">
        {historyType === "background" ? (
          <>
            <article className="metricCard">
              <span className="metricIcon success"><CheckCircle2 size={18} /></span>
              <div><small>Approved</small><strong>{approvedCount}</strong></div>
            </article>
            <article className="metricCard">
              <span className="metricIcon danger"><XCircle size={18} /></span>
              <div><small>Rejected</small><strong>{rejectedCount}</strong></div>
            </article>
            <article className="metricCard">
              <span className="metricIcon"><Search size={18} /></span>
              <div><small>Visible History</small><strong>{filteredLogs.length}</strong></div>
            </article>
          </>
        ) : (
          <>
            <article className="metricCard">
              <span className="metricIcon success"><CheckCircle2 size={18} /></span>
              <div><small>Verified</small><strong>{docVerifiedCount}</strong></div>
            </article>
            <article className="metricCard">
              <span className="metricIcon danger"><XCircle size={18} /></span>
              <div><small>Needs Review</small><strong>{docReviewCount}</strong></div>
            </article>
            <article className="metricCard">
              <span className="metricIcon"><Search size={18} /></span>
              <div><small>Visible History</small><strong>{filteredDocLogs.length}</strong></div>
            </article>
          </>
        )}
      </section>
      {historyType === "background" && (
        <section className="panel statusOverview">
          <div className="statusOverviewHeader">
            <span>Decision Mix</span>
            <strong>{logs.length} total</strong>
          </div>
          <div className="statusBar" aria-label="Decision distribution">
            <span className="statusSegment completed" style={{ width: `${(approvedCount / decisionTotal) * 100}%` }} />
            <span className="statusSegment rejected" style={{ width: `${(rejectedCount / decisionTotal) * 100}%` }} />
          </div>
          <div className="statusLegend">
            <span><i className="legendDot completed" />Approved</span>
            <span><i className="legendDot rejected" />Rejected</span>
          </div>
        </section>
      )}
      {filtersOpen && (
        <section className="panel filterPanel">
          {historyType === "background" ? (
            <div className="logFilterControls">
              <label>
                Processed by
                <input
                  onChange={(event) => setUserFilter(event.target.value)}
                  placeholder="Search name or email"
                  type="search"
                  value={userFilter}
                />
              </label>
              <button className="filterClear" disabled={!userFilter} onClick={() => setUserFilter("")} type="button">
                <XCircle size={15} />
                Clear
              </button>
            </div>
          ) : (
            <div className="logFilterControls documentHistoryFilters">
              <label>
                Candidate name
                <input
                  onChange={(event) => setCandidateFilter(event.target.value)}
                  placeholder="Search candidate"
                  type="search"
                  value={candidateFilter}
                />
              </label>
              <label>
                Status
                <select onChange={(event) => setDocStatusFilter(event.target.value)} value={docStatusFilter}>
                  <option value="all">All statuses</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="NEEDS_HUMAN_REVIEW">Needs Review</option>
                  <option value="PENDING_DOCUMENTS">Pending Documents</option>
                  <option value="SYSTEM_ERROR">System Error</option>
                </select>
              </label>
              <button
                className="filterClear"
                disabled={!candidateFilter && docStatusFilter === "all"}
                onClick={() => {
                  setCandidateFilter("");
                  setDocStatusFilter("all");
                }}
                type="button"
              >
                <XCircle size={15} />
                Clear
              </button>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panelHeader">
          <h2>{historyType === "background" ? "Background Verification History" : "Document Verification History"}</h2>
        </div>
        {historyType === "background" ? (
          <div className="logList">
            {paginatedLogs.map((log) => (
              <article className="logItem" key={log.id}>
                <button className="logSummary" onClick={() => openLog(log)} type="button">
                  <FileText size={17} />
                  <span>
                    <strong>{log.user_full_name || "Unknown user"}</strong>
                    <small>{log.user_email || "No email"}</small>
                  </span>
                  <span>{log.email_subject}</span>
                  <span className="decisionText">{formatDecision(log.decision)}</span>
                  <span>{formatDateTime(log.decided_at)}</span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="comparisonTableWrap">
            <table className="comparisonTable">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Verdict</th>
                  <th>Issues</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedDocLogs.map((log) => (
                  <tr className="clickable" key={log.id} onClick={() => setSelectedSubmissionId(log.id)}>
                    <td>{log.candidate_name}</td>
                    <td><VerificationStatusBadge status={log.status} /></td>
                    <td>{log.verdict_summary || log.summary || log.status}</td>
                    <td>{log.issue_count}</td>
                    <td>{formatDateTime(log.updated_at || log.created_at)}</td>
                    <td>
                      <button
                        className="paginationBtn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSubmissionId(log.id);
                        }}
                        type="button"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeRows.length > 0 && (
          <div className="paginationRow">
            <span className="paginationInfo">
              Showing {startIndex + 1}–{endIndex} of {activeRows.length}
            </span>
            <div className="paginationButtons">
              <button
                className="paginationBtn"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
                type="button"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                className="paginationBtn"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page === totalPages}
                type="button"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        {!activeRows.length && (
          <p className="emptyText">
            {historyType === "background"
              ? logs.length ? "No history records match the current filter." : "No approval or rejection history yet."
              : docLogs.length ? "No document history records match the current filter." : "No document verification history yet."}
          </p>
        )}
      </section>
      {selectedLog && (
        <div className="logModal" role="dialog" aria-modal="true">
          <div className="logModalPanel">
            <header className="logModalHeader">
              <div>
                <span className={decisionBadgeClass(selectedLog.decision)}>
                  {formatDecision(selectedLog.decision)}
                </span>
                <h2>{selectedLog.email_subject}</h2>
              </div>
              <button
                aria-label="Close log details"
                className="iconAction"
                onClick={() => setSelectedLog(null)}
                title="Close"
                type="button"
              >
                <XCircle size={17} />
              </button>
            </header>

            <section className="auditSummary">
              <div className="auditDecision">
                {selectedLog.decision === "approve_reply" ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <XCircle size={20} />
                )}
                <div>
                  <strong>{selectedLog.email_subject}</strong>
                  <small className="emptyText">Decision and response details</small>
                </div>
              </div>

              <dl className="auditMetaGrid">
                <div>
                  <dt>
                    <UserRound size={14} />
                    Decision by
                  </dt>
                  <dd>{selectedLog.user_full_name || "Unknown user"}</dd>
                </div>
                <div>
                  <dt>
                    <Mail size={14} />
                    User email
                  </dt>
                  <dd>{selectedLog.user_email || "No email"}</dd>
                </div>
                <div>
                  <dt>
                    <Clock3 size={14} />
                    Decision time
                  </dt>
                  <dd>{formatDateTime(selectedLog.decided_at)}</dd>
                </div>
                <div>
                  <dt>
                    <FileText size={14} />
                    Match status
                  </dt>
                  <dd>
                    {selectedVerification ? (
                      <StatusBadge match={selectedVerification.all_fields_match} />
                    ) : (
                      <span className="emptyText">Loading...</span>
                    )}
                  </dd>
                </div>
              </dl>

              {selectedLog.note && (
                <div className="auditNote">
                  <strong>Decision Note</strong>
                  <p>{selectedLog.note}</p>
                </div>
              )}
            </section>

            <div className="modalSplit">
              <section className="modalSection">
                <div className="modalSectionHeader">
                  <FileText size={16} />
                  <h3>Matching Contents</h3>
                </div>
                {selectedVerification?.field_results?.length ? (
                  <div className="comparisonTableWrap">
                    <table className="comparisonTable">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Claimed Value</th>
                          <th>Workday Value</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedVerification.field_results.map((field) => (
                          <tr key={field.field}>
                            <td>{field.field.replaceAll("_", " ")}</td>
                            <td>{field.claimed_value || "Missing"}</td>
                            <td>{field.workday_value || "Not found"}</td>
                            <td>
                              <StatusBadge match={field.matches} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : selectedVerification ? (
                  <p className="emptyPanelText">No matching contents available.</p>
                ) : (
                  <p className="emptyText">Loading matching contents...</p>
                )}
              </section>

              <section className="modalSection">
                <div className="modalSectionHeader">
                  <MessageSquareText size={16} />
                  <h3>Sent Reply</h3>
                </div>
                <pre className="sentReplyBox">{sentReplyText}</pre>
              </section>
            </div>
          </div>
        </div>
      )}
      {selectedSubmissionId && (
        <SubmissionDetailModal
          onClose={() => setSelectedSubmissionId(null)}
          submissionId={selectedSubmissionId}
        />
      )}
    </section>
  );
}
