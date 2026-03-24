import { describe, it, expect } from "vitest";
import { normalizeHeader, parseContactsCsv, serializeOutputCsv, MAX_ROWS } from "../lib/csv-parser";

// ── normalizeHeader ──────────────────────────────────────────────────────────

describe("normalizeHeader", () => {
  it("maps exact canonical names", () => {
    expect(normalizeHeader("email")).toBe("email");
    expect(normalizeHeader("first_name")).toBe("first_name");
    expect(normalizeHeader("company")).toBe("company");
  });

  it("handles Salesforce-style headers (Title Case with spaces)", () => {
    expect(normalizeHeader("First Name")).toBe("first_name");
    expect(normalizeHeader("Last Name")).toBe("last_name");
    expect(normalizeHeader("Email")).toBe("email");
    expect(normalizeHeader("Company")).toBe("company");
    expect(normalizeHeader("Title")).toBe("title");
  });

  it("handles HubSpot-style headers (lowercase no separator)", () => {
    expect(normalizeHeader("firstname")).toBe("first_name");
    expect(normalizeHeader("lastname")).toBe("last_name");
    expect(normalizeHeader("jobtitle")).toBe("title");
  });

  it("handles Apollo-style headers", () => {
    expect(normalizeHeader("organization_name")).toBe("company");
    expect(normalizeHeader("first_name")).toBe("first_name");
  });

  it("handles LinkedIn-style 'Email Address'", () => {
    expect(normalizeHeader("Email Address")).toBe("email");
    expect(normalizeHeader("Position")).toBe("title");
  });

  it("returns null for unrecognized headers", () => {
    expect(normalizeHeader("phone")).toBeNull();
    expect(normalizeHeader("id")).toBeNull();
    expect(normalizeHeader("")).toBeNull();
  });
});

// ── parseContactsCsv ─────────────────────────────────────────────────────────

// Helper to create a File from a CSV string
function makeFile(content: string, name = "contacts.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("parseContactsCsv", () => {
  it("rejects non-CSV files", async () => {
    const file = makeFile("hello world", "data.xlsx");
    const result = await parseContactsCsv(file);
    expect(result).toMatchObject({ type: "file_type" });
  });

  it("rejects empty CSV", async () => {
    const result = await parseContactsCsv(makeFile("email,first_name\n"));
    expect(result).toMatchObject({ type: "empty" });
  });

  it("rejects CSV with no recognizable email column", async () => {
    const result = await parseContactsCsv(makeFile("phone,name\n555-1234,Jane\n"));
    expect(result).toMatchObject({ type: "missing_column" });
  });

  it("parses standard template CSV", async () => {
    const csv = `email,first_name,last_name,company,title,sender_email
jane@acme.com,Jane,Doe,Acme Inc,VP Marketing,rep@co.com
john@corp.io,John,Smith,Corp,Director,rep@co.com`;
    const result = await parseContactsCsv(makeFile(csv));
    expect(result).not.toHaveProperty("type");
    if ("rows" in result) {
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].email).toBe("jane@acme.com");
      expect(result.rows[0].company).toBe("Acme Inc");
      expect(result.skippedCount).toBe(0);
    }
  });

  it("parses Salesforce-style headers (Title Case)", async () => {
    const csv = `First Name,Last Name,Email,Company,Title
Jane,Doe,jane@acme.com,Acme Inc,VP Marketing`;
    const result = await parseContactsCsv(makeFile(csv));
    if ("rows" in result) {
      expect(result.rows[0].email).toBe("jane@acme.com");
      expect(result.rows[0].first_name).toBe("Jane");
      expect(result.rows[0].company).toBe("Acme Inc");
    }
  });

  it("parses HubSpot-style headers", async () => {
    const csv = `email,firstname,lastname,company,jobtitle
jane@acme.com,Jane,Doe,Acme Inc,VP Marketing`;
    const result = await parseContactsCsv(makeFile(csv));
    if ("rows" in result) {
      expect(result.rows[0].first_name).toBe("Jane");
      expect(result.rows[0].title).toBe("VP Marketing");
    }
  });

  it("skips rows with blank email and counts them", async () => {
    const csv = `email,first_name
jane@acme.com,Jane
,John
sara@corp.io,Sara`;
    const result = await parseContactsCsv(makeFile(csv));
    if ("rows" in result) {
      expect(result.rows).toHaveLength(2);
      expect(result.skippedCount).toBe(1);
    }
  });

  it("returns error when all rows are skipped (no valid emails)", async () => {
    const csv = `email,first_name
,Jane
,John`;
    const result = await parseContactsCsv(makeFile(csv));
    expect(result).toHaveProperty("type");
  });

  it("truncates at MAX_ROWS and sets truncated flag", async () => {
    const rows = Array.from({ length: MAX_ROWS + 10 }, (_, i) => `user${i}@test.com,User`);
    const csv = "email,first_name\n" + rows.join("\n");
    const result = await parseContactsCsv(makeFile(csv));
    if ("rows" in result) {
      expect(result.truncated).toBe(true);
      expect(result.rows.length).toBeLessThanOrEqual(MAX_ROWS);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("treats sender_email as optional — no error if column missing", async () => {
    const csv = `email,first_name\njane@acme.com,Jane`;
    const result = await parseContactsCsv(makeFile(csv));
    if ("rows" in result) {
      expect(result.rows[0].sender_email).toBeUndefined();
    }
  });
});

// ── serializeOutputCsv ───────────────────────────────────────────────────────

describe("serializeOutputCsv", () => {
  it("appends folloze_link column", () => {
    const rows = [{ email: "jane@acme.com", company: "Acme Inc" }];
    const links = ["https://engage.folloze.com/board?em=jane%40acme.com&co=Acme+Inc"];
    const csv = serializeOutputCsv(rows, links);
    expect(csv).toContain("folloze_link");
    expect(csv).toContain("jane@acme.com");
    expect(csv).toContain("https://engage.folloze.com");
  });

  it("outputs empty string for null links", () => {
    const rows = [{ email: "" }];
    const links = [null];
    const csv = serializeOutputCsv(rows, links);
    expect(csv).toContain("folloze_link");
  });
});
