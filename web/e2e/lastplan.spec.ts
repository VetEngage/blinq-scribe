import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Today's demo, step 5: the last plan's checkboxes feed the draft (a line the visit didn't cover comes
// back as a reminder, quoted), the compact rail, and Home between visits on a standard day (the clock
// pinned, so the moment never depends on when the tests run).

async function noA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `axe on ${where}`).toEqual([]);
}

async function signIn(page: Page, clock: string) {
  await page.addInitScript((c) => localStorage.setItem("blinq_clock", c), clock);
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo clinic" }).click();
  await expect(page.getByRole("button", { name: /Dr\. Ana Rivera's day/ })).toBeVisible();
  return page.getByRole("region", { name: "Your day" });
}

// What the room said: no plan line's words, so the line ticked is one the visit didn't cover.
const SAID = [
  "Owner: She has been doing well at home this week and is eating fine.",
  "Dr. Rivera: Temp is 101.5, heart rate 100.",
  "Dr. Rivera: Lungs sound clear and the abdomen is soft.",
].join("\n");
const words = (x: string) => new Set(x.toLowerCase().match(/[a-z]{4,}/g) ?? []);

test("ticked lines from the last plan go to the draft, and one the visit didn't cover is a reminder", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-1440", "one visit, started once, by the desktop run");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const rail = await signIn(page, "08:00");
  // A visit not started yet whose last plan is on record (which pets depends on the weekday).
  const appts = (await (await page.request.get("/api/schedule?provider_id=prov-1")).json()) as {
    id: string;
    visit_status: string;
    patient: { name: string };
  }[];
  let pick: { pet: string; line: string } | null = null;
  // The day's last ones first: the demo flow takes the first ones, at each width.
  for (const a of appts.filter((x) => x.visit_status === "not_started").reverse()) {
    const card = (await (await page.request.get(`/api/appointments/${a.id}/card`)).json()) as {
      walk_in?: { kind: string; items: { text: string }[] }[];
    };
    const plan = card.walk_in?.find((e) => e.kind === "plan");
    const said = words(SAID);
    const line = plan?.items.map((i) => i.text).find((t) => ![...words(t)].some((w) => said.has(w)));
    if (line) {
      pick = { pet: a.patient.name, line };
      break;
    }
  }
  test.skip(!pick, "no visit left with a last plan on record");
  const { pet, line } = pick!;
  await rail.getByRole("button", { name: new RegExp(pet) }).click();

  // Before you walk in: tick a line of the last plan; it is kept with the visit, on the server.
  const walkIn = page.getByRole("list", { name: "Before you walk in, newest first" });
  const box = walkIn.getByRole("checkbox", { name: `${line}, from the plan` });
  await box.click();
  await expect(box).toBeChecked();
  await expect(page.getByText("What you would like to cover today.")).toBeVisible();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(walkIn.getByRole("checkbox", { name: `${line}, from the plan` })).toBeChecked();
  await noA11yViolations(page, "before you walk in, a line ticked");

  // Start, write what the room said (nothing about that line) and draft.
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Enter");
  const progress = page.getByRole("region", { name: "Visit in progress" });
  await expect(progress).toBeVisible();
  await page.getByRole("textbox", { name: "Transcript" }).fill(SAID);
  await page.getByRole("button", { name: "Save text" }).click();
  await expect(page.getByRole("list", { name: "Transcript" }).getByRole("listitem").first()).toBeVisible();
  await progress.getByRole("button", { name: "Draft note" }).click();
  await expect(page.getByRole("heading", { name: "Draft note" })).toBeVisible({ timeout: 30_000 });

  // In purple at the Plan, in the provider's own words; Blinq added nothing about it to the note.
  const item = page.locator("#sec-plan [data-plan-reminder]");
  await expect(item).toHaveText(`From your last plan, not covered: ${line}Add to PlanDismiss`);
  await expect(page.locator("#sec-plan .ai-lines")).not.toContainText(line);
  // It counts like a thing to confirm (the green action gets to it once those are done), never a block.
  const bar = page.getByRole("region", { name: "Sign the note" });
  await expect(bar.getByRole("button", { name: /^(Fill in|Confirm|Check 1 line from your last plan)/ })).toBeEnabled();
  await noA11yViolations(page, "draft, a line from the last plan not covered");
  await item.getByRole("button", { name: `Add to Plan: ${line}` }).click();
  await expect(page.locator("#sec-plan [data-plan-reminder]")).toHaveCount(0);
  await expect(page.locator("#sec-plan .ai-lines")).toContainText(line);
  // Saved with the note: a reload keeps the line in the Plan and the reminder gone.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator("#sec-plan .ai-lines")).toContainText(line);
  await expect(page.locator("#sec-plan [data-plan-reminder]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("today's rail: two lines a visit, a caution's amber line, and a read only quick card", async ({ page }, info) => {
  const rail = await signIn(page, "08:00");
  // A standard day folds nothing: Miso is on the line, seen or not, in clock order.
  const miso = rail.getByRole("button", { name: /Miso/ });
  // Line 1 is who: the name with species and age; the breed under it; then the reason.
  await expect(miso).toContainText("Cat, 14 years");
  await expect(miso).toContainText("Domestic Shorthair");
  await expect(miso).toContainText("Kidney recheck");
  // The caution: its own amber line with the dot, in full, heard as "Caution: Fractious, use towel wrap".
  const caution = miso.locator("[data-caution]");
  await expect(caution).toContainText(/towel wrap/i);
  await expect(caution).toHaveCSS("color", "rgb(143, 95, 0)");
  await expect(caution.locator(".bg-caution").first()).toBeVisible();
  await expect(miso).toHaveAccessibleName(/Caution: [^.]*towel wrap/i);
  // Not started is the default: no row says it.
  await expect(rail.getByText("Not started")).toHaveCount(0);
  // Two lines, about 72 to 96 px.
  const plain = rail.locator(".appt").filter({ hasNotText: "Caution" }).first();
  const height = (await plain.boundingBox())!.height;
  expect(height).toBeGreaterThanOrEqual(64);
  expect(height).toBeLessThanOrEqual(104);
  await expect(rail.getByRole("separator", { name: /^Now, 8:00\sAM$/ })).toBeVisible();
  // Before the first visit, the Now line is at the top of the line; the long break before 1:30 PM is free.
  await expect(rail.getByRole("listitem").first().getByRole("separator")).toHaveText(/^Now 8:00\sAM$/);
  await expect(rail.getByText(/^Free until 1:30\sPM$/)).toBeVisible();

  const card = page.getByRole("tooltip");
  if (info.project.name !== "desktop-1440") {
    // Stacked under the page, on touch: no card, and a tap opens the visit.
    await miso.tap();
    await expect(page.getByRole("heading", { level: 1, name: "Miso" })).toBeVisible();
    await expect(card).toHaveCount(0);
    return;
  }
  // Hover, after about 300 ms: the quick card to the right of the row, the row's description.
  await miso.hover();
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.x).toBeGreaterThanOrEqual((await miso.boundingBox())!.width);
  await expect(miso).toHaveAttribute("aria-describedby", (await card.getAttribute("id"))!);
  await expect(card).toContainText("Cat · Domestic Shorthair · Female, spayed · 14 years · 8.9 lb");
  await expect(card).toContainText(/Owner\s*Priya Shah · \(\d{3}\) \d{3}-\d{4}/);
  await expect(card).toContainText("Last visit");
  await expect(card).toContainText("From PIMS");
  await expect(card).toContainText(/Synced \d{1,2}:\d{2}\s[AP]M/);
  await expect(card).toContainText("Gabapentin 100 mg given at home 2 hours before visits");
  await expect(card).toContainText("Fractious, use towel wrap");
  await expect(card).toContainText("Read only");
  // Read only: one link, no buttons, nothing to edit.
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("link")).toHaveCount(1);
  // It stays open while the pointer is over the card; Esc closes it.
  await card.hover({ position: { x: 40, y: 24 } });
  await page.waitForTimeout(400);
  await expect(card).toBeVisible();
  await noA11yViolations(page, "the rail's quick card");
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  // Moving away closes it too.
  await miso.hover();
  await expect(card).toBeVisible();
  await page.mouse.move(20, 20, { steps: 6 });
  await expect(card).toHaveCount(0);
  // Keyboard focus opens it at once; Open visit opens the visit.
  await miso.focus();
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Open visit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Miso" })).toBeVisible();
  await expect(page).toHaveURL(/\/visit\/appt-2/);
  await expect(card).toHaveCount(0);
});

test("between visits on a standard day: the day line, quick ones for the gap, one green action", async ({ page }) => {
  const rail = await signIn(page, "09:45");
  // Nobody in the room at 9:45 AM and a visit still to come.
  await expect(page.getByText(/Free until \d{1,2}:\d{2}\s(AM|PM)\./)).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Visits seen today" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Quick ones for the gap" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Follow-ups waiting" })).toHaveCount(0);
  await expect(rail.locator("[data-status=visit]")).toHaveCount(0);
  const bar = page.getByRole("region", { name: "Next step" });
  await expect(bar.getByRole("button", { name: /^Open \w+'s? visit/ })).toBeVisible();
  await noA11yViolations(page, "home, between visits on a standard day");
});
