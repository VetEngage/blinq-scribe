import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Requirement 61: letters from the clinic. From the record's Documents tab: create a referral, let
// Blinq draft it (the demo mock), record the owner's consent, sign and send (demo: the email that
// would go out), then a second letter handed to the owner as a texted link, and a draft deleted.

async function noA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
    `axe on ${where}`,
  ).toEqual([]);
}

async function openDocuments(page: Page) {
  await page.goto("/");
  // A visit not started yet opens on Before the visit; its Record tab has the pet's Documents.
  await page
    .locator(".appt")
    .filter({ hasNotText: /In visit|Draft ready|Signed|didn.t send|save failed/ })
    .first()
    .click();
  await page.getByRole("tablist", { name: "This visit" }).getByRole("tab", { name: "Record" }).click();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByText("Sent from the clinic")).toBeVisible();
}

async function startReferral(page: Page, reason: string) {
  await page.getByRole("button", { name: "Referral to a specialist" }).click();
  await expect(page.getByRole("heading", { name: "Create a letter" })).toBeVisible();
  await page.getByLabel("Specialist").fill("Dr. Priya Shah");
  await page.getByLabel("Clinic or practice").fill("Lakeside Veterinary Dermatology");
  await page.getByLabel("Their email").fill("referrals@lakesidederm.example");
  await page.getByLabel("Reason for referral, in your words").fill(reason);
  await page.getByRole("button", { name: "Draft with Blinq" }).click();
  await expect(page.getByRole("article", { name: "The letter" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Demo draft")).toBeVisible();
}

test("a referral: draft with Blinq, consent, sign and send by email", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await openDocuments(page);
  await noA11yViolations(page, "documents");
  await startReferral(page, "Second ear infection this year. Please assess for an underlying allergy.");
  await noA11yViolations(page, "create a letter");

  // Records go to another clinic only once the owner's consent is recorded.
  const send = page.getByRole("button", { name: "Sign and send" });
  await expect(send).toBeDisabled();
  await page.getByRole("checkbox", { name: /agreed to share these records/ }).click();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText("Demo mode: the email that would go out")).toBeVisible();
  await expect(page.getByText("referrals@lakesidederm.example").last()).toBeVisible();
  await expect(page.getByText(/A signed letter can't be changed/)).toBeVisible();
  await noA11yViolations(page, "letter sent");

  // Back on Documents, it's listed as sent, with where it went.
  await page
    .getByRole("button", { name: /^Back to/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Documents" }).click();
  const row = page.locator(".rec-row", { hasText: "Referral to Lakeside Veterinary Dermatology" }).first();
  await expect(row.getByText("Sent", { exact: true })).toBeVisible();
  await expect(row.getByText(/emailed|lakesidederm/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("given to the owner as a texted link; a draft can be finished or deleted", async ({ page }) => {
  await openDocuments(page);
  await startReferral(page, "Ultrasound for the left kidney.");
  await page.getByRole("radio", { name: /Give it to/ }).click();
  await page.getByRole("checkbox", { name: /agreed to share these records/ }).click();
  await page.getByRole("button", { name: "Sign and send" }).click();
  await expect(page.getByText(/Demo mode: the text .* would get/)).toBeVisible();

  // A draft saved and left, then finished from Documents and deleted.
  await page
    .getByRole("button", { name: /^Back to/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Documents" }).click();
  await page.getByRole("button", { name: "Letter for the owner" }).click();
  await page.getByLabel("What the letter is for, in your words").fill("Proof of rabies vaccination for boarding.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  await page
    .getByRole("button", { name: /^Back to/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Documents" }).click();
  const draft = page.locator(".rec-row", { hasText: "Proof of rabies vaccination" }).first();
  await draft.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByLabel("What the letter is for, in your words")).toHaveValue(
    "Proof of rabies vaccination for boarding.",
  );
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.locator(".rec-row", { hasText: "Proof of rabies vaccination" })).toHaveCount(0);
});
