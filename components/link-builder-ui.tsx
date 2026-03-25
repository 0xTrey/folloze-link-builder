"use client";

import type {
  ChangeEvent,
  DragEvent,
  ReactNode,
  RefObject,
} from "react";
import type { SessionRecord } from "@/lib/db";
import type {
  ColumnField,
  ColumnMapping,
  MappingFieldStatus,
} from "@/lib/csv-parser";
import type { UtmConfig } from "@/lib/url-builder";

export interface PreviewRow {
  email: string;
  company: string;
  link: string;
}

export interface IdentityPreview {
  email: string;
  headline: string;
  company: string;
  payload: Array<{ key: string; value: string }>;
  link: string | null;
}

export interface Notice {
  tone: "error" | "warning";
  message: string;
}

export interface WizardStepStatus {
  label: string;
  description: string;
  state: "complete" | "current" | "pending";
}

interface ShellProps {
  children: ReactNode;
  sidebar: ReactNode;
}

interface HeroProps {
  eyebrow: string;
  title: string;
  description: string;
}

interface SectionProps {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}

interface BoardUrlSectionProps {
  value: string;
  normalizedUrl: string | null;
  notice: Notice | null;
  recentBoards: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onUseRecent: (value: string) => void;
}

interface ImportStepSectionProps {
  file: File | null;
  dragOver: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  notice: Notice | null;
  statusLine: string;
  maxRowsLabel: string;
  disabled?: boolean;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onOpenPicker: () => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface ReviewStepSectionProps {
  headers: string[];
  mapping: ColumnMapping;
  fieldStatuses: Record<ColumnField, MappingFieldStatus>;
  validRowCount: number;
  skippedCount: number;
  blockingIssues: string[];
  nonBlockingIssues: string[];
  identityPreviews: IdentityPreview[];
  disabled?: boolean;
  onChangeMapping: (field: ColumnField, value: string | null) => void;
}

interface TrackingSectionProps {
  utms: UtmConfig;
  disabled?: boolean;
  onChange: (key: keyof UtmConfig, value: string) => void;
}

interface WizardSidebarProps {
  steps: WizardStepStatus[];
  canGenerate: boolean;
  isBuilding: boolean;
  maxRowsLabel: string;
  onGenerate: () => void;
}

interface ResultSectionProps {
  title: string;
  description: string;
  rowCount: number;
  skippedCount: number | null;
  previewRows: PreviewRow[];
  shareUrl: string | null;
  sessionSaved: boolean;
  onDownload: () => void;
  onCopyShareUrl: () => void;
  copiedShareUrl: boolean;
}

interface ResultSidebarProps {
  title: string;
  description: string;
  rowCount: number;
  skippedCount: number | null;
  shareUrl: string | null;
  sessionSaved: boolean;
  expiresInLabel?: string;
  onDownload: () => void;
  onStartOver: () => void;
  onCopyShareUrl: () => void;
  copiedShareUrl: boolean;
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const FIELD_META: Array<{
  field: ColumnField;
  label: string;
  param: string;
  required?: boolean;
}> = [
  { field: "email", label: "Email", param: "em", required: true },
  { field: "first_name", label: "First name", param: "fn" },
  { field: "last_name", label: "Last name", param: "ln" },
  { field: "company", label: "Company", param: "co" },
  { field: "title", label: "Title", param: "ro" },
  { field: "sender_email", label: "Sender email", param: "inby" },
];

const OPTIONAL_COLUMNS = FIELD_META.filter((item) => !item.required).map(
  (item) => item.field
);

export function WorkspaceShell({ children, sidebar }: ShellProps) {
  return (
    <div className="min-h-screen">
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 rounded-[28px] border border-white/70 bg-white/80 px-5 py-4 shadow-panel backdrop-blur sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img src="/folloze-logo.svg" alt="Folloze" className="h-7 w-auto sm:h-8" />
              <div className="h-8 w-px bg-folloze-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-folloze-ink">
                  Launch wizard
                </p>
                <h1 className="text-lg font-semibold tracking-tight text-folloze-navy sm:text-xl">
                  Link Builder
                </h1>
              </div>
            </div>
            <div className="rounded-full border border-folloze-border bg-folloze-mist px-3 py-1.5 text-xs font-medium text-folloze-ink">
              Upload contacts, review identity, export with confidence
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_22rem] lg:items-start">
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
    <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(244,248,255,0.9))] px-6 py-7 shadow-panel backdrop-blur sm:px-8">
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
          <Metric label="Flow" value="4 steps" />
          <Metric label="Session" value="24h" />
          <Metric label="Output" value="CSV" />
        </dl>
      </div>
    </section>
  );
}

