import { describe, it, expect } from "vitest";
import { buildFollozeUrl, buildLinksForRows } from "../lib/url-builder";
import type { UtmConfig } from "../lib/url-builder";

const BASE_URL = "https://engage.folloze.com/b2b-agents-awareness";

const UTM: UtmConfig = {
  utm_source:   "smartlead",
  utm_medium:   "email",
  utm_campaign: "ENT_REVMKTG_INTENT",
  utm_content:  "step1",
};

describe("buildFollozeUrl", () => {
  it("produces raw & separators, not &amp;", () => {
    const url = buildFollozeUrl(BASE_URL, { email: "jane@acme.com", company: "Acme" }, UTM);
    expect(url).not.toContain("&amp;");
    expect(url).toContain("&");
  });

  it("omits empty params", () => {
    const url = buildFollozeUrl(BASE_URL, { email: "jane@acme.com" }, UTM);
    expect(url).not.toContain("fn=");
    expect(url).not.toContain("ln=");
    expect(url).not.toContain("co=");
    expect(url).not.toContain("ro=");
    expect(url).not.toContain("inby=");
  });

  it("omits inby when sender_email is blank", () => {
    const url = buildFollozeUrl(BASE_URL, { email: "jane@acme.com", sender_email: "" }, UTM);
    expect(url).not.toContain("inby=");
  });

  it("includes inby when sender_email is set", () => {
    const url = buildFollozeUrl(BASE_URL, { email: "jane@acme.com", sender_email: "rep@folloze.com" }, UTM);
    expect(url).toContain("inby=rep%40folloze.com");
  });

  it("encodes special chars in company name (e.g. 'Acme & Co')", () => {
    const url = buildFollozeUrl(BASE_URL, { email: "jane@acme.com", company: "Acme & Co" }, UTM);
    expect(url).toContain("co=Acme+%26+Co");
  });

  it("strips trailing slash from board URL", () => {
    const url = buildFollozeUrl(BASE_URL + "/", { email: "jane@acme.com" }, UTM);
    // Trailing slash removed — path should not end with /? (double slash before query)
    expect(url).not.toContain("/?");
    expect(url.startsWith(BASE_URL + "?")).toBe(true);
  });

  it("matches reference output from Python assign_push for a known contact", () => {
    // Reference case from assign_push.py production use
    const url = buildFollozeUrl(BASE_URL, {
      email:        "jane@acme.com",
      first_name:   "Jane",
      last_name:    "Doe",
      company:      "Acme Inc",
      title:        "VP Marketing",
      sender_email: "trey.harnden@folloze.com",
    }, UTM);
    expect(url).toContain("em=jane%40acme.com");
    expect(url).toContain("fn=Jane");
    expect(url).toContain("ln=Doe");
    expect(url).toContain("co=Acme+Inc");
    expect(url).toContain("ro=VP+Marketing");
    expect(url).toContain("inby=trey.harnden%40folloze.com");
    expect(url).toContain("utm_campaign=ENT_REVMKTG_INTENT");
  });
});

describe("buildLinksForRows", () => {
  it("returns null link for rows missing email", () => {
    const results = buildLinksForRows(BASE_URL, [{ email: "" }, { email: "a@b.com" }], UTM);
    expect(results[0].link).toBeNull();
    expect(results[1].link).not.toBeNull();
  });

  it("processes all rows", () => {
    const contacts = Array.from({ length: 100 }, (_, i) => ({ email: `user${i}@test.com` }));
    const results = buildLinksForRows(BASE_URL, contacts, UTM);
    expect(results).toHaveLength(100);
    expect(results.every((r) => r.link !== null)).toBe(true);
  });
});
