import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// The demo's heavy day (two days after today: 20 visits, 24 pets, read at 1:15 PM) and the Lee household
// visit on it: three pets, one recording for the room, one note per pet.

async function noA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `axe on ${where}`).toEqual([]);
}

/** Press the stepping green action until it names `want` (each press scrolls the note on toward its end). */
async function stepUntil(page: Page, bar: Locator, want: RegExp) {
  for (let i = 0; i < 8; i++) {
    if (await bar.getByRole("button", { name: want }).count()) return;
    await page.keyboard.press("Control+Enter");
    await page.waitForTimeout(400);
  }
  await expect(bar.getByRole("button", { name: want })).toBeVisible();
}

async function heavyDay(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo clinic" }).click();
  await expect(page.getByRole("button", { name: /Dr\. Ana Rivera's day/ })).toBeVisible();
  const rail = page.getByRole("region", { name: "Your day" });
  await rail.getByRole("button", { name: "Day after" }).click();
  await rail.getByRole("button", { name: "Day after" }).click();
  await expect(rail.getByText("20 visits · 24 pets")).toBeVisible();
  return rail;
}

test("heavy day: a calm rail, one day line, and between visits one green action", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const rail = await heavyDay(page);

  // The rail is one line in clock order, no group labels: Done folded at the top, then the next visits
  // with the rest folded to "+N more this afternoon". The demo day reads at its own clock, which stands
  // still, so it draws no Now line.
  await expect(rail.getByRole("heading", { name: /^(In the room|Up next|Later today)$/ })).toHaveCount(0);
  const done = rail.getByRole("button", { name: /^Done · \d+$/ });
  await expect(done).toHaveAttribute("aria-expanded", "false");
  await expect(rail.getByRole("listitem").first().getByRole("button", { name: /^Done · \d+$/ })).toBeVisible();
  await expect(rail.getByRole("separator", { name: /^Now, / })).toHaveCount(0);
  const more = rail.getByRole("button", { name: /^\+\d+ more this afternoon$/ });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  const shown = await rail.getByRole("button", { name: /AM|PM/ }).count();
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  expect(await rail.getByRole("button", { name: /AM|PM/ }).count()).toBeGreaterThan(shown);
  await more.click();
  await expect(rail.getByRole("switch", { name: /^Needs me · \d+$/ })).toBeVisible();
  // A household folds to the owner and how many pets.
  await expect(rail.getByRole("button", { name: /Ana Garcia/ })).toHaveText(/3:15\s?PM\s*Ana Garcia\s*3 pets/);
  // Two lines a visit, about 72 to 96 px: the pet, species and age; the breed; the reason, never cut to
  // one line; a caution on its own amber line. Nothing says Not started.
  const row = rail.getByRole("button", { name: /^1:45\s?PM/ });
  await expect(row).toContainText("Ziggy");
  await expect(row).toContainText("Bird, 4 years");
  await expect(row).toContainText("Cockatiel");
  const height = (await row.boundingBox())!.height;
  expect(height).toBeGreaterThanOrEqual(64);
  expect(height).toBeLessThanOrEqual(104);
  const smokey = rail.getByRole("button", { name: /^1:30\s?PM/ });
  await expect(smokey.locator("[data-caution]")).toContainText(/towel wrap/i);
  await expect(smokey.locator("[data-caution]")).toHaveCSS("color", "rgb(143, 95, 0)");
  await expect(rail.getByText("Not started")).toHaveCount(0);
  // The busy demo day says so beside its date.
  await expect(rail.getByText("Busy demo day")).toBeVisible();
  // Its own brief: what needs the provider on this day, and Needs me counts the same visits.
  const brief = page.getByRole("region", { name: "Brief" });
  await expect(brief).toContainText("2 texts didn't send.");
  // Never "Needs me · 0" while the brief has something for the provider.
  await expect(rail.getByRole("switch", { name: /^Needs me · [1-9]\d*$/ })).toBeVisible();

  // Home: one plain sentence from the record (the pace and the free time), a slim bar, heads up chips.
  await expect(page.getByText("Demo day at 1:15 PM")).toBeVisible();
  await expect(page.getByText(/Free until 1:30\sPM\./)).toBeVisible();
  await expect(page.getByText(/^Running about 15 min behind\./)).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Visits seen today" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Heads up for the rest of the day" }).getByRole("listitem")).toHaveCount(
    3,
  );
  await expect(page.getByRole("region", { name: "Quick ones for the gap" })).toBeVisible();
  // Between visits: nobody in the room, so no row says In visit, and the bar opens the next visit.
  await expect(rail.locator("[data-status=visit]")).toHaveCount(0);
  const bar = page.getByRole("region", { name: "Next step" });
  await expect(bar).toContainText(/Up next: Smokey at 1:30\sPM · Exam 2\s*Nina is in the room/);
  await expect(page.getByText(/checked in at 1:04\sPM/)).toBeVisible();
  await expect(bar.getByRole("button", { name: /^Open Smokey's visit/ })).toBeVisible();
  await noA11yViolations(page, "heavy day, between visits");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Smokey" })).toBeVisible();
  // End of day follows the day on screen: the busy day's own state, never a jump back to today.
  await page.getByRole("button", { name: /Dr\. Ana Rivera's day/ }).click();
  await page.getByRole("menuitem", { name: "End of day" }).click();
  await expect(rail.getByText(/^\d+ of 20 seen$/)).toBeVisible();
  await expect(rail.getByText("20 visits · 24 pets")).toBeVisible();
  // And the day menu finds the busy demo day from anywhere.
  await page.getByRole("button", { name: /Dr\. Ana Rivera's day/ }).click();
  await page.getByRole("menuitem", { name: /^Busy demo day · / }).click();
  await expect(page.getByText(/Free until 1:30\sPM\./)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("a household visit: pet tabs, a pet question, and a green action that steps across the pets", async ({
  page,
}, info) => {
  // One demo server for both widths: the household is visited and signed once, at the first width.
  test.skip(info.project.name !== "desktop-1440", "the household is signed by the desktop run");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const rail = await heavyDay(page);

  // The household row opens the visit; on screen, it opens in the rail with each pet's row.
  await rail.getByRole("button", { name: /Jordan Lee/ }).click();
  const house = rail.getByRole("button", { name: /Jordan Lee/ });
  await expect(house).toHaveAttribute("aria-expanded", "true");
  await expect(house).toContainText("0 of 3 signed");
  // Each pet's row follows the same rules: not started says nothing.
  await expect(rail.getByRole("button", { name: /^Kiwi/ })).toContainText("Bird, 8 years");
  await expect(rail.getByRole("button", { name: /^Kiwi/ })).not.toContainText("Not started");
  await expect(page.getByRole("heading", { level: 1, name: "Jordan Lee household" })).toBeVisible();
  // Every pet booked in it is in the visit; start, then load the room's one recording and draft.
  const startBar = page.getByRole("region", { name: "Start the visit" });
  await expect(startBar).toContainText("Hazel, Kiwi, Mochi");
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Enter");
  const progress = page.getByRole("region", { name: "Visit in progress" });
  await expect(progress).toBeVisible();
  await page.getByRole("button", { name: "Load sample visit" }).click();
  await expect(page.getByRole("list", { name: "Transcript" }).getByRole("listitem").first()).toBeVisible();
  await progress.getByRole("button", { name: "Draft note" }).click();

  // One note per pet, a tab each with its status, and the room's recording split by pet.
  await expect(page.getByRole("heading", { name: "Hazel · Draft note" })).toBeVisible({ timeout: 30_000 });
  const tabs = page.getByRole("navigation", { name: "Pets in this visit, one note each" });
  await expect(tabs.getByRole("button", { name: /^(Hazel|Kiwi|Mochi)/ })).toHaveCount(3);
  // Another of Jordan's pets can still join the visit once it has started.
  await expect(tabs.getByRole("button", { name: /^Add a pet \(\d+\)/ })).toBeVisible();
  await expect(tabs.getByRole("button", { name: /Hazel/ })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("button", { name: /Kiwi/ })).toContainText("Draft");
  await expect(page.getByText(/Showing Hazel's lines only\./)).toBeVisible();
  // The line Blinq couldn't place asks which pet, in purple at the line.
  const note = page.getByRole("region", { name: "Hazel · Draft note" });
  const question = note.locator("[data-pet-confirm]");
  await expect(question).toContainText("Which pet? Hazel / Mochi");

  // The server never signs a note with a pet question left, whatever the client sends.
  const group = (await (await page.request.get("/api/encounters")).json()) as {
    id: string;
    appointment_id: string;
    patient_name: string;
  }[];
  const hazelId = group.find((g) => g.appointment_id.startsWith("bz-12@") && g.patient_name === "Hazel")?.id;
  expect(hazelId).toBeTruthy();
  const refused = await page.request.post(`/api/encounters/${hazelId}/sign`, {
    data: { signed_by: "Dr. Ana Rivera", send: false },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).detail).toMatch(/confirm/);

  // D1: the one green action names the next step, never a greyed out Sign; Then: says what follows.
  const signBar = page.getByRole("region", { name: "Sign the note" });
  const confirmHazel = signBar.getByRole("button", { name: /^Confirm Hazel/ });
  await expect(confirmHazel).toBeEnabled();
  await expect(signBar.getByText("Then: Review Kiwi and Mochi, sign 3 notes")).toBeVisible();
  await expect(signBar.getByRole("button", { name: /^Sign 3 notes/ })).toHaveCount(0);
  await noA11yViolations(page, "household, a pet question");
  await confirmHazel.click();
  await expect(question.getByRole("button", { name: "Keep this line on Hazel" })).toBeFocused();
  await question.getByRole("button", { name: "Move to Mochi" }).click();
  await expect(note.locator("[data-pet-confirm]")).toHaveCount(0);

  // Opening a tab isn't reviewing it: the primary first takes Hazel's note to its end ("Review Hazel"),
  // then opens Kiwi's tab at its first part not seen; pressed again with Kiwi's end in view, it steps on.
  await stepUntil(page, signBar, /^Review Kiwi/);
  await signBar.getByRole("button", { name: /^Review Kiwi/ }).click();
  await expect(page.getByRole("heading", { name: "Kiwi · Draft note" })).toBeVisible();
  await noA11yViolations(page, "household, reviewing Kiwi");
  await stepUntil(page, signBar, /^Review Mochi/);
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("heading", { name: "Mochi · Draft note" })).toBeVisible();
  // The moved line is on Mochi's note now.
  await expect(page.getByRole("region", { name: "Mochi · Draft note" })).toContainText("Runny nose this morning.");
  // A reload comes back to the same pet's tab (autosave).
  await page.goto("/");
  await rail.getByRole("button", { name: "Day after" }).click();
  await rail.getByRole("button", { name: "Day after" }).click();
  // Drafted, the household is seen: it waits under Done, folded.
  await rail.getByRole("button", { name: /^Done · \d+$/ }).click();
  await rail.getByRole("button", { name: /Jordan Lee/ }).click();
  await expect(page.getByRole("heading", { name: "Mochi · Draft note" })).toBeVisible();
  // Drafted: each pet's row says Draft ready, in the AI's purple with its sparkle.
  const kiwiRow = rail.getByRole("button", { name: /^Kiwi/ });
  await expect(kiwiRow.locator("[data-status=draft]")).toHaveText("Draft ready");
  await expect(kiwiRow.locator('[data-status=draft] [data-icon="auto_awesome"]')).toHaveCount(1);
  await stepUntil(page, signBar, /^Sign 3 notes and send to the PIMS/);
  const signAll = page.getByRole("region", { name: "Sign the note" }).getByRole("button", {
    name: /^Sign 3 notes and send to the PIMS/,
  });
  await expect(signAll).toBeEnabled();
  await page.keyboard.press("Control+Enter");
  const dialog = page.getByRole("dialog", { name: "Sign 3 notes" });
  await dialog.getByRole("button", { name: "Sign 3 notes" }).click();
  await expect(dialog.getByText("3 notes signed and sent to the PIMS.")).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Done" }).click();

  // Signed: one text for every pet, from the pinned bar.
  await expect(page.getByText("One text for all 3 pets, with one summary page.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Next step" }).getByRole("button", { name: /^Text summary to Jordan/ }),
  ).toBeVisible();
  await expect(rail.getByRole("button", { name: /Jordan Lee/ })).toContainText("3 of 3 signed");
  // Signed: a green check.
  await expect(
    rail.getByRole("button", { name: /^Hazel/ }).locator('[data-status=signed] [data-icon="check"]'),
  ).toHaveCount(1);
  await noA11yViolations(page, "household, signed");

  // Two rechecks, one owner: one text with one booking link for both. The first one approved waits.
  const follow = page.getByRole("region", { name: "Follow ups" });
  await follow.getByRole("button", { name: "Approve" }).click();
  await expect(follow).toContainText("Goes out with Hazel's recheck, so Jordan gets one text with one link");
  await page
    .getByRole("navigation", { name: "Pets in this visit, one note each" })
    .getByRole("button", { name: /Hazel/ })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Jordan Lee household" })).toBeVisible();
  await follow.getByRole("button", { name: "Approve" }).click();
  await expect(follow).toContainText("One link for Hazel's and Mochi's rechecks");
  await follow.getByText("See the text").click();
  await expect(
    follow.getByText(
      /would like to see Hazel and Mochi again\. (Pick a time for both rechecks with one link: |Call us to pick a time for both rechecks\.)/,
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
