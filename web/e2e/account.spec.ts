import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Account settings as an invited person: accept the invite, open Account, rename yourself and turn
// on two-step sign in (in demo mode the code goes to the server terminal, so the server allows it).

async function noA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
    `axe on ${where}`,
  ).toEqual([]);
}

test("Account: name, two-step sign in, read from the top bar", async ({ page, request }, info) => {
  const api = String(info.project.metadata.api);
  // Before anyone is invited the console is the open demo, and Account says so.
  await page.goto("/");
  await page.getByRole("button", { name: /Your account/ }).click();
  await page.getByRole("menuitem", { name: "Account" }).click();
  await expect(
    page.getByText(
      /You're in the demo clinic\. Account settings apply to invited accounts\. Sign in with your own account/,
    ),
  ).toBeVisible();
  await noA11yViolations(page, "account in the open demo");

  // Invite the first person (allowed from this machine), then accept the invite in the browser.
  const res = await request.post(`${api}/graphql`, {
    data: {
      query: `mutation($input: NewUserInput!) { invite_user(input: $input) { invite_url } }`,
      variables: { input: { username: "ana.e2e", name: "Dr. Ana Test", role: "admin", email: "ana.e2e@clinic.test" } },
    },
  });
  const body = (await res.json()) as { data?: { invite_user: { invite_url: string } }; errors?: unknown };
  expect(body.errors, JSON.stringify(body.errors)).toBeUndefined();
  const token = new URL(body.data!.invite_user.invite_url).hash.replace("#invite=", "");
  await page.goto(`/#invite=${token}`);
  await page.getByLabel("Password", { exact: true }).fill("Correct-Horse-42");
  await page.getByLabel("Type it again").fill("Correct-Horse-42");
  await page.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(page.getByRole("region", { name: "Brief" })).toBeVisible();

  // Account from the top bar.
  await page.getByRole("button", { name: /Your account/ }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue("ana.e2e");
  await noA11yViolations(page, "account");

  // Rename.
  await page.getByLabel("Name", { exact: true }).fill("Dr. Ana Q. Test");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await expect(page.getByRole("button", { name: /Dr\. Ana Q\. Test/ })).toBeVisible();

  // Two-step sign in on.
  const twoStep = page.getByRole("switch", { name: /Ask for a code when I sign in/ });
  await expect(twoStep).not.toBeChecked();
  await twoStep.click();
  await expect(page.getByText("Two-step sign in is on")).toBeVisible();
  await expect(twoStep).toBeChecked();

  // A wrong current password for a new email is refused inline.
  await page.getByLabel("Email", { exact: true }).fill("ana.new@clinic.test");
  await page.getByLabel("Current password").first().fill("not my password");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profileTitle ~ form [role=alert]")).not.toBeEmpty();
  await noA11yViolations(page, "account with an error");

  // Other devices signed out, this one stays.
  await page.getByRole("button", { name: "Sign out on all other devices" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sign out on all other devices" }).click();
  await expect(page.getByText("Signed out on your other devices")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account", level: 1 })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

// Requirement 62, after the first invite ended the open demo: the demo vet (Dr. Ana Rivera, a vet)
// looks at Dr. Okafor's day view only, then signs a note of their own as themselves.
test("roles: a vet views a colleague's visit view only and signs their own as themselves", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo clinic" }).click();
  await expect(page.getByRole("button", { name: /Dr\. Ana Rivera's day/ })).toBeVisible();

  // A colleague's day: marked View only in the picker, a banner, and their visit locked.
  await page.getByRole("button", { name: /Dr\. Ana Rivera's day/ }).click();
  await page.getByRole("menuitemradio", { name: /Dr\. Sam Okafor/ }).click();
  await expect(page.getByText("You're viewing Dr. Sam Okafor's day.")).toBeVisible();
  // Their schedule replaces mine: wait for it to land rather than clicking a row of my own day.
  await expect(page.locator(".schedule-list")).toHaveAttribute("aria-busy", "false");
  await page.locator(".appt").first().click();
  await expect(page.getByText("Dr. Sam Okafor's visit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start visit" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Start the visit" })).toHaveCount(0);
  await noA11yViolations(page, "a colleague's visit, view only");

  // Back to my day: start, write and sign as myself, with no name to type.
  await page.getByRole("button", { name: "Back to my day" }).click();
  await expect(page.getByText(/You're viewing/)).toHaveCount(0);
  await expect(page.locator(".schedule-list")).toHaveAttribute("aria-busy", "false");
  await page
    .locator(".appt")
    .filter({ hasNotText: /In visit|Draft ready|Signed|didn.t send|save failed/ })
    .first()
    .click();
  // Start visit asks one question first, in the bar; the owner's answer is saved with the visit.
  const startBar = page.getByRole("region", { name: "Start the visit" });
  await startBar.getByRole("button", { name: "Start visit" }).click();
  await page.getByRole("button", { name: "Load sample visit" }).click();
  await expect(page.getByRole("list", { name: "Transcript" })).toBeVisible();
  await page.getByRole("button", { name: "Draft note" }).first().click();
  // The mock draft is quick, but under load the server can take a while: wait for the draft itself.
  await expect(page.getByText("Drafted by Blinq")).toBeVisible({ timeout: 60_000 });
  const bar = page.getByRole("region", { name: /Sign/ });
  await expect(bar.getByText("Signing as")).toBeVisible();
  await expect(bar.getByRole("textbox")).toHaveCount(0);
  // Anything to confirm first: the one green action goes to it, Confirm takes it as it is.
  for (let i = 0; i < 6; i++) {
    const step = bar.getByRole("button", { name: /^(Fill in|Confirm) / });
    if (!(await step.count())) break;
    await step.click();
    await page.locator(".confirm-item button:focus").click();
  }
  await bar.getByRole("button", { name: /^Sign and send to/ }).click();
  await page
    .getByRole("dialog", { name: /^Sign and send to/ })
    .getByRole("button", { name: /^Sign and send to/ })
    .click();
  await expect(page.getByText(/^Signed by/)).toBeVisible();
});
