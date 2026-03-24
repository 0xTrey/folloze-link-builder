"use client";

import { useEffect, useRef, useState } from "react";
import { parseContactsCsv, serializeOutputCsv, MAX_ROWS } from "@/lib/csv-parser";
import { buildLinksForRows } from "@/lib/url-builder";
import type { UtmConfig } from "@/lib/url-builder";
import type { ParseResult, ParseError } from "@/lib/csv-parser";
import type { SessionConfig, SessionRecord } from "@/lib/db";
import {
  BoardUrlSection,
  BuildSidebar,
  EmptyState,
  Hero,
  ReadySidebar,
  ResultSection,
  SessionSidebar,
  TrackingSection,
  UploadSection,
  WorkspaceShell,
  type Notice,
  type PreviewRow,
} from "@/components/link-builder-ui";

type AppState =
  | { stage: "idle" }
  | { stage: "session_loading" }
  | { stage: "session_restored"; session: SessionRecord }
  | { stage: "session_expired" }
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

function isParseError(result: ParseResult | ParseError): result is ParseError {
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

function buildWarningNotice(parsed: ParseResult): Notice | null {
  const messages = [...parsed.warnings];

  if (parsed.skippedCount > 0) {
    const label = parsed.skippedCount === 1 ? "row" : "rows";
    messages.push(`${parsed.skippedCount.toLocaleString()} ${label} without email were skipped.`);
  }

  if (messages.length === 0) return null;

  return {
    tone: "warning",
    message: messages.join(" "),
  };
}

export default function Home() {
  const [boardUrl, setBoardUrl] = useState("");
  const [utms, setUtms] = useState<UtmConfig>(UTM_DEFAULTS);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [appState, setAppState] = useState<AppState>({ stage: "idle" });
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("s");

    if (!sessionId) return;

    setAppState({ stage: "session_loading" });

    fetch(`/api/sessions/${sessionId}`)
      .then((response) => {
        if (response.status === 404) {
          setAppState({ stage: "session_expired" });
          return null;
        }

        return response.json();
      })
      .then((data: SessionRecord | null) => {
        if (!data) return;
        setAppState({ stage: "session_restored", session: data });
      })
      .catch(() => {
        setAppState({ stage: "idle" });
      });
  }, []);

  const handleFile = (nextFile: File) => {
    setFile(nextFile);
    setNotice(null);
    setCopiedShareUrl(false);

    if (appState.stage === "ready") {
      setAppState({ stage: "idle" });
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) handleFile(nextFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const nextFile = event.dataTransfer.files[0];
    if (nextFile) handleFile(nextFile);
  };

  const setUtm = (key: keyof UtmConfig, value: string) => {
    setUtms((current) => ({ ...current, [key]: value }));
  };

  const canGenerate = boardUrl.trim() !== "" && file !== null;

  const handleGenerate = async () => {
    if (!file || !boardUrl.trim()) return;

    setNotice(null);
    setCopiedShareUrl(false);
    setAppState({ stage: "building" });

    const parsed = await parseContactsCsv(file);

    if (isParseError(parsed)) {
      setNotice({ tone: "error", message: parsed.message });
      setAppState({ stage: "idle" });
      return;
    }

    const results = buildLinksForRows(boardUrl.trim(), parsed.rows, utms);
    const links = results.map((result) => result.link);
    const csvOutput = serializeOutputCsv(parsed.rows, links);
    const previewRows: PreviewRow[] = results.slice(0, PREVIEW_COUNT).map(({ contact, link }) => ({
      email: contact.email,
      company: contact.company ?? "",
      link: link ?? "(skipped)",
    }));

    let sessionId: string | null = null;
    let shareUrl: string | null = null;

    try {
      const config: SessionConfig = {
        boardUrl: boardUrl.trim(),
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

    setNotice(buildWarningNotice(parsed));
    setAppState({
      stage: "ready",
      csvOutput,
      rowCount: parsed.rows.length,
      skippedCount: parsed.skippedCount,
      previewRows,
      sessionId,
      shareUrl,
    });
  };

  const handleDownload = (csvString: string, count: number) => {
    triggerDownload(csvString, `folloze-links-${count}-contacts.csv`);
  };

  const handleStartOver = () => {
    setAppState({ stage: "idle" });
    setBoardUrl("");
    setUtms(UTM_DEFAULTS);
    setFile(null);
    setNotice(null);
    setCopiedShareUrl(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    window.history.replaceState(null, "", url.toString());
  };

  const handleCopyShareUrl = async (shareUrl: string | null) => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      window.setTimeout(() => setCopiedShareUrl(false), 1800);
    } catch {
      setCopiedShareUrl(false);
    }
  };

  const maxRowsLabel = `${MAX_ROWS.toLocaleString()} rows`;
  const currentUrl = getCurrentUrl();

  let heroTitle = "Build personalized Folloze links";
  let heroDescription =
    "Load a board destination, upload a contact export, and generate shareable tracked URLs in one pass.";

  if (appState.stage === "session_loading") {
    heroTitle = "Restoring saved batch";
    heroDescription = "Pulling the saved CSV and session metadata back into the workspace.";
  } else if (appState.stage === "session_restored") {
    heroTitle = "Saved batch ready";
    heroDescription = "This batch is already generated. Download it again or copy the share URL while the session is still active.";
  } else if (appState.stage === "session_expired") {
    heroTitle = "Saved batch expired";
    heroDescription = "The 24 hour retention window has ended. Start a new batch to generate a fresh export.";
  } else if (appState.stage === "ready") {
    heroTitle = "Links generated";
    heroDescription = "Review the preview, download the CSV, and share the saved session URL if you need another person to access the batch.";
  }

  const liveMessage =
    appState.stage === "building"
      ? "Generating links."
      : appState.stage === "session_loading"
        ? "Restoring saved batch."
        : notice?.message ?? "";

  let mainContent: React.ReactNode;
  let sidebar: React.ReactNode;

  if (appState.stage === "session_loading") {
    mainContent = (
      <EmptyState
        title="Restoring saved batch"
        description="Fetching the generated CSV and the saved configuration now."
      />
    );

    sidebar = (
      <BuildSidebar
        boardUrl=""
        file={null}
        canGenerate={false}
        isBuilding
        maxRowsLabel={maxRowsLabel}
        onGenerate={() => undefined}
      />
    );
  } else if (appState.stage === "session_restored") {
    mainContent = (
      <EmptyState
        title="Saved batch available"
        description="This batch is already built. Download the CSV again or start a new run from a fresh workspace."
        actionLabel="Start a new batch"
        onAction={handleStartOver}
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
        title="Session expired"
        description="Saved batches are only retained for 24 hours. Start a new run to regenerate the export."
        actionLabel="Start a new batch"
        onAction={handleStartOver}
      />
    );

    sidebar = (
      <BuildSidebar
        boardUrl=""
        file={null}
        canGenerate={false}
        isBuilding={false}
        maxRowsLabel={maxRowsLabel}
        onGenerate={() => undefined}
      />
    );
  } else {
    const isBuilding = appState.stage === "building";
    const readyState = appState.stage === "ready" ? appState : null;

    mainContent = (
      <>
        <BoardUrlSection value={boardUrl} onChange={setBoardUrl} />
        <UploadSection
          file={file}
          dragOver={dragOver}
          fileInputRef={fileInputRef}
          notice={notice}
          maxRowsLabel={maxRowsLabel}
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onOpenPicker={() => fileInputRef.current?.click()}
          onFileInput={handleFileInput}
        />
        <TrackingSection utms={utms} onChange={setUtm} />
        {readyState ? (
          <ResultSection
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
      <BuildSidebar
        boardUrl={boardUrl}
        file={file}
        canGenerate={canGenerate}
        isBuilding={isBuilding}
        maxRowsLabel={maxRowsLabel}
        onGenerate={handleGenerate}
      />
    );
  }

  return (
    <WorkspaceShell sidebar={sidebar}>
      <div className="sr-only" aria-live="polite">
        {liveMessage}
      </div>
      <Hero
        eyebrow="Customer-facing utility"
        title={heroTitle}
        description={heroDescription}
      />
      {mainContent}
    </WorkspaceShell>
  );
}
