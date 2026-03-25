/**
 * CSV Parser — Folloze Link Builder
 *
 * Supports a two-phase import flow:
 *   1. inspectContactsCsv(file) to detect headers + infer mapping
 *   2. parseContactsCsv(file, mapping) to normalize rows after review
 *
 * Canonical field → ContactRow mapping:
 *   email        → em  (required)
 *   first_name   → fn
 *   last_name    → ln
 *   company      → co
 *   title        → ro
 *   sender_email → inby (optional — omitted if blank)
 */

import Papa from "papaparse";
import type { ContactRow } from "./url-builder";

export const MAX_ROWS = 5000;
export const CSV_PREVIEW_COUNT = 3;

export const COLUMN_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "company",
  "title",
  "sender_email",
] as const;

export const OPTIONAL_COLUMN_FIELDS = COLUMN_FIELDS.filter(
  (field) => field !== "email"
) as Exclude<ColumnField, "email">[];

export type ColumnField = (typeof COLUMN_FIELDS)[number];
export type ColumnMapping = Record<ColumnField, string | null>;
export type CsvSourceRow = Record<string, string>;
export type MappingConfidence = "high" | "review" | "manual" | "missing";

// Maps canonical field name → list of accepted header aliases (all lowercase)
const COLUMN_ALIASES: Record<ColumnField, string[]> = {
  email: [
    "email",
    "email address",
    "work email",
    "e-mail",
    "e mail",
    "contact email",
    "business email",
  ],
  first_name: [
    "first_name",
    "first name",
    "firstname",
    "given name",
    "given_name",
    "first",
    "fname",
  ],
  last_name: [
    "last_name",
    "last name",
    "lastname",
    "surname",
    "family name",
    "family_name",
    "last",
    "lname",
  ],
  company: [
    "company",
    "company name",
    "company_name",
    "organization",
    "organization_name",
    "organisation",
    "account name",
    "account_name",
    "account",
  ],
  title: [
    "title",
    "job title",
    "job_title",
    "jobtitle",
    "position",
    "role",
    "job role",
    "job_role",
  ],
  sender_email: [
    "sender_email",
    "sender email",
    "from email",
    "from_email",
    "rep email",
    "rep_email",
    "sender",
    "from",
    "assigned to",
    "assigned_to",
    "owner email",
    "owner_email",
  ],
};

export interface ParseResult {
  rows: ContactRow[];
  skippedCount: number;
  truncated: boolean;
  totalParsed: number;
  warnings: string[];
}

export interface ParseError {
  type: "file_type" | "empty" | "missing_column" | "parse_error";
  message: string;
}

export interface MappingFieldStatus {
  field: ColumnField;
  header: string | null;
  required: boolean;
  confidence: MappingConfidence;
  matchedHeaders: string[];
}

export interface CsvInspectionResult {
  headers: string[];
  rows: CsvSourceRow[];
  sampleRows: CsvSourceRow[];
  totalParsed: number;
  truncated: boolean;
  warnings: string[];
  ignoredHeaders: string[];
  inferredMapping: ColumnMapping;
  matchedHeaders: Record<ColumnField, string[]>;
}

export interface MappingReviewSummary {
  rows: ContactRow[];
  previewRows: ContactRow[];
  validRowCount: number;
  skippedCount: number;
  blockingIssues: string[];
  nonBlockingIssues: string[];
  fieldStatuses: Record<ColumnField, MappingFieldStatus>;
}

export function createEmptyColumnMapping(): ColumnMapping {
  return {
    email: null,
    first_name: null,
    last_name: null,
    company: null,
    title: null,
    sender_email: null,
  };
}

/** Normalize a raw header string to a canonical field name, or null if unrecognized. */
export function normalizeHeader(raw: string): ColumnField | null {
  const lower = raw.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES) as Array<
    [ColumnField, string[]]
  >) {
    if (aliases.includes(lower)) return canonical;
  }
  return null;
}

