"use client";

import type { RefObject } from "react";
import type { SessionRecord } from "@/lib/db";
import type { UtmConfig } from "@/lib/url-builder";

export interface PreviewRow {
  email: string;
  company: string;
  link: string;
}

export interface Notice {
  tone: "error" | "warning";
  message: string;
}

interface ShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

interface HeroProps {
  eyebrow: string;
  title: string;
  description: string;
}

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

interface UploadSectionProps {
  file: File | null;
  dragOver: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  notice: Notice | null;
  maxRowsLabel: string;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onOpenPicker: () => void;
  onFileInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface TrackingSectionProps {
  utms: UtmConfig;
  onChange: (key: keyof UtmConfig, value: string) => void;
}

interface BuildSidebarProps {
  boardUrl: string;
  file: File | null;
  canGenerate: boolean;
  isBuilding: boolean;
  maxRowsLabel: string;
  onGenerate: () => void;
}

interface ReadySidebarProps {
  rowCount: number;
  skippedCount: number;
  shareUrl: string | null;
  sessionSaved: boolean;
  onDownload: () => void;
  onStartOver: () => void;
  onCopyShareUrl: () => void;
  copiedShareUrl: boolean;
}

interface SessionSidebarProps {
  session: SessionRecord;
  shareUrl: string | null;
  onDownload: () => void;
  onStartOver: () => void;
  onCopyShareUrl: () => void;
  copiedShareUrl: boolean;
  expiresInLabel: string;
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ResultSectionProps {
  rowCount: number;
  skippedCount: number;
  previewRows: PreviewRow[];
  shareUrl: string | null;
  sessionSaved: boolean;
  onDownload: () => void;
  onCopyShareUrl: () => void;
  copiedShareUrl: boolean;
}

const OPTIONAL_COLUMNS = ["first_name", "last_name", "company", "title", "sender_email"];

export function WorkspaceShell({ children, sidebar }: ShellProps) {
  return (
    <div className="min-h-screen">
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 rounded-[28px] border border-white/70 bg-white/80 px-5 py-4 shadow-panel backdrop-blur sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/folloze-logo.svg"
                alt="Folloze"
                className="h-7 w-auto sm:h-8"
              />
              <div className="h-8 w-px bg-folloze-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-folloze-ink">
                  Workspace
                </p>
                <h1 className="text-lg font-semibold tracking-tight text-folloze-navy sm:text-xl">
                  Link Builder
                </h1>
              </div>
            </div>
            <div className="rounded-full border border-folloze-border bg-folloze-mist px-3 py-1.5 text-xs font-medium text-folloze-ink">
              Customer MVP for advanced operators
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_22rem] lg:items-start">
          <div className="space-y-6">{children}</div>
          <aside className="lg:sticky lg:top-8">
            <div className="space-y-4">{sidebar}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function Hero({ eyebrow, title, description }: HeroProps) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,248,255,0.85))] px-6 py-7 shadow-panel backdrop-blur sm:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-folloze-blue">
            {eyebrow}
          </p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-folloze-navy sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-folloze-ink sm:text-[15px]">
            {description}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/80 bg-white/80 p-3 text-left shadow-[0_16px_48px_-36px_rgba(8,28,58,0.4)] backdrop-blur">
          <Metric label="Batch size" value="5,000 rows" />
          <Metric label="Session" value="24h" />
          <Metric label="Output" value="CSV" />
        </dl>
      </div>
    </section>
  );
}

export function BoardUrlSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Section
      title="Board destination"
      description="Use the Folloze board every generated contact link should open."
    >
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-folloze-ink">
          Board URL
        </span>
        <input
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://engage.folloze.com/your-board"
          className="w-full rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm text-folloze-navy shadow-sm outline-none transition focus:border-folloze-blue focus:ring-4 focus:ring-sky-100"
        />
      </label>
      <p className="mt-3 text-sm text-folloze-ink">
        The builder appends contact fields and UTM parameters to this destination.
      </p>
    </Section>
  );
}

