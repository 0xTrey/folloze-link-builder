"use client";

import Papa from "papaparse";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyColumnMapping,
  inspectContactsCsv,
  MAX_ROWS,
  parseContactsCsv,
  serializeOutputCsv,
  summarizeInspection,
  type ColumnField,
  type ColumnMapping,
  type CsvInspectionResult,
  type ParseError,
  type ParseResult,
} from "@/lib/csv-parser";
import {
  loadRecentBoards,
  rememberRecentBoard,
  validateBoardUrl,
} from "@/lib/board-url";
import { buildFollozeUrl, buildLinksForRows } from "@/lib/url-builder";
import type { ContactRow, UtmConfig } from "@/lib/url-builder";
import type { SessionConfig, SessionRecord } from "@/lib/db";
import {
  BoardUrlSection,
  EmptyState,
  Hero,
  ImportStepSection,
  ReadySidebar,
  ResultSection,
  ReviewStepSection,
  SessionSidebar,
  TrackingSection,
  WizardSidebar,
  WorkspaceShell,
  type IdentityPreview,
  type Notice,
  type PreviewRow,
  type WizardStepStatus,
} from "@/components/link-builder-ui";

type AppState =
  | { stage: "idle" }
  | { stage: "session_loading" }
  | {
      stage: "session_restored";
      session: SessionRecord;
      previewRows: PreviewRow[];
    }
  | { stage: "session_expired" }
  | { stage: "inspecting_file" }
  | { stage: "review_ready" }
  | { stage: "building" }
  | {
      stage: "ready";
      csvOutput: string;
      rowCount: number;
      skippedCount: number;
      previewRows: PreviewRow[];
      sessionId: string | null;
      shareUrl: string | null;
    };

const UTM_DEFAULTS: UtmConfig = {
  utm_source: "email",
  utm_medium: "email",
  utm_campaign: "",
  utm_content: "",
};

const PREVIEW_COUNT = 10;

function isParseError(result: ParseResult | ParseError | CsvInspectionResult): result is ParseError {
  return "type" in result;
}

function formatExpiry(isoString: string): string {
  const expires = new Date(isoString);
  const diffMs = expires.getTime() - Date.now();

  if (diffMs <= 0) return "less than a minute";

  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffH > 0) return `${diffH}h ${diffM}m`;
  return `${Math.max(1, diffM)}m`;
}

function triggerDownload(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function getCurrentUrl() {
  if (typeof window === "undefined") return null;
  return window.location.href;
}

function clearSessionParam() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("s");
  window.history.replaceState(null, "", url.toString());
}

function parseSavedPreviewRows(csvData: string): PreviewRow[] {
  const parsed = Papa.parse<Record<string, string>>(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) return [];

  return parsed.data.slice(0, PREVIEW_COUNT).map((row) => ({
    email: row.email ?? "",
    company: row.company ?? "",
    link: row.folloze_link ?? "",
  }));
}

function buildExportPreviewRows(
  rows: ContactRow[],
  links: Array<string | null>
): PreviewRow[] {
  return rows.slice(0, PREVIEW_COUNT).map((row, index) => ({
    email: row.email,
    company: row.company ?? "",
    link: links[index] ?? "",
  }));
}

function buildIdentityPreviews(
  rows: ContactRow[],
  boardUrl: string | null,
  utms: UtmConfig
): IdentityPreview[] {
  return rows.map((row) => {
    const payload = [
      { key: "em", value: row.email },
      { key: "fn", value: row.first_name ?? "" },
      { key: "ln", value: row.last_name ?? "" },
      { key: "co", value: row.company ?? "" },
      { key: "ro", value: row.title ?? "" },
      { key: "inby", value: row.sender_email ?? "" },
    ];

    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

    return {
      email: row.email,
      headline: fullName || row.email,
      company: row.company ?? "",
      payload,
      link: boardUrl ? buildFollozeUrl(boardUrl, row, utms) : null,
    };
  });
}