export function BoardUrlSection({
  value,
  normalizedUrl,
  notice,
  recentBoards,
  disabled = false,
  onChange,
  onUseRecent,
}: BoardUrlSectionProps) {
  return (
    <Section
      step="Step 1"
      title="Choose the board destination"
      description="Paste the Folloze board every generated contact link should open."
    >
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-folloze-ink">
          Board URL
        </span>
        <input
          aria-label="Board URL"
          type="url"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://engage.folloze.com/your-board"
          className="w-full rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm text-folloze-navy shadow-sm outline-none transition focus:border-folloze-blue focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-folloze-ink"
        />
      </label>

      {normalizedUrl ? (
        <div className="mt-4 rounded-2xl border border-folloze-border bg-folloze-mist px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
            Normalized destination
          </p>
          <p className="mt-2 break-all font-mono text-xs text-folloze-navy">
            {normalizedUrl}
          </p>
        </div>
      ) : null}

      {notice ? <NoticeBanner notice={notice} className="mt-4" /> : null}

      {recentBoards.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
            Recent boards
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentBoards.map((board) => (
              <button
                key={board}
                type="button"
                disabled={disabled}
                onClick={() => onUseRecent(board)}
                className="rounded-full border border-folloze-border bg-white px-3 py-1.5 text-xs font-medium text-folloze-navy transition hover:border-folloze-blue hover:text-folloze-blue disabled:cursor-not-allowed disabled:opacity-60"
              >
                {truncateMiddle(board)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

export function ImportStepSection({
  file,
  dragOver,
  fileInputRef,
  notice,
  statusLine,
  maxRowsLabel,
  disabled = false,
  onDrop,
  onDragOver,
  onDragLeave,
  onOpenPicker,
  onFileInput,
}: ImportStepSectionProps) {
  const fileSize =
    file && file.size > 0
      ? `${Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB`
      : null;

  return (
    <Section
      step="Step 2"
      title="Import the contact list"
      description="Upload a CSV export from your CRM or engagement tool. The wizard will inspect headers right away."
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        disabled={disabled}
        onChange={onFileInput}
      />
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onDrop={(event) => {
          if (disabled) return;
          onDrop(event);
        }}
        onDragOver={(event) => {
          if (disabled) return;
          onDragOver(event);
        }}
        onDragLeave={() => {
          if (disabled) return;
          onDragLeave();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenPicker();
          }
        }}
        onClick={() => {
          if (disabled) return;
          onOpenPicker();
        }}
        className={[
          "group rounded-[28px] border border-dashed px-6 py-8 transition duration-200 focus:outline-none focus:ring-4 focus:ring-sky-100",
          disabled ? "cursor-not-allowed opacity-70" : "",
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

      <div className="mt-4 rounded-2xl border border-folloze-border bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
          Import status
        </p>
        <p className="mt-2 text-sm text-folloze-navy">{statusLine}</p>
      </div>

      {notice ? <NoticeBanner notice={notice} className="mt-4" /> : null}
    </Section>
  );
}

export function ReviewStepSection({
  headers,
  mapping,
  fieldStatuses,
  validRowCount,
  skippedCount,
  blockingIssues,
  nonBlockingIssues,
  identityPreviews,
  disabled = false,
  onChangeMapping,
}: ReviewStepSectionProps) {
  return (
    <Section
      step="Step 3"
      title="Review identity mapping"
      description="Confirm which columns will be sent to Folloze and inspect sample contacts before export."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ready rows" value={validRowCount.toLocaleString()} />
        <StatCard label="Skipped rows" value={skippedCount.toLocaleString()} />
        <StatCard label="Detected columns" value={headers.length.toLocaleString()} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <div className="rounded-[24px] border border-folloze-border bg-folloze-mist p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
                  Column mapping
                </p>
                <p className="mt-1 text-sm text-folloze-ink">
                  Auto-detected columns are preselected. Override them when the import needs help.
                </p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-folloze-navy shadow-sm">
                {headers.length} source headers
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {FIELD_META.map((item) => (
                <div
                  key={item.field}
                  className="rounded-2xl border border-white/80 bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-folloze-navy">{item.label}</p>
                        <code className="rounded-full bg-folloze-mist px-2 py-0.5 text-[11px] font-semibold text-folloze-ink">
                          {item.param}
                        </code>
                        {item.required ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            Required
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-folloze-ink">
                        {fieldStatuses[item.field].header
                          ? `Using ${fieldStatuses[item.field].header}`
                          : "No source column selected"}
                      </p>
                    </div>
                    <ConfidenceBadge status={fieldStatuses[item.field].confidence} />
                  </div>

                  <label className="mt-3 block">
                    <span className="sr-only">{`Map ${item.label} column`}</span>
                    <select
                      aria-label={`Map ${item.label} column`}
                      disabled={disabled}
                      value={mapping[item.field] ?? ""}
                      onChange={(event) =>
                        onChangeMapping(
                          item.field,
                          event.target.value ? event.target.value : null
                        )
                      }
                      className="w-full rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm text-folloze-navy shadow-sm outline-none transition focus:border-folloze-blue focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-folloze-ink"
                    >
                      <option value="">
                        {item.required ? "Select a source column" : "Do not send this field"}
                      </option>
                      {headers.map((header) => (
                        <option key={`${item.field}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <IssueListCard
              title="Blocking issues"
              tone="error"
              emptyMessage="No blocking issues. Export is available once the board URL is valid."
              items={blockingIssues}
            />
            <IssueListCard
              title="Review notes"
              tone="warning"
              emptyMessage="No extra review notes for this import."
              items={nonBlockingIssues}
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-folloze-border bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
              Sample identity preview
            </p>
            <h4 className="mt-2 text-lg font-semibold tracking-tight text-folloze-navy">
              What Folloze will receive
            </h4>
            <p className="mt-2 text-sm leading-6 text-folloze-ink">
              Review three sample contacts, including the final link preview and every identity parameter that will be appended.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {identityPreviews.length > 0 ? (
              identityPreviews.map((preview, index) => (
                <div
                  key={`${preview.email}-${index}`}
                  className="rounded-2xl border border-folloze-border bg-folloze-mist p-4"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-folloze-navy">{preview.headline}</p>
                    <p className="text-xs text-folloze-ink">{preview.email}</p>
                    <p className="text-xs text-folloze-ink">
                      {preview.company ? preview.company : "No company value will be sent"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {preview.payload.map((entry) => (
                      <code
                        key={`${preview.email}-${entry.key}`}
                        className="rounded-full border border-white bg-white px-2.5 py-1 text-[11px] font-semibold text-folloze-navy"
                      >
                        {entry.key}={entry.value || "blank"}
                      </code>
                    ))}
                  </div>

                  <div className="mt-3 rounded-2xl bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-folloze-ink">
                      Final URL preview
                    </p>
                    {preview.link ? (
                      <a
                        href={preview.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block break-all font-mono text-[11px] text-folloze-blue hover:text-folloze-cobalt hover:underline"
                      >
                        {preview.link}
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-folloze-ink">
                        Add a valid board URL to preview the final link.
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-folloze-border bg-folloze-mist px-4 py-5 text-sm text-folloze-ink">
                Upload a CSV and map the required fields to see sample identity previews.
              </div>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function TrackingSection({
  utms,
  disabled = false,
  onChange,
}: TrackingSectionProps) {
  return (
    <Section
      step="Optional"
      title="Tracking settings"
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
              disabled={disabled}
              value={utms[key]}
              onChange={(event) => onChange(key, event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-2xl border border-folloze-border bg-white px-4 py-3 text-sm text-folloze-navy shadow-sm outline-none transition focus:border-folloze-blue focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-folloze-ink"
            />
          </label>
        ))}
      </div>
    </Section>
  );
}

export function WizardSidebar({
  steps,
  canGenerate,
  isBuilding,
  maxRowsLabel,
  onGenerate,
}: WizardSidebarProps) {
  return (
    <>
      <SidebarCard>
        <div className="rounded-[24px] bg-[linear-gradient(135deg,#081c3a,#0f3261_55%,#165bff)] p-5 text-white shadow-glow">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/80">
            Launch status
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Guide the batch from raw CSV to export.
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            {steps.map((step) => (
              <ChecklistItem
                key={step.label}
                state={step.state}
                label={step.label}
                detail={step.description}
              />
            ))}
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
              Import guide
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-folloze-navy">
              Supported identity fields
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
              <p className="text-xs text-folloze-ink">
                Start from the clean import template if your export needs cleanup.
              </p>
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

export function ResultSidebar({
  title,
  description,
  rowCount,
  skippedCount,
  shareUrl,
  sessionSaved,
  expiresInLabel,
  onDownload,
  onStartOver,
  onCopyShareUrl,
  copiedShareUrl,
}: ResultSidebarProps) {
  return (
    <SidebarCard>
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-folloze-blue">
            Export
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-folloze-navy">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-folloze-ink">{description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Links" value={rowCount.toLocaleString()} />
          <StatCard
            label={skippedCount === null ? "Retention" : "Skipped"}
            value={skippedCount === null ? "24h" : skippedCount.toLocaleString()}
          />
        </div>

        {expiresInLabel ? (
          <div className="rounded-2xl border border-folloze-border bg-folloze-mist px-4 py-3 text-sm text-folloze-ink">
            This saved batch expires in {expiresInLabel}.
          </div>
        ) : null}

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

        {!sessionSaved ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This export is downloadable now, but the saved session URL is not available for this run.
          </div>
        ) : null}
      </div>
    </SidebarCard>
  );
}

export function ResultSection({
  title,
  description,
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
    <Section step="Step 4" title={title} description={description}>
      <div className="flex flex-col gap-3 rounded-[24px] border border-folloze-border bg-folloze-mist p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-folloze-navy">
            {rowCount.toLocaleString()} links ready to export
          </p>
          <p className="mt-1 text-sm text-folloze-ink">
            {skippedCount === null
              ? "This saved batch is ready to download again."
              : skippedCount > 0
                ? `${skippedCount.toLocaleString()} rows were skipped because email was blank.`
                : "Every mapped row produced a link."}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-folloze-ink">
            {sessionSaved ? "Saved and shareable for 24 hours" : "Download available for this session only"}
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
                    {row.link ? (
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-[26rem] truncate font-mono text-xs text-folloze-blue hover:text-folloze-cobalt hover:underline"
                        title={row.link}
                      >
                        {row.link}
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-folloze-ink">(blank)</span>
                    )}
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

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Section step="Status" title={title} description={description}>
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

export function SessionSidebar({
  session,
  shareUrl,
  onDownload,
  onStartOver,
  onCopyShareUrl,
  copiedShareUrl,
  expiresInLabel,
}: {
  session: SessionRecord;
  shareUrl: string | null;
  onDownload: () => void;
  onStartOver: () => void;
  onCopyShareUrl: () => void;
  copiedShareUrl: boolean;
  expiresInLabel: string;
}) {
  return (
    <ResultSidebar
      title="Saved batch ready"
      description={`This saved batch contains ${session.rowCount.toLocaleString()} generated links.`}
      rowCount={session.rowCount}
      skippedCount={null}
      shareUrl={shareUrl}
      sessionSaved
      expiresInLabel={expiresInLabel}
      onDownload={onDownload}
      onStartOver={onStartOver}
      onCopyShareUrl={onCopyShareUrl}
      copiedShareUrl={copiedShareUrl}
    />
  );
}

export function ReadySidebar(props: ResultSidebarProps) {
  return <ResultSidebar {...props} />;
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
      className={["rounded-2xl border px-4 py-3 text-sm leading-6", toneClass, className]
        .filter(Boolean)
        .join(" ")}
    >
      {notice.message}
    </div>
  );
}

function Section({ step, title, description, children }: SectionProps) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/85 px-6 py-6 shadow-panel backdrop-blur sm:px-7">
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-folloze-blue">
          {step}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-folloze-navy">
          {title}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-folloze-ink">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SidebarCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-panel backdrop-blur sm:p-5">
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[5rem] rounded-2xl border border-folloze-border bg-white/90 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-folloze-ink">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-folloze-navy">{value}</dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-folloze-border bg-folloze-mist px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-folloze-ink">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-folloze-navy">{value}</p>
    </div>
  );
}

function ChecklistItem({
  state,
  label,
  detail,
}: {
  state: "complete" | "current" | "pending";
  label: string;
  detail: string;
}) {
  const statusLabel =
    state === "complete" ? "OK" : state === "current" ? "Now" : "...";

  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <div className="flex items-center gap-3">
        <span
          className={[
            "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
            state === "complete"
              ? "border-emerald-200 bg-emerald-400/20 text-emerald-50"
              : state === "current"
                ? "border-sky-100/40 bg-white/15 text-white"
                : "border-white/20 bg-white/5 text-white/70",
          ].join(" ")}
        >
          {statusLabel}
        </span>
        <span className="text-sm font-semibold text-white/95">{label}</span>
      </div>
      <p className="mt-2 pl-10 text-xs text-white/75">{detail}</p>
    </div>
  );
}

function IssueListCard({
  title,
  tone,
  emptyMessage,
  items,
}: {
  title: string;
  tone: "error" | "warning";
  emptyMessage: string;
  items: string[];
}) {
  const wrapperClass =
    tone === "error"
      ? "border-red-200 bg-red-50"
      : "border-amber-200 bg-amber-50";
  const textClass = tone === "error" ? "text-red-800" : "text-amber-800";

  return (
    <div className={["rounded-[24px] border p-4", wrapperClass, textClass].join(" ")}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-2xl bg-white/60 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6">{emptyMessage}</p>
      )}
    </div>
  );
}

function ConfidenceBadge({
  status,
}: {
  status: MappingFieldStatus["confidence"];
}) {
  const label =
    status === "high"
      ? "High"
      : status === "review"
        ? "Review"
        : status === "manual"
          ? "Manual"
          : "Missing";

  const className =
    status === "high"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "review"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "manual"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-red-200 bg-red-50 text-red-700";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function truncateMiddle(value: string, maxLength = 42) {
  if (value.length <= maxLength) return value;
  const segment = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, segment)}...${value.slice(-segment)}`;
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11A2.5 2.5 0 0 0 20 17.5v-2"
      />
    </svg>
  );
}
