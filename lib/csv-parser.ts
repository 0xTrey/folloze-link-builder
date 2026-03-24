/**
 * CSV Parser — Folloze Link Builder
 *
 * Wraps PapaParse with fuzzy header normalization so customers can upload
 * exports from any CRM without reformatting column names.
 *
 * Alias map handles the most common CRM exports:
 *   Salesforce : "First Name", "Last Name", "Company", "Title", "Email"
 *   HubSpot    : "firstname", "lastname", "company", "jobtitle", "email"
 *   Apollo     : "first_name", "last_name", "organization_name", "title", "email"
 *   LinkedIn   : "First Name", "Last Name", "Company", "Position", "Email Address"
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

// Maps canonical field name → list of accepted header aliases (all lowercase)
const COLUMN_ALIASES: Record<string, string[]> = {
  email: [
    "email", "email address", "work email", "e-mail",
    "e mail", "contact email", "business email",
  ],
  first_name: [
    "first_name", "first name", "firstname", "given name",
    "given_name", "first", "fname",
  ],
  last_name: [
    "last_name", "last name", "lastname", "surname",
    "family name", "family_name", "last", "lname",
  ],
  company: [
    "company", "company name", "company_name", "organization",
    "organization_name", "organisation", "account name",
    "account_name", "account",
  ],
  title: [
    "title", "job title", "job_title", "jobtitle", "position",
    "role", "job role", "job_role",
  ],
  sender_email: [
    "sender_email", "sender email", "from email", "from_email",
    "rep email", "rep_email", "sender", "from", "assigned to",
    "assigned_to", "owner email", "owner_email",
  ],
};

/** Normalize a raw header string to a canonical field name, or null if unrecognized. */
export function normalizeHeader(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(lower)) return canonical;
  }
  return null;
}

export interface ParseResult {
  rows: ContactRow[];
  skippedCount: number;    // rows missing email
  truncated: boolean;      // true if file exceeded MAX_ROWS
  totalParsed: number;     // rows in file before truncation
  warnings: string[];      // non-fatal issues detected
}

export interface ParseError {
  type: "file_type" | "empty" | "missing_column" | "parse_error";
  message: string;
}

/** Parse a File object. Returns ParseResult on success or ParseError on failure. */
export async function parseContactsCsv(
  file: File
): Promise<ParseResult | ParseError> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { type: "file_type", message: "Please upload a .csv file." };
  }

  const text = await file.text();

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return { type: "parse_error", message: "Could not read the file. Make sure it is a valid CSV." };
  }

  if (parsed.data.length === 0) {
    return { type: "empty", message: "The CSV has no rows." };
  }

  // Build header → canonical field mapping
  const rawHeaders = Object.keys(parsed.data[0]);
  const headerMap: Record<string, string> = {};
  for (const raw of rawHeaders) {
    const canonical = normalizeHeader(raw);
    if (canonical) headerMap[raw] = canonical;
  }

  if (!Object.values(headerMap).includes("email")) {
    const recognized = Object.keys(COLUMN_ALIASES.email).join(", ");
    return {
      type: "missing_column",
      message: `Could not find an email column. Accepted names: ${COLUMN_ALIASES.email.slice(0, 3).join(", ")}, …`,
    };
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

  let skippedCount = 0;
  const rows: ContactRow[] = [];

  for (const raw of source) {
    // Map each raw column to its canonical name
    const normalized: Record<string, string> = {};
    for (const [rawHeader, value] of Object.entries(raw)) {
      const canonical = headerMap[rawHeader];
      if (canonical) normalized[canonical] = value?.trim() ?? "";
    }

    const email = normalized.email ?? "";
    if (!email) {
      skippedCount++;
      continue;
    }

    rows.push({
      email,
      first_name:   normalized.first_name   || undefined,
      last_name:    normalized.last_name    || undefined,
      company:      normalized.company      || undefined,
      title:        normalized.title        || undefined,
      sender_email: normalized.sender_email || undefined,
    });
  }

  if (rows.length === 0) {
    return {
      type: "missing_column",
      message: "No valid rows found — every row is either missing an email or was skipped.",
    };
  }

  return { rows, skippedCount, truncated, totalParsed, warnings };
}

/** Serialize output rows to a CSV string with a folloze_link column appended. */
export function serializeOutputCsv(
  inputs: ContactRow[],
  links: Array<string | null>
): string {
  const outputRows = inputs.map((row, i) => ({
    email:        row.email,
    first_name:   row.first_name   ?? "",
    last_name:    row.last_name    ?? "",
    company:      row.company      ?? "",
    title:        row.title        ?? "",
    sender_email: row.sender_email ?? "",
    folloze_link: links[i]         ?? "",
  }));

  return Papa.unparse(outputRows);
}