export function UploadSection({
  file,
  dragOver,
  fileInputRef,
  notice,
  maxRowsLabel,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpenPicker,
  onFileInput,
}: UploadSectionProps) {
  const fileSize =
    file && file.size > 0 ? `${Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB` : null;

  return (
    <Section
      title="Contacts CSV"
      description="Drop a CSV export from your CRM or engagement tool. The app normalizes the common field names automatically."
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={onFileInput}
      />
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenPicker();
          }
        }}
        onClick={onOpenPicker}
        className={[
          "group rounded-[28px] border border-dashed px-6 py-8 transition duration-200 focus:outline-none focus:ring-4 focus:ring-sky-100",
          dragOver
            ? "border-folloze-blue bg-[linear-gradient(180deg,rgba(0,119,255,0.08),rgba(94,91,255,0.07))] shadow-glow"
            : file
              ? "border-emerald-300 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(240,253,250,0.9))]"
              : "border-folloze-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,250,255,0.95))] hover:border-folloze-blue hover:bg-[linear-gradient(180deg,rgba(250,253,255,1),rgba(240,247,255,0.98))]",
        ].join(" ")}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-folloze-blue shadow-sm">
            <UploadIcon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold tracking-tight text-folloze-navy">
              {file ? file.name : "Drop a contacts CSV here"}
            </p>
            <p className="text-sm text-folloze-ink">
              {file
                ? [file.type || "CSV upload", fileSize].filter(Boolean).join(" • ")
                : "Click to browse or drag a file into the workspace."}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-folloze-blue">
              Max {maxRowsLabel}
            </p>
          </div>
        </div>
      </div>

      {notice ? <NoticeBanner notice={notice} className="mt-4" /> : null}
    </Section>
  );
}

export function TrackingSection({ utms, onChange }: TrackingSectionProps) {
  return (
    <Section
      title="Tracking"
      description="Applied to every generated link. Leave optional values blank when you do not need them."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["utm_source", "Source", "email"],
          ["utm_medium", "Medium", "email"],
          ["utm_campaign", "Campaign", "q2-abm-launch"],
          ["utm_content", "Content", "step1"],
        ] as [keyof UtmConfig, string, string][]).map(([key, label, placeholder]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-folloze-ink">
              {label}
            </span>
            <input
              type="text"
              value={utms[key]}
              onChange={(event) => onChange(key, event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm text-folloze-navy shadow-sm outline-none transition focus:border-folloze-blue focus:ring-4 focus:ring-sky-100"
            />
          </label>
        ))}
      </div>
    </Section>
  );
}

