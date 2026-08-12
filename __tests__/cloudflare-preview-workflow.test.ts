import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/cloudflare-preview.yml"), "utf8");

describe("Cloudflare preview workflow", () => {
  it("is manually dispatched and gated by the locked local toolchain", () => {
    expect(workflow).toMatch(/^on:\n  workflow_dispatch:/m);
    expect(workflow).not.toMatch(/^  (pull_request|push|schedule):/m);
    expect(workflow).toContain("contents: read");
    for (const command of ["npm ci", "npm audit --omit=dev --audit-level=high", "npm test", "npm run build", "npm run check:cloudflare"]) {
      expect(workflow).toContain(`- run: ${command}`);
    }
  });

  it("deploys only the preview Worker and exposes no database credential", () => {
    expect(workflow).toContain("npm exec -- wrangler deploy --name folloze-link-builder-preview");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}");
    expect(workflow).not.toContain("DATABASE_URL");
  });
});
