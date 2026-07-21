import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, FileText, ListChecks, XCircle } from "lucide-react";
import { docVerificationApi, fetchAuthedFile } from "../api";
import { VerificationStatusBadge } from "./Badges";
import { formatDateTime } from "../utils/date";
import DocumentThumbnail from "./DocumentThumbnail";

function formatFieldLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(" | ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function openFileInNewTab(url) {
  const result = await fetchAuthedFile(url);
  window.open(result.url, "_blank");
}

export default function SubmissionDetailModal({ submissionId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    docVerificationApi
      .detail(submissionId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const issues = detail?.issues || [];
  const pendingDocs = detail?.pending_documents || [];
  const files = detail?.files || [];

  function findExtraction(filename) {
    return (detail?.extracted_documents || []).find((d) => d.originalName === filename) || null;
  }

  return (
    <div className="logModal" role="dialog" aria-modal="true">
      <div className="logModalPanel">
        <header className="logModalHeader">
          <div>
            {detail && <VerificationStatusBadge status={detail.status} />}
            <h2>{detail ? detail.candidate_name : "Loading..."}</h2>
          </div>
          <button aria-label="Close" className="iconAction" onClick={onClose} title="Close" type="button">
            <XCircle size={17} />
          </button>
        </header>

        {error && <div className="errorBanner">{error}</div>}

        {detail && (
          <>
            <section className="auditSummary">
              <div className="auditDecision">
                <FileText size={20} />
                <div>
                  <strong>{detail.summary || "Awaiting verdict"}</strong>
                  <small className="emptyText">Submitted {formatDateTime(detail.created_at)}</small>
                </div>
              </div>
              <dl className="auditMetaGrid">
                <div>
                  <dt><Clock3 size={14} />Last updated</dt>
                  <dd>{formatDateTime(detail.updated_at)}</dd>
                </div>
                <div>
                  <dt><ListChecks size={14} />Issues found</dt>
                  <dd>{issues.length}</dd>
                </div>
              </dl>
            </section>

            {issues.length > 0 && (
              <section className="modalSection">
                <div className="modalSectionHeader">
                  <AlertTriangle size={16} />
                  <h3>Issues requiring review</h3>
                </div>
                <ul className="issueList">
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </section>
            )}

            {pendingDocs.length > 0 && (
              <section className="modalSection">
                <div className="modalSectionHeader">
                  <Clock3 size={16} />
                  <h3>Pending documents</h3>
                </div>
                <ul className="issueList">
                  {pendingDocs.map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="modalSectionHeader" style={{ marginTop: 20 }}>
              <FileText size={16} />
              <h3>Submitted documents</h3>
            </div>

            {files.length === 0 ? (
              <p className="emptyText">
                {detail.status === "PROCESSING" ? "Files are still being processed..." : "No files found."}
              </p>
            ) : (
              <div className="docCardGrid">
                {files.map((file) => {
                  const extraction = findExtraction(file.filename);
                  const fields = Object.entries(extraction?.extracted_data || {});
                  return (
                    <button
                      className="docCard"
                      key={file.filename}
                      onClick={() => openFileInNewTab(file.url)}
                      title="Click to open full document"
                      type="button"
                    >
                      <div className="docThumbWrap">
                        <DocumentThumbnail filename={file.filename} url={file.url} />
                      </div>
                      <div className="docCardBody">
                        <div className="docCardType">
                          {extraction?.document_type?.replace(/_/g, " ") || "Unclassified"}
                        </div>
                        <div className="docCardFields">
                          {fields.length === 0 ? (
                            <span>{file.filename}</span>
                          ) : (
                            fields.map(([k, v]) => (
                              <div key={k}>
                                {formatFieldLabel(k)}: {formatFieldValue(v)}
                              </div>
                            ))
                          )}
                        </div>
                        {typeof extraction?.confidence_score === "number" && (
                          <div className="docCardConfidence">
                            Confidence: {(extraction.confidence_score * 100).toFixed(0)}%
                          </div>
                        )}
                        {(extraction?.warning || extraction?.error) && (
                          <span className="badge badgeMismatch" style={{ marginTop: 4 }}>
                            {extraction.warning || extraction.error}
                          </span>
                        )}
                        {extraction?.shape_warnings?.length > 0 && (
                          <ul className="issueList" style={{ marginTop: 4 }}>
                            {extraction.shape_warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}