export function BuildSidebar({
  boardUrl,
  file,
  canGenerate,
  isBuilding,
  maxRowsLabel,
  onGenerate,
}: BuildSidebarProps) {
  return (
    <>
      <SidebarCard>
        <div className="rounded-[24px] bg-[linear-gradient(135deg,#081c3a,#0f3261_55%,#165bff)] p-5 text-white shadow-glow">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
            Ready check
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Build tracked links without leaving this page.
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            <ChecklistItem
              ready={boardUrl.trim().length > 0}
              label={boardUrl.trim().length > 0 ? "Board destination added" : "Add the board destination"}
            />
            <ChecklistItem
              ready={Boolean(file)}
              label={file ? `CSV loaded: ${file.name}` : "Load a contacts CSV"}
            />
          </div>
          <button
            onClick={onGenerate}
            disabled={!canGenerate || isBuilding}
            className={[
              "mt-6 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
              canGenerate && !isBuilding
                ? "bg-white text-folloze-navy hover:bg-sky-50"
                : "cursor-not-allowed bg-white/20 text-white/70",
            ].join(" ")}
          >
            {isBuilding ? "Generating links..." : "Generate links"}
          </button>
        </div>
      </SidebarCard>

      <SidebarCard>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-folloze-blue">
              Batch notes
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-folloze-navy">
              What the builder expects
            </h3>
          </div>
          <div className="rounded-2xl border border-folloze-border bg-folloze-mist px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
              Required field
            </p>
            <code className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-folloze-navy shadow-sm">
              email
            </code>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
              Optional fields
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTIONAL_COLUMNS.map((column) => (
                <code
                  key={column}
                  className="rounded-full border border-folloze-border bg-white px-3 py-1 text-xs font-medium text-folloze-ink"
                >
                  {column}
                </code>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-folloze-border bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-folloze-navy">Template CSV</p>
              <p className="text-xs text-folloze-ink">Use the provided headers if you need a clean starting point.</p>
            </div>
            <a
              href="/template.csv"
              download
              className="rounded-full bg-folloze-sky px-3 py-1.5 text-xs font-semibold text-folloze-blue transition hover:bg-sky-100"
            >
              Download
            </a>
          </div>
          <div className="rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm text-folloze-ink">
            Saved sessions stay downloadable for 24 hours. Max batch size: {maxRowsLabel}.
          </div>
        </div>
      </SidebarCard>
    </>
  );
}

export function ReadySidebar({
  rowCount,
  skippedCount,
  shareUrl,
  sessionSaved,
  onDownload,
  onStartOver,
  onCopyShareUrl,
  copiedShareUrl,
}: ReadySidebarProps) {
  return (
    <SidebarCard>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-folloze-blue">
            Batch ready
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-folloze-navy">
            {rowCount.toLocaleString()} links generated
          </h3>
          <p className="mt-2 text-sm leading-6 text-folloze-ink">
            {sessionSaved
              ? "The session URL is shareable for 24 hours."
              : "Download now. Session save failed, so only the CSV download is guaranteed."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Generated" value={rowCount.toLocaleString()} />
          <StatCard label="Skipped" value={skippedCount.toLocaleString()} />
        </div>

        <button
          onClick={onDownload}
          className="flex w-full items-center justify-center rounded-2xl bg-folloze-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-folloze-cobalt"
        >
          Download CSV
        </button>

        {shareUrl ? (
          <button
            onClick={onCopyShareUrl}
            className="flex w-full items-center justify-center rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm font-semibold text-folloze-navy transition hover:border-folloze-blue hover:text-folloze-blue"
          >
            {copiedShareUrl ? "Copied share URL" : "Copy share URL"}
          </button>
        ) : null}

        <button
          onClick={onStartOver}
          className="flex w-full items-center justify-center rounded-2xl border border-transparent bg-folloze-mist px-4 py-3 text-sm font-semibold text-folloze-navy transition hover:bg-sky-100"
        >
          Start a new batch
        </button>
      </div>
    </SidebarCard>
  );
}

export function SessionSidebar({
  session,
  shareUrl,
  onDownload,
  onStartOver,
  onCopyShareUrl,
  copiedShareUrl,
  expiresInLabel,
}: SessionSidebarProps) {
  return (
    <SidebarCard>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-folloze-blue">
            Saved batch
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-folloze-navy">
            {session.rowCount.toLocaleString()} links ready to download
          </h3>
          <p className="mt-2 text-sm leading-6 text-folloze-ink">
            This saved batch expires in {expiresInLabel}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Rows" value={session.rowCount.toLocaleString()} />
          <StatCard label="Retention" value="24h" />
        </div>

        <button
          onClick={onDownload}
          className="flex w-full items-center justify-center rounded-2xl bg-folloze-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-folloze-cobalt"
        >
          Download CSV
        </button>

        {shareUrl ? (
          <button
            onClick={onCopyShareUrl}
            className="flex w-full items-center justify-center rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm font-semibold text-folloze-navy transition hover:border-folloze-blue hover:text-folloze-blue"
          >
            {copiedShareUrl ? "Copied share URL" : "Copy share URL"}
          </button>
        ) : null}

        <button
          onClick={onStartOver}
          className="flex w-full items-center justify-center rounded-2xl border border-transparent bg-folloze-mist px-4 py-3 text-sm font-semibold text-folloze-navy transition hover:bg-sky-100"
        >
          Start a new batch
        </button>
      </div>
    </SidebarCard>
  );
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Section title={title} description={description}>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="rounded-2xl bg-folloze-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-folloze-cobalt"
        >
          {actionLabel}
        </button>
      ) : null}
    </Section>
  );
}