export async function inspectContactsCsv(
  file: File
): Promise<CsvInspectionResult | ParseError> {
  const parsed = await readCsvFile(file);
  if ("type" in parsed) return parsed;

  const matchedHeaders = createEmptyMatchRecord();
  const ignoredHeaders: string[] = [];

  for (const header of parsed.headers) {
    const canonical = normalizeHeader(header);
    if (canonical) {
      matchedHeaders[canonical].push(header);
    } else {
      ignoredHeaders.push(header);
    }
  }

  const inferredMapping = createEmptyColumnMapping();
  for (const field of COLUMN_FIELDS) {
    inferredMapping[field] = matchedHeaders[field][0] ?? null;
  }

  return {
    headers: parsed.headers,
    rows: parsed.rows,
    sampleRows: parsed.rows.slice(0, CSV_PREVIEW_COUNT),
    totalParsed: parsed.totalParsed,
    truncated: parsed.truncated,
    warnings: parsed.warnings,
    ignoredHeaders,
    inferredMapping,
    matchedHeaders,
  };
}

/** Parse a File object using the confirmed column mapping. */
export async function parseContactsCsv(
  file: File,
  mapping: ColumnMapping
): Promise<ParseResult | ParseError> {
  const inspection = await inspectContactsCsv(file);
  if ("type" in inspection) return inspection;

  if (!mapping.email) {
    return {
      type: "missing_column",
      message: "Map an email column before generating links.",
    };
  }

  const summary = summarizeInspection(inspection, mapping);

  if (summary.rows.length === 0) {
    return {
      type: "missing_column",
      message: "No valid rows found — every row is either missing an email or was skipped.",
    };
  }

  return {
    rows: summary.rows,
    skippedCount: summary.skippedCount,
    truncated: inspection.truncated,
    totalParsed: inspection.totalParsed,
    warnings: inspection.warnings,
  };
}

export function summarizeInspection(
  inspection: CsvInspectionResult,
  mapping: ColumnMapping
): MappingReviewSummary {
  const mapped = mapSourceRowsToContacts(inspection.rows, mapping);
  const fieldStatuses = buildMappingFieldStatuses(inspection, mapping);
  const blockingIssues: string[] = [];
  const nonBlockingIssues = [...inspection.warnings];

  if (!mapping.email) {
    blockingIssues.push("Map an email column before generating links.");
  } else if (mapped.rows.length === 0) {
    blockingIssues.push("No rows contain a usable email in the selected email column.");
  }

  if (mapped.skippedCount > 0) {
    const rowLabel = mapped.skippedCount === 1 ? "row is" : "rows are";
    nonBlockingIssues.push(
      `${mapped.skippedCount.toLocaleString()} ${rowLabel} missing email in the selected column and will be skipped.`
    );
  }

  if (inspection.ignoredHeaders.length > 0) {
    nonBlockingIssues.push(
      `${inspection.ignoredHeaders.length.toLocaleString()} source column${inspection.ignoredHeaders.length === 1 ? "" : "s"} will be ignored.`
    );
  }

  const missingOptional = OPTIONAL_COLUMN_FIELDS.filter((field) => !mapping[field]);
  if (missingOptional.length > 0) {
    nonBlockingIssues.push(
      `These identity fields will stay blank unless you map them: ${missingOptional.join(", ")}.`
    );
  }

  return {
    rows: mapped.rows,
    previewRows: mapped.rows.slice(0, CSV_PREVIEW_COUNT),
    validRowCount: mapped.rows.length,
    skippedCount: mapped.skippedCount,
    blockingIssues,
    nonBlockingIssues,
    fieldStatuses,
  };
}

/** Serialize output rows to a CSV string with a folloze_link column appended. */
export function serializeOutputCsv(
  inputs: ContactRow[],
  links: Array<string | null>
): string {
  const outputRows = inputs.map((row, index) => ({
    email: row.email,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    company: row.company ?? "",
    title: row.title ?? "",
    sender_email: row.sender_email ?? "",
    folloze_link: links[index] ?? "",
  }));

  return Papa.unparse(outputRows);
}

