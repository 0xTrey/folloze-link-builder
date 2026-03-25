import { expect, test } from "@playwright/test";

function csvFile(name: string, contents: string) {
  return {
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(contents, "utf8"),
  };
}

const validCsv = `email,first_name,last_name,company,title,sender_email
jane@acme.com,Jane,Doe,Acme,VP Marketing,rep@folloze.com
john@orbit.io,John,Smith,Orbit,Director,rep@folloze.com`;

test("renders the default wizard workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Link Builder" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Upload contacts and generate Folloze-ready links",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Choose the board destination" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate links" })).toBeDisabled();
  await expect(page).toHaveScreenshot("home-desktop.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});

test("auto-detects mapping, shows review preview, and exports links", async ({ page }) => {
  await page.route("**/api/sessions", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "session-123" }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Board URL").fill("https://engage.folloze.com/spring-launch/");
  await page.locator('input[type="file"]').setInputFiles(csvFile("contacts.csv", validCsv));

  await expect(
    page.getByRole("heading", { level: 3, name: "Review identity mapping" })
  ).toBeVisible();
  await expect(page.getByText("What Folloze will receive")).toBeVisible();
  await expect(page.getByText("em=jane@acme.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate links" })).toBeEnabled();

  await page.getByRole("button", { name: "Generate links" }).click();

  await expect(page.getByRole("button", { name: "Generating links..." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Links generated" })).toBeVisible();
  await expect(page.getByText("2 links ready to export")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy share URL" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "jane@acme.com" })).toBeVisible();
});

test("manual remap recovers a non-standard email header", async ({ page }) => {
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "session-remap" }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Board URL").fill("https://engage.folloze.com/manual-remap");
  await page
    .locator('input[type="file"]')
    .setInputFiles(csvFile("needs-remap.csv", "contact_mail,company\njane@acme.com,Acme"));

  await expect(page.getByText("Map an email column before generating links.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate links" })).toBeDisabled();

  await page.getByLabel("Map Email column").selectOption("contact_mail");

  await expect(page.getByRole("button", { name: "Generate links" })).toBeEnabled();
  await page.getByRole("button", { name: "Generate links" }).click();

  await expect(page.getByRole("heading", { level: 3, name: "Links generated" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "jane@acme.com" })).toBeVisible();
});

test("blocks invalid board URLs with step-scoped feedback", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("Board URL")
    .fill("https://engage.folloze.com/test-board?existing=query");
  await page.locator('input[type="file"]').setInputFiles(csvFile("contacts.csv", validCsv));

  await expect(
    page.locator('[role="alert"]').filter({ hasText: "clean board URL without query parameters" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate links" })).toBeDisabled();
});

test("restores a saved session into the export state", async ({ page }) => {
  await page.route("**/api/sessions/session-123", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "session-123",
        createdAt: "2026-03-24T12:00:00.000Z",
        expiresAt: "2099-03-24T18:00:00.000Z",
        rowCount: 12,
        csvData: "email,company,folloze_link\njane@acme.com,Acme,https://engage.folloze.com/example",
        config: {
          boardUrl: "https://engage.folloze.com/example",
          utmSource: "email",
          utmMedium: "email",
          utmCampaign: "",
          utmContent: "",
        },
      }),
    });
  });

  await page.goto("/?s=session-123");

  await expect(page.getByRole("heading", { level: 2, name: "Saved export ready" })).toBeVisible();
  await expect(page.locator("section").getByRole("heading", { name: "Saved batch ready" })).toBeVisible();
  await expect(page.getByText("12 links ready to export")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" }).first()).toBeVisible();
});

test("shows the expired session state", async ({ page }) => {
  await page.route("**/api/sessions/session-expired", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Session not found or expired" }),
    });
  });

  await page.goto("/?s=session-expired");

  await expect(page.getByRole("heading", { level: 2, name: "Saved batch expired" })).toBeVisible();
  await expect(
    page.getByText("Saved batches are only retained for 24 hours.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a new batch" }).first()).toBeVisible();
});

test("shows a truncation warning for oversized uploads", async ({ page }) => {
  const rows = Array.from({ length: 5010 }, (_, index) => `user${index}@example.com,User${index}`).join("\n");
  const oversizedCsv = `email,first_name\n${rows}`;

  await page.goto("/");
  await page.getByLabel("Board URL").fill("https://engage.folloze.com/oversized-run");
  await page.locator('input[type="file"]').setInputFiles(csvFile("oversized.csv", oversizedCsv));

  await expect(
    page.locator('[role="alert"]').filter({ hasText: "Only the first 5,000 will be processed." })
  ).toBeVisible();
});

test("renders the mobile wizard layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Upload contacts and generate Folloze-ready links",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Choose the board destination" })
  ).toBeVisible();
  await expect(page).toHaveScreenshot("home-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});
