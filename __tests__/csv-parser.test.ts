import { describe, expect, it } from "vitest";
import {
  MAX_ROWS,
  createEmptyColumnMapping,
  inspectContactsCsv,
  normalizeHeader,
  parseContactsCsv,
  serializeOutputCsv,
  summarizeInspection,
} from "../lib/csv-parser";

function makeFile(content: string, name = "contacts.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("normalizeHeader", () => {
  it("maps exact canonical names", () => {
    expect(normalizeHeader("email")).toBe("email");
    expect(normalizeHeader("first_name")).toBe("first_name");
    expect(normalizeHeader("company")).toBe("company");
  });

  it("handles Salesforce-style headers", () => {
    expect(normalizeHeader("First Name")).toBe("first_name");
    expect(normalizeHeader("Last Name")).toBe("last_name");
    expect(normalizeHeader("Email")).toBe("email");
    expect(normalizeHeader("Company")).toBe("company");
    expect(normalizeHeader("Title")).toBe("title");
  });

  it("handles HubSpot- and LinkedIn-style headers", () => {
    expect(normalizeHeader("firstname")).toBe("first_name");
    expect(normalizeHeader("jobtitle")).toBe("title");
    expect(normalizeHeader("Email Address")).toBe("email");
    expect(normalizeHeader("Position")).toBe("title");
  });

  it("returns null for unknown headers", () => {
    expect(normalizeHeader("phone")).toBeNull();
    expect(normalizeHeader("")).toBeNull();
  });
});

describe("inspectContactsCsv", () => {
  it("rejects non-CSV files", async () => {
    const result = await inspectContactsCsv(makeFile("hello", "contacts.xlsx"));
    expect(result).toMatchObject({ type: "file_type" });
  });

  it("rejects empty CSV files", async () => {
    const result = await inspectContactsCsv(makeFile("email,first_name\n"));
    expect(result).toMatchObject({ type: "empty" });
  });

  it("infers mappings from common CRM headers", async () => {
    const csv = `Email Address,First Name,Last Name,Company,Position
jane@acme.com,Jane,Doe,Acme Inc,VP Marketing`;

    const result = await inspectContactsCsv(makeFile(csv));
    expect(result).not.toHaveProperty("type");

    if ("headers" in result) {
      expect(result.inferredMapping.email).toBe("Email Address");
      expect(result.inferredMapping.first_name).toBe("First Name");
      expect(result.inferredMapping.title).toBe("Position");
      expect(result.ignoredHeaders).toEqual([]);
    }
  });

  it("allows inspection even when no email alias is recognized", async () => {
    const csv = `contact_mail,name,company
jane@acme.com,Jane Doe,Acme`;

    const result = await inspectContactsCsv(makeFile(csv));
    expect(result).not.toHaveProperty("type");

    if ("headers" in result) {
      expect(result.inferredMapping.email).toBeNull();
      expect(result.ignoredHeaders).toContain("contact_mail");
    }
  });

  it("truncates oversized uploads during inspection", async () => {
    const rows = Array.from({ length: MAX_ROWS + 5 }, (_, index) => `user${index}@example.com,User${index}`);
    const csv = `email,first_name\n${rows.join("\n")}`;

    const result = await inspectContactsCsv(makeFile(csv));
    expect(result).not.toHaveProperty("type");

    if ("headers" in result) {
      expect(result.truncated).toBe(true);
      expect(result.rows).toHaveLength(MAX_ROWS);
      expect(result.warnings[0]).toContain("Only the first 5,000 will be processed.");
    }
  });
});

describe("summarizeInspection", () => {
  it("surfaces blocking issues when email is unmapped", async () => {
    const inspection = await inspectContactsCsv(
      makeFile(`contact_mail,first_name\njane@acme.com,Jane`)
    );

    if ("type" in inspection) {
      throw new Error("Expected inspection to succeed");
    }

    const summary = summarizeInspection(inspection, createEmptyColumnMapping());
    expect(summary.blockingIssues).toContain("Map an email column before generating links.");
  });

  it("allows manual mapping overrides for non-standard email headers", async () => {
    const inspection = await inspectContactsCsv(
      makeFile(`contact_mail,first_name\njane@acme.com,Jane`)
    );

    if ("type" in inspection) {
      throw new Error("Expected inspection to succeed");
    }

    const summary = summarizeInspection(inspection, {
      ...createEmptyColumnMapping(),
      email: "contact_mail",
      first_name: "first_name",
    });

    expect(summary.validRowCount).toBe(1);
    expect(summary.previewRows[0].email).toBe("jane@acme.com");
    expect(summary.fieldStatuses.email.confidence).toBe("manual");
  });

  it("counts rows skipped by the selected email column", async () => {
    const inspection = await inspectContactsCsv(
      makeFile(`email,first_name\njane@acme.com,Jane\n,John`)
    );

    if ("type" in inspection) {
      throw new Error("Expected inspection to succeed");
    }

    const summary = summarizeInspection(inspection, inspection.inferredMapping);
    expect(summary.validRowCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.nonBlockingIssues.join(" ")).toContain("will be skipped");
  });
});

describe("parseContactsCsv", () => {
  it("rejects unmapped email columns", async () => {
    const result = await parseContactsCsv(
      makeFile(`contact_mail,first_name\njane@acme.com,Jane`),
      createEmptyColumnMapping()
    );

    expect(result).toMatchObject({ type: "missing_column" });
  });

  it("parses rows using the confirmed mapping", async () => {
    const result = await parseContactsCsv(
      makeFile(`contact_mail,first_name\njane@acme.com,Jane`),
      {
        ...createEmptyColumnMapping(),
        email: "contact_mail",
        first_name: "first_name",
      }
    );

    expect(result).not.toHaveProperty("type");
    if ("rows" in result) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe("jane@acme.com");
      expect(result.rows[0].first_name).toBe("Jane");
    }
  });
});

describe("serializeOutputCsv", () => {
  it("appends folloze_link column", () => {
    const rows = [{ email: "jane@acme.com", company: "Acme Inc" }];
    const links = ["https://engage.folloze.com/board?em=jane%40acme.com&co=Acme+Inc"];
    const csv = serializeOutputCsv(rows, links);
    expect(csv).toContain("folloze_link");
    expect(csv).toContain("jane@acme.com");
    expect(csv).toContain("https://engage.folloze.com");
  });

  it("outputs empty strings for null links", () => {
    const rows = [{ email: "" }];
    const links = [null];
    const csv = serializeOutputCsv(rows, links);
    expect(csv).toContain("folloze_link");
  });
});