export function ResultSection({
  rowCount,
  skippedCount,
  previewRows,
  shareUrl,
  sessionSaved,
  onDownload,
  onCopyShareUrl,
  copiedShareUrl,
}: ResultSectionProps) {
  return (
    <Section
      title="Batch preview"
      description={`Showing the first ${Math.min(10, previewRows.length)} generated rows.`}
    >
      <div className="flex flex-col gap-3 rounded-[24px] border border-folloze-border bg-folloze-mist p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-folloze-navy">
            {rowCount.toLocaleString()} links built
          </p>
          <p className="mt-1 text-sm text-folloze-ink">
            {skippedCount > 0
              ? `${skippedCount.toLocaleString()} rows without email were skipped.`
              : "Every parsed row produced a link."}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-folloze-ink">
            {sessionSaved ? "Saved and shareable for 24 hours" : "Session save unavailable for this run"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onDownload}
            className="rounded-full bg-folloze-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-folloze-cobalt"
          >
            Download CSV
          </button>
          {shareUrl ? (
            <button
              onClick={onCopyShareUrl}
              className="rounded-full border border-folloze-border bg-white px-4 py-2 text-sm font-semibold text-folloze-navy transition hover:border-folloze-blue hover:text-folloze-blue"
            >
              {copiedShareUrl ? "Copied" : "Copy share URL"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-folloze-border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead className="bg-folloze-mist text-xs uppercase tracking-[0.18em] text-folloze-ink">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Link</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr
                  key={`${row.email}-${index}`}
                  className="border-t border-folloze-border/70 text-folloze-navy"
                >
                  <td className="px-4 py-3 font-medium">{row.email}</td>
                  <td className="px-4 py-3 text-folloze-ink">{row.company || "-"}</td>
                  <td className="px-4 py-3">
                    <a
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-[26rem] truncate font-mono text-xs text-folloze-blue hover:text-folloze-cobalt hover:underline"
                      title={row.link}
                    >
                      {row.link}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

export function NoticeBanner({
  notice,
  className,
}: {
  notice: Notice;
  className?: string;
}) {
  const toneClass =
    notice.tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div
      role="alert"
      className={["rounded-2xl border px-4 py-3 text-sm leading-6", toneClass, className].filter(Boolean).join(" ")}
    >
      {notice.message}
    </div>
  );
}

function Section({ title, description, children }: SectionProps) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 px-6 py-6 shadow-panel backdrop-blur sm:px-7">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-folloze-blue">
          Workspace
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-folloze-navy">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-folloze-ink">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SidebarCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-panel backdrop-blur sm:p-5">
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[5rem] rounded-2xl border border-folloze-border bg-white/90 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-folloze-ink">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-folloze-navy">{value}</dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-folloze-border bg-folloze-mist px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">{label}</p>
      <p className="mt-2 text-lg font-semibold text-folloze-navy">{value}</p>
    </div>
  );
}

function ChecklistItem({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2">
      <span
        className={[
          "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
          ready ? "border-emerald-200 bg-emerald-400/20 text-emerald-50" : "border-white/20 bg-white/5 text-white/70",
        ].join(" ")}
      >
        {ready ? "OK" : "..."}
      </span>
      <span className="text-sm text-white/90">{label}</span>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11A2.5 2.5 0 0 0 20 17.5v-2" />
    </svg>
  );
}
