import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Filter, Inbox, RefreshCcw, X } from "lucide-react";
import { emailsApi } from "../api";
import MailList from "../components/MailList";
import VerificationDetail from "../components/VerificationDetail";

export default function MailsPage({
  loading,
  onError,
  onLoadingChange,
  onRefresh,
  refreshSignal,
}) {
  const [emails, setEmails] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [verification, setVerification] = useState(null);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    fromDate: "",
    toDate: "",
  });

  const activeFilterCount = [
    filters.status !== "all",
    Boolean(filters.fromDate),
    Boolean(filters.toDate),
  ].filter(Boolean).length;
  const newCount = emails.filter((email) => email.status === "new").length;
  const pendingCount = emails.filter((email) => email.status === "pending").length;
  const completedCount = emails.filter((email) => email.status === "completed").length;
  const totalCount = Math.max(emails.length, 1);

  const filteredEmails = emails.filter((email) => {
    if (filters.status !== "all" && email.status !== filters.status) {
      return false;
    }

    const receivedDate = String(email.received_at || "").slice(0, 10);

    if (filters.fromDate && receivedDate < filters.fromDate) {
      return false;
    }

    if (filters.toDate && receivedDate > filters.toDate) {
      return false;
    }

    return true;
  });

  // Keep the inbox list warm so the selected detail can change without remounting the shell.
  async function loadEmails() {
    onLoadingChange(true);
    onError("");

    try {
      const data = await emailsApi.list();
      setEmails(data);
    } catch (err) {
      onError(err.message);
    } finally {
      onLoadingChange(false);
    }
  }

  // Opening a mail is the moment the backend marks it as pending, so we refresh the list after.
  async function loadVerification(emailId) {
    if (!emailId) {
      setVerification(null);
      return;
    }

    setDecisionMessage("");
    onError("");

    try {
      const data = await emailsApi.verification(emailId);
      setVerification(data);
      const refreshed = await emailsApi.list();
      setEmails(refreshed);
    } catch (err) {
      onError(err.message);
    }
  }

  function returnToList() {
    setSelectedId(null);
    setVerification(null);
    setDecisionMessage("");
  }

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearFilters() {
    setFilters({
      status: "all",
      fromDate: "",
      toDate: "",
    });
  }

  // Decisions update the audit trail and then rehydrate the selected mail for the reviewer.
  async function saveDecision(decision, replyBody, note = "" ) {
    if (!verification) return;

    onLoadingChange(true);
    onError("");
    setDecisionMessage("");

    try {
      // Passes the edited replyBody downstream directly to the backend SMTP routine
      const result = await emailsApi.decide(verification.email_id, decision, replyBody, note);
      setDecisionMessage(result.message);
      await loadEmails();
      await loadVerification(verification.email_id);
    } catch (err) {
      onError(err.message);
    } finally {
      onLoadingChange(false);
    }
  }

  useEffect(() => {
    loadEmails();
  }, [refreshSignal]);

  useEffect(() => {
    loadVerification(selectedId);
  }, [selectedId]);

  return (
    <section className="mailsPage">
      <header className="pageTitleRow">
        <div>
          <p className="eyebrow">JADE background verification</p>
          <h1>Mails</h1>
        </div>
        <div className="mailToolbar">
          <button
            aria-label="Filter mails"
            aria-pressed={filtersOpen}
            className={filtersOpen || activeFilterCount ? "iconAction active" : "iconAction"}
            onClick={() => setFiltersOpen((current) => !current)}
            title="Filter mails"
            type="button"
          >
            <Filter size={17} />
            {activeFilterCount > 0 && (
              <span className="filterCount">{activeFilterCount}</span>
            )}
          </button>
          <button
            aria-label="Refresh mails"
            className="iconAction"
            disabled={loading}
            onClick={onRefresh}
            title="Refresh mails"
            type="button"
          >
            <RefreshCcw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
      </header>
      {!selectedId && (
        <>
          <section className="metricGrid">
            <article className="metricCard">
              <span className="metricIcon">
                <Inbox size={18} />
              </span>
              <div>
                <small>New</small>
                <strong>{newCount}</strong>
              </div>
            </article>
            <article className="metricCard">
              <span className="metricIcon warning">
                <Clock3 size={18} />
              </span>
              <div>
                <small>Pending Review</small>
                <strong>{pendingCount}</strong>
              </div>
            </article>
            <article className="metricCard">
              <span className="metricIcon success">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <small>Completed</small>
                <strong>{completedCount}</strong>
              </div>
            </article>
          </section>
          <section className="panel statusOverview">
            <div className="statusOverviewHeader">
              <span>Review Pipeline</span>
              <strong>{emails.length} total</strong>
            </div>
            <div className="statusBar" aria-label="Mail status distribution">
              <span className="statusSegment new" style={{ width: `${(newCount / totalCount) * 100}%` }} />
              <span className="statusSegment pending" style={{ width: `${(pendingCount / totalCount) * 100}%` }} />
              <span className="statusSegment completed" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
            </div>
            <div className="statusLegend">
              <span><i className="legendDot new" />New</span>
              <span><i className="legendDot pending" />Pending</span>
              <span><i className="legendDot completed" />Completed</span>
            </div>
          </section>
        </>
      )}
      {selectedId ? (
        verification ? (
          <VerificationDetail
            verification={verification}
            onBack={returnToList}
            onDecision={saveDecision}
            decisionMessage={decisionMessage}
          />
        ) : (
          <section className="panel emptyState">Loading selected mail...</section>
        )
      ) : (
        <>
          {filtersOpen && (
            <section className="panel filterPanel">
              <div className="filterControls">
                <label>
                  Status
                  <select name="status" onChange={updateFilter} value={filters.status}>
                    <option value="all">All statuses</option>
                    <option value="new">New</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label>
                  From
                  <input
                    name="fromDate"
                    onChange={updateFilter}
                    type="date"
                    value={filters.fromDate}
                  />
                </label>
                <label>
                  To
                  <input
                    name="toDate"
                    onChange={updateFilter}
                    type="date"
                    value={filters.toDate}
                  />
                </label>
                <button
                  className="filterClear"
                  disabled={!activeFilterCount}
                  onClick={clearFilters}
                  type="button"
                >
                  <X size={15} />
                  Clear
                </button>
              </div>
            </section>
          )}
          <MailList emails={filteredEmails} selectedId={selectedId} onSelect={setSelectedId} />
        </>
      )}
    </section>
  );
}
