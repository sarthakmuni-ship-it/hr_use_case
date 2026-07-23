import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  ListChecks,
  XCircle,
} from "lucide-react";
import { docVerificationApi, fetchAuthedFile } from "../api";
import { VerificationStatusBadge } from "./Badges";
import { formatDateTime } from "../utils/date";
import DocumentThumbnail from "./DocumentThumbnail";

const FIELD_GROUPS = {
  candidate_name: "name",
  name: "name",
  dob: "dob",
  doj: "doj",
  account_number: "account_number",
  ifsc_code: "ifsc_code",
  pan_number: "pan_number",
  aadhaar_number: "aadhaar_number",
};

function formatFieldLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDocType(value) {
  return (value || "Unclassified").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(value) {
  if (value === null || value === undefined || value === "") return "Not found";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return "Not found";
    return value.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(" | ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeValue(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fileSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function issueTextMatches(issueText, documentType, fieldName) {
  const haystack = issueText.toLowerCase();
  const docLabel = documentType.toLowerCase().replace(/_/g, " ");
  const fieldLabel = fieldName.toLowerCase().replace(/_/g, " ");
  return haystack.includes(fieldLabel) || haystack.includes(docLabel);
}

function buildFieldStatus(extraction, fieldName, allExtractions, issues) {
  const warnings = extraction?.shape_warnings || [];
  const documentType = formatDocType(extraction?.document_type);
  const value = extraction?.extracted_data?.[fieldName];
  const group = FIELD_GROUPS[fieldName] || fieldName;
  const comparableValues = allExtractions
    .flatMap((doc) =>
      Object.entries(doc.extracted_data || {})
        .filter(([key, item]) => (FIELD_GROUPS[key] || key) === group && item)
        .map(([key, item]) => ({ key, value: item })),
    );
  const hasDifferentValue =
    comparableValues.length > 1 &&
    new Set(comparableValues.map((item) => normalizeValue(item.value)).filter(Boolean)).size > 1;
  const hasWarning = warnings.some((warning) => warning.toLowerCase().includes(fieldName.toLowerCase()));
  const hasIssue = issues.some((issue) => issueTextMatches(issue, documentType, fieldName));
  const missingRequiredValue = value === null || value === undefined || value === "";

  if (hasWarning || hasIssue || hasDifferentValue || missingRequiredValue) {
    return {
      className: "fieldMismatch",
      icon: AlertTriangle,
      label: missingRequiredValue ? "Missing" : "Mismatch",
    };
  }
  return {
    className: "fieldMatch",
    icon: CheckCircle2,
    label: "Match",
  };
}

async function openFileInNewTab(url) {
  const result = await fetchAuthedFile(url);
  window.open(result.url, "_blank", "noopener,noreferrer");
}

function DocumentPreview({ file }) {
  const [preview, setPreview] = useState(null);
  const isImage = /\.(png|jpe?g|gif|bmp|webp)$/i.test(file?.filename || "");
  const isPdf = /\.pdf$/i.test(file?.filename || "") || file?.content_type === "application/pdf";

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    setPreview(null);

    if (!file) return undefined;
    fetchAuthedFile(file.url)
      .then((result) => {
        if (cancelled) {
          URL.revokeObjectURL(result.url);
          return;
        }
        objectUrl = result.url;
        setPreview(result.url);
      })
      .catch(() => setPreview(""));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) return <div className="documentPreviewEmpty">Select a document to preview it.</div>;
  if (preview === null) return <div className="documentPreviewEmpty">Loading preview...</div>;
  if (!preview) return <div className="documentPreviewEmpty">Preview unavailable.</div>;
  if (isImage) return <img alt={file.filename} className="verificationPreviewImage" src={preview} />;
  if (isPdf) return <iframe className="verificationPreviewFrame" src={preview} title={file.filename} />;
  return <div className="documentPreviewEmpty">Use open to view this file type.</div>;
}

export default function SubmissionDetailModal({ submissionId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [selectedFilename, setSelectedFilename] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setSelectedFilename("");
    docVerificationApi
      .detail(submissionId)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setSelectedFilename(data.files?.[0]?.filename || "");
        }
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
  const extractions = detail?.extracted_documents || [];
  const selectedFile = files.find((file) => file.filename === selectedFilename) || files[0] || null;
  const selectedExtraction = extractions.find((doc) => doc.originalName === selectedFile?.filename) || null;
  const selectedFields = Object.entries(selectedExtraction?.extracted_data || {});

  const documentIssueMap = useMemo(() => {
    return new Map(
      extractions.map((doc) => {
        const docType = formatDocType(doc.document_type);
        const hasIssue =
          doc.warning ||
          doc.error ||
          doc.shape_warnings?.length ||
          issues.some((issue) => issue.toLowerCase().includes(docType.toLowerCase()));
        return [doc.originalName, Boolean(hasIssue)];
      }),
    );
  }, [extractions, issues]);

  return (
    <div className="logModal" role="dialog" aria-modal="true">
      <div className="logModalPanel verificationModalPanel">
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
                <div>
                  <dt><FileText size={14} />Documents</dt>
                  <dd>{files.length}</dd>
                </div>
                <div>
                  <dt><AlertTriangle size={14} />Pending</dt>
                  <dd>{pendingDocs.length}</dd>
                </div>
              </dl>
            </section>

            {(issues.length > 0 || pendingDocs.length > 0) && (
              <section className="modalSection reviewNotesPanel">
                <div className="modalSectionHeader">
                  <AlertTriangle size={16} />
                  <h3>Review notes</h3>
                </div>
                <ul className="reviewNotesList">
                  {issues.map((item, i) => (
                    <li className="reviewNoteItem issue" key={`issue-${item}-${i}`}>
                      <AlertTriangle size={15} />
                      <span>{item}</span>
                    </li>
                  ))}
                  {pendingDocs.map((doc, i) => (
                    <li className="reviewNoteItem pending" key={`pending-${doc}-${i}`}>
                      <Clock3 size={15} />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="verificationWorkspace">
              <aside className="documentGridPane">
                <div className="modalSectionHeader">
                  <FileText size={16} />
                  <h3>Submitted documents</h3>
                </div>
                {files.length === 0 ? (
                  <p className="emptyText">
                    {detail.status === "PROCESSING" ? "Files are still being processed..." : "No files found."}
                  </p>
                ) : (
                  <div className="documentMiniGrid">
                    {files.map((file) => {
                      const extraction = extractions.find((doc) => doc.originalName === file.filename);
                      const hasIssue = documentIssueMap.get(file.filename);
                      return (
                        <button
                          className={`documentMiniCard ${selectedFile?.filename === file.filename ? "selected" : ""}`}
                          key={file.filename}
                          onClick={() => setSelectedFilename(file.filename)}
                          type="button"
                        >
                          <div className="docThumbWrap">
                            <DocumentThumbnail filename={file.filename} url={file.url} />
                          </div>
                          <span className="documentMiniTitle">{formatDocType(extraction?.document_type)}</span>
                          <span className="documentMiniMeta">{fileSize(file.size_bytes)}</span>
                          <span className={hasIssue ? "badge badgeMismatch" : "badge badgeMatch"}>
                            {hasIssue ? "Review" : "Matched"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>

              <div className="documentReviewPane">
                <div className="documentPreviewPanel">
                  <div className="documentPreviewHeader">
                    <div>
                      <strong>{selectedFile?.filename || "No document selected"}</strong>
                      <span>{formatDocType(selectedExtraction?.document_type)}</span>
                    </div>
                    {selectedFile && (
                      <button
                        className="secondaryAction"
                        onClick={() => openFileInNewTab(selectedFile.url)}
                        type="button"
                      >
                        <ExternalLink size={14} />
                        Open
                      </button>
                    )}
                  </div>
                  <div className="verificationPreviewSurface">
                    <DocumentPreview file={selectedFile} />
                  </div>
                </div>

                <section className="modelFieldsPanel">
                  <div className="modalSectionHeader">
                    <ListChecks size={16} />
                    <h3>Model extracted details</h3>
                  </div>
                  {selectedExtraction?.warning || selectedExtraction?.error ? (
                    <div className="fieldStatusRow fieldMismatch">
                      <AlertTriangle size={15} />
                      <span>{selectedExtraction.warning || selectedExtraction.error}</span>
                    </div>
                  ) : null}
                  {selectedExtraction?.shape_warnings?.map((warning, i) => (
                    <div className="fieldStatusRow fieldMismatch" key={`${warning}-${i}`}>
                      <AlertTriangle size={15} />
                      <span>{warning}</span>
                    </div>
                  ))}
                  {selectedFields.length === 0 ? (
                    <p className="emptyPanelText">No extracted fields are available for this document yet.</p>
                  ) : (
                    <div className="fieldResultGrid">
                      {selectedFields.map(([key, value]) => {
                        const status = buildFieldStatus(selectedExtraction, key, extractions, issues);
                        const Icon = status.icon;
                        return (
                          <div className={`fieldResultCard ${status.className}`} key={key}>
                            <div>
                              <span>{formatFieldLabel(key)}</span>
                              <strong>{formatFieldValue(value)}</strong>
                            </div>
                            <span className="fieldResultBadge">
                              <Icon size={14} />
                              {status.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
