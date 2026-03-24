"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseContactsCsv, serializeOutputCsv, MAX_ROWS } from "@/lib/csv-parser";
import { buildLinksForRows } from "@/lib/url-builder";
import type { ContactRow, UtmConfig } from "@/lib/url-builder";
import type { ParseResult, ParseError } from "@/lib/csv-parser";
import type { SessionConfig, SessionRecord } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppState =
  | { stage: "idle" }
  | { stage: "session_loading" }
  | { stage: "session_restored"; session: SessionRecord }
  | { stage: "session_expired" }
  | { stage: "building" }
  | { stage: "ready"; csvOutput: string; rowCount: number; previewRows: PreviewRow[]; sessionId: string | null };

interface PreviewRow {
  email: string;
  company: string;
  link: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const UTM_DEFAULTS: UtmConfig = {
  utm_source:   "email",
  utm_medium:   "email",
  utm_campaign: "",
  utm_content:  "",
};

const PREVIEW_COUNT = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isParseError(result: ParseResult | ParseError): result is ParseError {
  return "type" in result;
}

function formatExpiry(isoString: string): string {
  const expires = new Date(isoString);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffH > 0) return `${diffH}h ${diffM}m`;
  return `${diffM}m`;
}

function triggerDownload(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const [boardUrl, setBoardUrl]         = useState("");
  const [utms, setUtms]                 = useState<UtmConfig>(UTM_DEFAULTS);
  const [file, setFile]                 = useState<File | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [parseError, setParseError]     = useState<string | null>(null);
  const [appState, setAppState]         = useState<AppState>({ stage: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Session restore on mount ────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("s");
    if (!sessionId) return;

    setAppState({ stage: "session_loading" });

    fetch(`/api/sessions/${sessionId}`)
      .then((res) => {
        if (res.status === 404) {
          setAppState({ stage: "session_expired" });
          return null;
        }
        return res.json();
      })
      .then((data: SessionRecord | null) => {
        if (!data) return;
        setAppState({ stage: "session_restored", session: data });
      })
      .catch(() => setAppState({ stage: "idle" }));
  }, []);

  // ── File handling ───────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    setFile(f);
    setParseError(null);
    if (appState.stage === "ready") setAppState({ stage: "idle" });
  }, [appState.stage]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── UTM helpers ─────────────────────────────────────────────────────────────
  const setUtm = (key: keyof UtmConfig, value: string) => {
    setUtms((prev) => ({ ...prev, [key]: value }));
  };

  // ── Generate ────────────────────────────────────────────────────────────────
  const canGenerate = boardUrl.trim() !== "" && file !== null;

  const handleGenerate = async () => {
    if (!file || !boardUrl.trim()) return;
    setParseError(null);
    setAppState({ stage: "building" });

    const parsed = await parseContactsCsv(file);

    if (isParseError(parsed)) {
      setParseError(parsed.message);
      setAppState({ stage: "idle" });
      return;
    }

    const results = buildLinksForRows(boardUrl.trim(), parsed.rows, utms);
    const links = results.map((r) => r.link);
    const csvOutput = serializeOutputCsv(parsed.rows, links);

    const previewRows: PreviewRow[] = results
      .slice(0, PREVIEW_COUNT)
      .map(({ contact, link }) => ({
        email:   contact.email,
        company: contact.company ?? "",
        link:    link ?? "(skipped — no email)",
      }));

    // Save to Neon in background — don't block download on failure
    let sessionId: string | null = null;
    try {
      const config: SessionConfig = {
        boardUrl:    boardUrl.trim(),
        utmSource:   utms.utm_source,
        utmMedium:   utms.utm_medium,
        utmCampaign: utms.utm_campaign,
        utmContent:  utms.utm_content,
      };
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowCount: parsed.rows.length, csvData: csvOutput, config }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionId = data.sessionId;
        const url = new URL(window.location.href);
        url.searchParams.set("s", sessionId!);
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      // Session save failed — not a blocker, links still work
    }

    setAppState({
      stage: "ready",
      csvOutput,
      rowCount: parsed.rows.length,
      previewRows,
      sessionId,
    });

    if (parsed.warnings.length > 0) {
      setParseError(parsed.warnings.join(" "));
    }
  };

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = (csvString: string, count: number) => {
    triggerDownload(csvString, `folloze-links-${count}-contacts.csv`);
  };

  const handleStartOver = () => {
    setAppState({ stage: "idle" });
    setFile(null);
    setParseError(null);
    setBoardUrl("");
    setUtms(UTM_DEFAULTS);
    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    window.history.replaceState(null, "", url.toString());
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Session loading state
  if (appState.stage === "session_loading") {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24 text-folloze-purple text-lg font-medium animate-pulse">
          Restoring your session…
        </div>
      </PageShell>
    );
  }

  // Session restored — show download
  if (appState.stage === "session_restored") {
    const { session } = appState;
    return (
      <PageShell>
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-8 max-w-xl mx-auto mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✅</span>
            <div>
              <h2 className="font-semibold text-folloze-navy text-lg">Your links are ready</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {session.rowCount.toLocaleString()} links · Expires in {formatExpiry(session.expiresAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => handleDownload(session.csvData, session.rowCount)}
              className="flex-1 bg-folloze-purple hover:bg-folloze-violet text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              ↓ Download CSV
            </button>
            <button
              onClick={handleStartOver}
              className="px-5 py-3 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  // Session expired
  if (appState.stage === "session_expired") {
    return (
      <PageShell>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-xl mx-auto mt-8 text-center">
          <p className="text-amber-800 font-medium">This session has expired (links are stored for 24 hours).</p>
          <button onClick={handleStartOver} className="mt-4 text-folloze-purple font-semibold hover:underline">
            Build new links →
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Step 1: Board URL ── */}
        <Card step={1} title="Board URL">
          <p className="text-sm text-gray-500 mb-3">
            Paste your Folloze board URL. Each contact link will point to this board
            with their details embedded as query parameters.
          </p>
          <input
            type="url"
            value={boardUrl}
            onChange={(e) => setBoardUrl(e.target.value)}
            placeholder="https://engage.folloze.com/your-board"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-folloze-purple text-sm font-mono"
          />
        </Card>

        {/* ── Step 2: UTM Parameters ── */}
        <Card step={2} title="UTM Parameters">
          <p className="text-sm text-gray-500 mb-4">
            These values apply to every link in the batch. Edit as needed.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["utm_source",   "Source",   "email"],
              ["utm_medium",   "Medium",   "email"],
              ["utm_campaign", "Campaign", "e.g. q2-abm-launch"],
              ["utm_content",  "Content",  "e.g. step1"],
            ] as [keyof UtmConfig, string, string][]).map(([key, label, placeholder]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={utms[key]}
                  onChange={(e) => setUtm(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-folloze-purple text-sm"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* ── Step 3: CSV Upload ── */}
        <Card step={3} title="Upload Contacts">
          <p className="text-sm text-gray-500 mb-3">
            Upload a CSV with your contacts. We recognize column names from
            Salesforce, HubSpot, Apollo, and LinkedIn exports automatically.
            Required: <code className="bg-gray-100 px-1 rounded text-xs">email</code>{" "}
            Optional:{" "}
            {["first_name", "last_name", "company", "title", "sender_email"].map((c, i) => (
              <span key={c}>
                <code className="bg-gray-100 px-1 rounded text-xs">{c}</code>
                {i < 4 ? " " : ""}
              </span>
            ))}
          </p>
          <p className="text-xs text-gray-400 mb-1">
            <strong>sender_email</strong> — your rep&apos;s email address. Folloze uses this
            to personalize the board experience for each contact. Leave it out to omit the param.
          </p>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`
              mt-3 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragOver
                ? "border-folloze-purple bg-folloze-light"
                : file
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 hover:border-folloze-muted hover:bg-folloze-light/40"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileInput}
            />
            {file ? (
              <div>
                <p className="text-green-700 font-medium text-sm">✓ {file.name}</p>
                <p className="text-xs text-gray-400 mt-1">Click to replace</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-sm font-medium">Drop your CSV here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">Max {MAX_ROWS.toLocaleString()} rows</p>
              </div>
            )}
          </div>

          {/* Template download */}
          <a
            href="/template.csv"
            download
            className="inline-block mt-3 text-xs text-folloze-purple hover:underline font-medium"
          >
            ↓ Download template CSV
          </a>
        </Card>

        {/* ── Parse / Warning ── */}
        {parseError && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            parseError.startsWith("Your CSV has")
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {parseError}
          </div>
        )}

        {/* ── Generate button ── */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || appState.stage === "building"}
          className={`
            w-full py-4 rounded-xl font-semibold text-base transition-all
            ${canGenerate && appState.stage !== "building"
              ? "bg-folloze-purple hover:bg-folloze-violet text-white shadow-md hover:shadow-lg"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }
          `}
        >
          {appState.stage === "building" ? "Generating links…" : "Generate Links →"}
        </button>

        {/* ── Output ── */}
        {appState.stage === "ready" && (
          <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-folloze-navy">
                  {appState.rowCount.toLocaleString()} links generated
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing first {Math.min(PREVIEW_COUNT, appState.previewRows.length)} rows ·{" "}
                  {appState.sessionId
                    ? "Session saved — this URL is shareable for 24h"
                    : "Session save failed — download now"}
                </p>
              </div>
              <button
                onClick={() => handleDownload(appState.csvOutput, appState.rowCount)}
                className="bg-folloze-purple hover:bg-folloze-violet text-white font-semibold py-2.5 px-5 rounded-xl text-sm transition-colors whitespace-nowrap"
              >
                ↓ Download CSV
              </button>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                    <th className="px-4 py-2.5 text-left font-medium">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium">Company</th>
                    <th className="px-4 py-2.5 text-left font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {appState.previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-700 font-medium">{row.email}</td>
                      <td className="px-4 py-2.5 text-gray-500">{row.company || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-folloze-purple">
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline truncate block max-w-xs"
                          title={row.link}
                        >
                          {row.link.length > 60 ? row.link.slice(0, 60) + "…" : row.link}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </PageShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F4FF]">
      {/* Header */}
      <header className="bg-folloze-navy border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <span className="text-white font-bold text-xl tracking-tight">folloze</span>
          <span className="text-white/30 text-xl font-light">|</span>
          <span className="text-white/80 text-sm font-medium">Link Builder</span>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-folloze-navy pb-8 pt-6">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="text-white text-2xl font-semibold">
            Build personalized board links
          </h1>
          <p className="text-white/60 text-sm mt-1.5 max-w-lg">
            Upload your contact list, configure your UTMs, and generate tracked
            Folloze board URLs ready to drop into any email sequence.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

function Card({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-folloze-purple text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <h2 className="font-semibold text-folloze-navy text-base">{title}</h2>
      </div>
      {children}
    </div>
  );
}