export default function Home() {
  const [boardUrl, setBoardUrl] = useState("");
  const [utms, setUtms] = useState<UtmConfig>(UTM_DEFAULTS);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importNotice, setImportNotice] = useState<Notice | null>(null);
  const [appState, setAppState] = useState<AppState>({ stage: "idle" });
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [inspection, setInspection] = useState<CsvInspectionResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(createEmptyColumnMapping);
  const [recentBoards, setRecentBoards] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspectionRunRef = useRef(0);

  useEffect(() => {
    setRecentBoards(loadRecentBoards());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("s");

    if (!sessionId) return;

    setAppState({ stage: "session_loading" });

    fetch(`/api/sessions/${sessionId}`)
      .then(async (response) => {
        if (response.status === 404) {
          setAppState({ stage: "session_expired" });
          return null;
        }

        if (!response.ok) {
          throw new Error(`Session lookup failed: ${response.status}`);
        }

        return (await response.json()) as SessionRecord;
      })
      .then((data) => {
        if (!data) return;

        setAppState({
          stage: "session_restored",
          session: data,
          previewRows: parseSavedPreviewRows(data.csvData),
        });
      })
      .catch(() => {
        setAppState({ stage: "idle" });
      });
  }, []);

  const boardValidation = useMemo(() => validateBoardUrl(boardUrl), [boardUrl]);
  const boardNotice = useMemo<Notice | null>(() => {
    if (boardValidation.error) {
      return { tone: "error", message: boardValidation.error };
    }

    if (boardValidation.warning) {
      return { tone: "warning", message: boardValidation.warning };
    }

    return null;
  }, [boardValidation.error, boardValidation.warning]);

  const reviewSummary = useMemo(
    () => (inspection ? summarizeInspection(inspection, mapping) : null),
    [inspection, mapping]
  );

  const identityPreviews = useMemo(
    () =>
      reviewSummary
        ? buildIdentityPreviews(
            reviewSummary.previewRows,
            boardValidation.isValid ? boardValidation.normalizedUrl : null,
            utms
          )
        : [],
    [reviewSummary, boardValidation.isValid, boardValidation.normalizedUrl, utms]
  );

  const canGenerate = Boolean(
    reviewSummary &&
      boardValidation.isValid &&
      reviewSummary.blockingIssues.length === 0 &&
      appState.stage !== "building"
  );

  const maxRowsLabel = `${MAX_ROWS.toLocaleString()} rows`;
  const currentUrl = getCurrentUrl();

  const importStatusLine = useMemo(() => {
    if (appState.stage === "inspecting_file") {
      return "Inspecting headers and sample rows now.";
    }

    if (inspection) {
      const processedCount = inspection.rows.length.toLocaleString();
      const totalCount = inspection.totalParsed.toLocaleString();

      if (inspection.truncated) {
        return `${processedCount} of ${totalCount} rows are loaded for review.`;
      }

      return `${processedCount} rows are ready for mapping review.`;
    }

    if (importNotice?.tone === "error") {
      return "The uploaded file needs attention before you can continue.";
    }

    return "Upload a CSV to inspect headers, row counts, and sample identity data.";
  }, [appState.stage, importNotice?.tone, inspection]);

  const wizardSteps = useMemo<WizardStepStatus[]>(() => {
    const boardComplete = boardValidation.isValid;
    const importComplete = Boolean(inspection);
    const reviewComplete = Boolean(
      reviewSummary && reviewSummary.blockingIssues.length === 0
    );
    const exportComplete =
      appState.stage === "ready" || appState.stage === "session_restored";

    return [
      {
        label: "Board",
        description: boardComplete
          ? "Destination validated."
          : "Add the destination board URL.",
        state: boardComplete ? "complete" : "current",
      },
      {
        label: "Import",
        description: importComplete
          ? "CSV inspected and loaded."
          : appState.stage === "inspecting_file"
            ? "Inspecting the uploaded CSV."
            : "Upload a contacts CSV.",
        state: importComplete
          ? "complete"
          : appState.stage === "inspecting_file" || Boolean(file)
            ? "current"
            : "pending",
      },
      {
        label: "Review",
        description: reviewComplete
          ? "Identity mapping is ready."
          : importComplete
            ? "Resolve any blocking issues before export."
            : "Review appears after import.",
        state: reviewComplete ? "complete" : importComplete ? "current" : "pending",
      },
      {
        label: "Export",
        description: exportComplete
          ? "CSV is generated and shareable."
          : "Generate the export once review passes.",
        state: exportComplete ? "complete" : reviewComplete ? "current" : "pending",
      },
    ];
  }, [
    appState.stage,
    boardValidation.isValid,
    file,
    inspection,
    reviewSummary,
  ]);
  const isBusy = appState.stage === "building";

  function resetResultState(nextStage: AppState["stage"] = "review_ready") {
    clearSessionParam();
    setCopiedShareUrl(false);
    setAppState((current) => {
      if (current.stage !== "ready") return current;
      return nextStage === "review_ready" && inspection
        ? { stage: "review_ready" }
        : { stage: "idle" };
    });
  }

  async function handleFile(nextFile: File) {
    const runId = inspectionRunRef.current + 1;
    inspectionRunRef.current = runId;

    if (
      appState.stage === "ready" ||
      appState.stage === "session_restored" ||
      appState.stage === "session_expired"
    ) {
      clearSessionParam();
    }

    setFile(nextFile);
    setDragOver(false);
    setCopiedShareUrl(false);
    setImportNotice(null);
    setInspection(null);
    setMapping(createEmptyColumnMapping());
    setAppState({ stage: "inspecting_file" });

    const result = await inspectContactsCsv(nextFile);

    if (inspectionRunRef.current !== runId) return;

    if (isParseError(result)) {
      setImportNotice({ tone: "error", message: result.message });
      setAppState({ stage: "idle" });
      return;
    }

    setInspection(result);
    setMapping({ ...result.inferredMapping });
    setImportNotice(
      result.warnings.length > 0
        ? { tone: "warning", message: result.warnings.join(" ") }
        : null
    );
    setAppState({ stage: "review_ready" });
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) {
      void handleFile(nextFile);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);

    const nextFile = event.dataTransfer.files[0];
    if (nextFile) {
      void handleFile(nextFile);
    }
  }

  function handleBoardChange(value: string) {
    setBoardUrl(value);
    if (appState.stage === "ready") {
      resetResultState();
    }
  }

  function handleUseRecentBoard(value: string) {
    setBoardUrl(value);
    if (appState.stage === "ready") {
      resetResultState();
    }
  }

  function setUtm(key: keyof UtmConfig, value: string) {
    setUtms((current) => ({ ...current, [key]: value }));

    if (appState.stage === "ready") {
      resetResultState();
    }
  }

  function handleMappingChange(field: ColumnField, value: string | null) {
    setMapping((current) => ({ ...current, [field]: value }));

    if (appState.stage === "ready") {
      resetResultState();
    }
  }

  async function handleGenerate() {
    if (!file || !reviewSummary || !boardValidation.isValid) return;

    setCopiedShareUrl(false);
    setAppState({ stage: "building" });

    const parsed = await parseContactsCsv(file, mapping);

    if (isParseError(parsed)) {
      setImportNotice({ tone: "error", message: parsed.message });
      setAppState({ stage: inspection ? "review_ready" : "idle" });
      return;
    }

    const normalizedBoardUrl = boardValidation.normalizedUrl;
    const results = buildLinksForRows(normalizedBoardUrl, parsed.rows, utms);
    const links = results.map((result) => result.link);
    const csvOutput = serializeOutputCsv(parsed.rows, links);
    const previewRows = buildExportPreviewRows(parsed.rows, links);

    let sessionId: string | null = null;
    let shareUrl: string | null = null;

    try {
      const config: SessionConfig = {
        boardUrl: normalizedBoardUrl,
        utmSource: utms.utm_source,
        utmMedium: utms.utm_medium,
        utmCampaign: utms.utm_campaign,
        utmContent: utms.utm_content,
      };

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowCount: parsed.rows.length, csvData: csvOutput, config }),
      });

      if (response.ok) {
        const data = await response.json();
        sessionId = typeof data.sessionId === "string" ? data.sessionId : null;

        if (sessionId) {
          const url = new URL(window.location.href);
          url.searchParams.set("s", sessionId);
          window.history.replaceState(null, "", url.toString());
          shareUrl = url.toString();
        }
      }
    } catch {
      shareUrl = null;
    }

    setRecentBoards(rememberRecentBoard(normalizedBoardUrl));
    setImportNotice(
      parsed.warnings.length > 0
        ? { tone: "warning", message: parsed.warnings.join(" ") }
        : null
    );
    setAppState({
      stage: "ready",
      csvOutput,
      rowCount: parsed.rows.length,
      skippedCount: parsed.skippedCount,
      previewRows,
      sessionId,
      shareUrl,
    });
  }

  function handleDownload(csvString: string, count: number) {
    triggerDownload(csvString, `folloze-links-${count}-contacts.csv`);
  }

  function handleStartOver() {
    inspectionRunRef.current += 1;
    setAppState({ stage: "idle" });
    setBoardUrl("");
    setUtms(UTM_DEFAULTS);
    setFile(null);
    setDragOver(false);
    setImportNotice(null);
    setInspection(null);
    setMapping(createEmptyColumnMapping());
    setCopiedShareUrl(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    clearSessionParam();
  }

  async function handleCopyShareUrl(shareUrl: string | null) {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      window.setTimeout(() => setCopiedShareUrl(false), 1800);
    } catch {
      setCopiedShareUrl(false);
    }
  }

  let heroTitle = "Upload contacts and generate Folloze-ready links";
  let heroDescription =
    "Validate the destination board, inspect the contact file, review identity mapping, and export customized links in one guided flow.";

  if (appState.stage === "session_loading") {
    heroTitle = "Restoring saved export";
    heroDescription = "Loading the saved CSV and session details back into the workspace.";
  } else if (appState.stage === "session_restored") {
    heroTitle = "Saved export ready";
    heroDescription = "This batch is already generated. Download it again or copy the share URL while the session is still active.";
  } else if (appState.stage === "session_expired") {
    heroTitle = "Saved batch expired";
    heroDescription = "The 24-hour retention window has ended. Start a new batch to generate a fresh export.";
  } else if (appState.stage === "building") {
    heroTitle = "Generating links";
    heroDescription = "The batch is being converted into tracked Folloze URLs and saved for 24-hour sharing.";
  } else if (appState.stage === "ready") {
    heroTitle = "Export ready";
    heroDescription = "Review the preview rows, download the CSV, and share the saved session URL if another person needs the batch.";
  }

  const liveMessage =
    appState.stage === "inspecting_file"
      ? "Inspecting the uploaded CSV."
      : appState.stage === "building"
        ? "Generating links."
        : appState.stage === "session_loading"
          ? "Restoring saved batch."
          : importNotice?.message ?? "";

  let mainContent: ReactNode;
  let sidebar: ReactNode;

  if (appState.stage === "session_loading") {
    mainContent = (
      <EmptyState
        title="Restoring saved batch"
        description="Fetching the generated CSV and saved metadata now."
      />
    );

    sidebar = (
      <WizardSidebar
        steps={wizardSteps}
        canGenerate={false}
        isBuilding
        maxRowsLabel={maxRowsLabel}
        onGenerate={() => undefined}
      />
    );
  } else if (appState.stage === "session_restored") {
    mainContent = (
      <ResultSection
        title="Saved batch ready"
        description="This session is already generated and available for download."
        rowCount={appState.session.rowCount}
        skippedCount={null}
        previewRows={appState.previewRows}
        shareUrl={currentUrl}
        sessionSaved
        onDownload={() => handleDownload(appState.session.csvData, appState.session.rowCount)}
        onCopyShareUrl={() => handleCopyShareUrl(currentUrl)}
        copiedShareUrl={copiedShareUrl}
      />
    );

    sidebar = (
      <SessionSidebar
        session={appState.session}
        shareUrl={currentUrl}
        onDownload={() => handleDownload(appState.session.csvData, appState.session.rowCount)}
        onStartOver={handleStartOver}
        onCopyShareUrl={() => handleCopyShareUrl(currentUrl)}
        copiedShareUrl={copiedShareUrl}
        expiresInLabel={formatExpiry(appState.session.expiresAt)}
      />
    );
  } else if (appState.stage === "session_expired") {
    mainContent = (
      <EmptyState
        title="Saved batch expired"
        description="Saved batches are only retained for 24 hours. Start a new run to regenerate the export."
        actionLabel="Start a new batch"
        onAction={handleStartOver}
      />
    );

    sidebar = (
      <WizardSidebar
        steps={wizardSteps}
        canGenerate={false}
        isBuilding={false}
        maxRowsLabel={maxRowsLabel}
        onGenerate={() => undefined}
      />
    );
  } else {
    const readyState = appState.stage === "ready" ? appState : null;

    mainContent = (
      <>
        <BoardUrlSection
          value={boardUrl}
          normalizedUrl={boardValidation.isValid ? boardValidation.normalizedUrl : null}
          notice={boardNotice}
          recentBoards={recentBoards}
          disabled={isBusy}
          onChange={handleBoardChange}
          onUseRecent={handleUseRecentBoard}
        />
        <ImportStepSection
          file={file}
          dragOver={dragOver}
          fileInputRef={fileInputRef}
          notice={importNotice}
          statusLine={importStatusLine}
          maxRowsLabel={maxRowsLabel}
          disabled={isBusy}
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onOpenPicker={() => fileInputRef.current?.click()}
          onFileInput={handleFileInput}
        />
        {reviewSummary ? (
          <>
            <ReviewStepSection
              headers={inspection?.headers ?? []}
              mapping={mapping}
              fieldStatuses={reviewSummary.fieldStatuses}
              validRowCount={reviewSummary.validRowCount}
              skippedCount={reviewSummary.skippedCount}
              blockingIssues={reviewSummary.blockingIssues}
              nonBlockingIssues={reviewSummary.nonBlockingIssues}
              identityPreviews={identityPreviews}
              disabled={isBusy}
              onChangeMapping={handleMappingChange}
            />
            <TrackingSection utms={utms} disabled={isBusy} onChange={setUtm} />
          </>
        ) : null}
        {readyState ? (
          <ResultSection
            title="Links generated"
            description={`Showing the first ${Math.min(PREVIEW_COUNT, readyState.previewRows.length)} generated rows.`}
            rowCount={readyState.rowCount}
            skippedCount={readyState.skippedCount}
            previewRows={readyState.previewRows}
            shareUrl={readyState.shareUrl}
            sessionSaved={Boolean(readyState.sessionId)}
            onDownload={() => handleDownload(readyState.csvOutput, readyState.rowCount)}
            onCopyShareUrl={() => handleCopyShareUrl(readyState.shareUrl)}
            copiedShareUrl={copiedShareUrl}
          />
        ) : null}
      </>
    );

    sidebar = readyState ? (
      <ReadySidebar
        title="Export ready"
        description={
          readyState.sessionId
            ? "The export is saved and shareable for 24 hours."
            : "Download now. Session save did not complete for this run."
        }
        rowCount={readyState.rowCount}
        skippedCount={readyState.skippedCount}
        shareUrl={readyState.shareUrl}
        sessionSaved={Boolean(readyState.sessionId)}
        onDownload={() => handleDownload(readyState.csvOutput, readyState.rowCount)}
        onStartOver={handleStartOver}
        onCopyShareUrl={() => handleCopyShareUrl(readyState.shareUrl)}
        copiedShareUrl={copiedShareUrl}
      />
    ) : (
      <WizardSidebar
        steps={wizardSteps}
        canGenerate={canGenerate}
        isBuilding={appState.stage === "building"}
        maxRowsLabel={maxRowsLabel}
        onGenerate={() => {
          void handleGenerate();
        }}
      />
    );
  }

  return (
    <WorkspaceShell sidebar={sidebar}>
      <div className="sr-only" aria-live="polite">
        {liveMessage}
      </div>
      <Hero
        eyebrow="Customer-facing guided import"
        title={heroTitle}
        description={heroDescription}
      />
      {mainContent}
    </WorkspaceShell>
  );
}
