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
} from "lucide-react";
import { emailsApi, logsApi } from "../api";
import { StatusBadge } from "../components/Badges";
import { formatDateTime } from "../utils/date";

function formatDecision(value) {
  return value === "approve_reply" ? "Approved" : "Rejected";
}

function decisionBadgeClass(value) {
  return value === "approve_reply" ? "badge badgeMatch" : "badge badgeMismatch";
}

export default function LogsPage({ refreshSignal, onLoadingChange, onError }) {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [verificationByEmail, setVerificationByEmail] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  const normalizedUserFilter = userFilter.trim().toLowerCase();
  const filteredLogs = normalizedUserFilter
    ? logs.filter((log) => {
        const userName = log.user_full_name || "";
        const userEmail = log.user_email || "";
        return `${userName} ${userEmail}`.toLowerCase().includes(normalizedUserFilter);
      })
    : logs;

  const approvedCount = logs.filter((log) => log.decision === "approve_reply").length;
  const rejectedCount = logs.filter((log) => log.decision === "reject_reply").length;
  const decisionTotal = Math.max(logs.length, 1);
  const selectedVerification = selectedLog ? verificationByEmail[selectedLog.email_id] : null;
  const sentReplyText =
    selectedLog?.sent_reply ||
    selectedVerification?.recommended_reply ||
    "No sent reply was captured for this log.";

  async function loadLogs() {
    onLoadingChange(true);
    onError("");

    try {
      setLogs(await logsApi.list());
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

  return (
    <section className="contentPage">
      <div className="pageTitleRow">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1>Logs</h1>
        </div>
        <button
          aria-label="Filter logs"
          aria-pressed={filtersOpen}
          className={filtersOpen || userFilter ? "iconAction active" : "iconAction"}
          onClick={() => setFiltersOpen((current) => !current)}
          title="Filter logs"
          type="button"
        >
          <Filter size={17} />
          {userFilter && <span className="filterCount">1</span>}
        </button>
      </div>
      <section className="metricGrid">
        <article className="metricCard">
          <span className="metricIcon success">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <small>Approved</small>
            <strong>{approvedCount}</strong>
          </div>
        </article>
        <article className="metricCard">
          <span className="metricIcon danger">
            <XCircle size={18} />
          </span>
          <div>
            <small>Rejected</small>
            <strong>{rejectedCount}</strong>
          </div>
        </article>
        <article className="metricCard">
          <span className="metricIcon">
            <Search size={18} />
          </span>
          <div>
            <small>Visible Logs</small>
            <strong>{filteredLogs.length}</strong>
          </div>
        </article>
      </section>
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
      {filtersOpen && (
        <section className="panel filterPanel">
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
            <button
              className="filterClear"
              disabled={!userFilter}
              onClick={() => setUserFilter("")}
              type="button"
            >
              <XCircle size={15} />
              Clear
            </button>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="panelHeader">
          <h2>Decision Logs</h2>
        </div>
        <div className="logList">
          {filteredLogs.map((log) => {
            return (
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
            );
          })}
        </div>
        {!filteredLogs.length && (
          <p className="emptyText">
            {logs.length ? "No logs match the current filter." : "No approval or rejection logs yet."}
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
    </section>
  );
}