function buildMappingFieldStatuses(
  inspection: CsvInspectionResult,
  mapping: ColumnMapping
): Record<ColumnField, MappingFieldStatus> {
  const statuses = {} as Record<ColumnField, MappingFieldStatus>;

  for (const field of COLUMN_FIELDS) {
    const matchedHeaders = inspection.matchedHeaders[field];
    const inferredHeader = inspection.inferredMapping[field];
    const currentHeader = mapping[field];

    let confidence: MappingConfidence;
    if (!currentHeader) {
      confidence = "missing";
    } else if (currentHeader !== inferredHeader) {
      confidence = "manual";
    } else if (matchedHeaders.length > 1) {
      confidence = "review";
    } else {
      confidence = "high";
    }

    statuses[field] = {
      field,
      header: currentHeader,
      required: field === "email",
      confidence,
      matchedHeaders,
    };
  }

  return statuses;
}

function mapSourceRowsToContacts(
  rows: CsvSourceRow[],
  mapping: ColumnMapping
): { rows: ContactRow[]; skippedCount: number } {
  let skippedCount = 0;
  const contacts: ContactRow[] = [];

  for (const row of rows) {
    const email = readMappedValue(row, mapping.email);

    if (!email) {
      skippedCount += 1;
      continue;
    }

    contacts.push({
      email,
      first_name: readOptionalMappedValue(row, mapping.first_name),
      last_name: readOptionalMappedValue(row, mapping.last_name),
      company: readOptionalMappedValue(row, mapping.company),
      title: readOptionalMappedValue(row, mapping.title),
      sender_email: readOptionalMappedValue(row, mapping.sender_email),
    });
  }

  return { rows: contacts, skippedCount };
}

function readMappedValue(row: CsvSourceRow, header: string | null): string {
  if (!header) return "";
  return row[header]?.trim() ?? "";
}

function readOptionalMappedValue(
  row: CsvSourceRow,
  header: string | null
): string | undefined {
  const value = readMappedValue(row, header);
  return value || undefined;
}

function createEmptyMatchRecord(): Record<ColumnField, string[]> {
  return {
    email: [],
    first_name: [],
    last_name: [],
    company: [],
    title: [],
    sender_email: [],
  };
}

async function readCsvFile(
  file: File
): Promise<
  | ParseError
  | {
      headers: string[];
      rows: CsvSourceRow[];
      totalParsed: number;
      truncated: boolean;
      warnings: string[];
    }
> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { type: "file_type", message: "Please upload a .csv file." };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return {
      type: "parse_error",
      message: "Could not read the file. Make sure it is a valid CSV.",
    };
  }

  if (parsed.data.length === 0) {
    return { type: "empty", message: "The CSV has no rows." };
  }

  const headers = (parsed.meta.fields ?? Object.keys(parsed.data[0] ?? {})).map(
    (header) => header.trim()
  );

  if (headers.length === 0) {
    return { type: "empty", message: "The CSV has no rows." };
  }

  const warnings: string[] = [];
  const totalParsed = parsed.data.length;
  const truncated = totalParsed > MAX_ROWS;
  const source = truncated ? parsed.data.slice(0, MAX_ROWS) : parsed.data;

  if (truncated) {
    warnings.push(
      `Your CSV has ${totalParsed.toLocaleString()} rows. Only the first ${MAX_ROWS.toLocaleString()} will be processed.`
    );
  }

  const rows = source.map((rawRow) => normalizeSourceRow(headers, rawRow));

  return {
    headers,
    rows,
    totalParsed,
    truncated,
    warnings,
  };
}

function normalizeSourceRow(
  headers: string[],
  rawRow: Record<string, string | undefined>
): CsvSourceRow {
  const normalized: CsvSourceRow = {};

  for (const header of headers) {
    normalized[header] = rawRow[header]?.trim() ?? "";
  }

  return normalized;
}
