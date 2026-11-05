import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The judge's path through the demo clinic: Home, a visit from start to signed and shared, end of
// day, search, the record and Ask Blinq. Every screen on the way gets an axe pass.

async function noA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(", ")}`,
  );
  expect(summary, `axe on ${where}`).toEqual([]);
}

// Today's demo reads before clinic, whatever the hour the tests run: Home's moment (between visits or
// not) never depends on the real clock. Between visits on a standard day is lastplan.spec's.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("blinq_clock", "08:00"));
});

test("demo flow: home, visit, sign, share, end of day, search, record, Ask Blinq", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // Sign in page first: open demo, so Try the demo clinic goes straight in.
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Welcome back. Sign in to your hospital." })).toBeVisible();
  await noA11yViolations(page, "sign in");
  await page.getByRole("button", { name: "Try the demo clinic" }).click();

  // Home: one purple brief line, the greeting, Up next beside Follow-ups waiting, one green action.
  await expect(page.getByRole("button", { name: /Dr\. Ana Rivera's day/ })).toBeVisible();
  const brief = page.getByRole("region", { name: "Brief" });
  await expect(brief.getByText(/visits? today\./)).toBeVisible();
  await expect(brief.getByRole("button", { name: "Hear it" })).toBeVisible();
  await expect(brief.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), Dr\. Rivera$/ }),
  ).toBeVisible();
  // The top bar: Ask Blinq is the one way in, and whose day holds End of day; no Morning brief button.
  await expect(page.getByRole("button", { name: /^Ask Blinq/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Morning brief" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End of day", exact: true })).toHaveCount(0);
  await expect(page.locator(".ask-launcher")).toHaveCount(0);
  const follow = page.getByRole("region", { name: "Follow-ups waiting" });
  // Both widths share one demo server, so the other width's test may have signed these already.
  await expect(follow.getByRole("button", { name: /Ready to sign/ })).toContainText(/[0-2]$/);
  await expect(follow.getByText("Text to Jordan didn't send")).toBeVisible();
  const home = page.getByRole("region", { name: "Next step" });
  const openNext = home.getByRole("button", { name: /^Open \w+'s? visit/ });
  await expect(openNext).toBeVisible();
  // No To do box and no week strip in the rail.
  await expect(page.getByRole("heading", { name: "To do", exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Pick a day" })).toHaveCount(0);
  await noA11yViolations(page, "home");
  await brief.getByRole("button", { name: "Dismiss" }).click();
  await expect(brief).toHaveCount(0);

  // ⌘↵ (Ctrl+Enter) presses the one green action: open the next visit.
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("region", { name: "Start the visit" })).toBeVisible();
  await noA11yViolations(page, "before the visit");
  // Visit | Record under the banner; the household button opens Record on this pet, Start visit stays.
  const visitTabs = page.getByRole("tablist", { name: "This visit" });
  await expect(visitTabs.getByRole("tab", { name: "Visit", selected: true })).toBeVisible();
  await page.getByRole("button", { name: /'s household$/ }).click();
  await expect(visitTabs.getByRole("tab", { name: "Record", selected: true })).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Pets" }).getByRole("tab", { name: /This visit/, selected: true }),
  ).toBeVisible();
  await expect(page.getByText("From the PIMS · read only")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Owner and pets" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Start the visit" })).toBeVisible();
  await noA11yViolations(page, "record tab, before the visit");
  await page.getByRole("tab", { name: "Invoices" }).click();
  await expect(page.getByText("Account balance")).toBeVisible();
  await visitTabs.getByRole("tab", { name: "Visit" }).click();

  // A text to this owner that didn't send is a red row in the banner with Retry (Jordan's, in the demo).
  // (The second width's run is Miso's visit, whose owner has none.)
  if ((await page.locator(".vh-owner").innerText()).includes("Jordan")) {
    const failedRow = page.locator(".visit-head").getByRole("alert");
    await expect(failedRow).toContainText(/didn't send/);
    await expect(failedRow.getByRole("button", { name: "Retry" })).toBeVisible();
  }
  // The tabs are at the top of the content card, not in the banner.
  await expect(visitTabs.locator("xpath=ancestor::section[contains(@class,'visit-body')]")).toHaveCount(1);
  // Before you walk in: dated facts, the last plan as checkboxes in plain words, never advice.
  const walkIn = page.getByRole("list", { name: "Before you walk in, newest first" });
  await expect(walkIn.getByText(/^From .*last plan$/)).toBeVisible();
  await expect(walkIn.getByRole("checkbox").first()).toBeVisible();
  await expect(page.locator(".walk-in")).not.toContainText(/\b(PO|BID|SID)\b|likely|Plan to check/);
  // One main action per state, in the pinned bar only: the banner has no Start visit of its own.
  const startBar = page.getByRole("region", { name: "Start the visit" });
  await expect(page.getByRole("button", { name: "Start visit" })).toHaveCount(1);
  // The bar holds no voice button of its own: Ask Blinq (with its mic) is in the top bar.
  await expect(startBar.getByRole("button", { name: "Ask Blinq by voice" })).toHaveCount(0);
  // Start visit opens the visit straight away (⌘↵ presses it); Start recording is where the owner is asked.
  await noA11yViolations(page, "before the visit");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Visit in progress: load the sample visit (saved, so each line shows who said it), then draft the note.
  await expect(page.getByRole("region", { name: "Visit in progress" })).toBeVisible();
  // In the rail, the visit in the room says In visit with a green dot: never red for recording.
  const inRoom = page.getByRole("region", { name: "Your day" }).getByRole("button", { name: /In visit/ });
  await expect(inRoom.locator("[data-status=visit]")).toHaveText("In visit", { timeout: 20_000 });
  await expect(inRoom.locator(".rec-dot, .text-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Load sample visit" }).click();
  await expect(page.getByRole("list", { name: "Transcript" }).getByRole("listitem").first()).toBeVisible();
  // Who is this? is one tap in the row: Biscuit's sample has a Speaker 3, the tech, and one tap names
  // every line from that voice. (The second run of this test, on the same server, is Miso's visit.)
  const who = page.getByRole("group", { name: /^Who is Speaker \d+\?$/ }).first();
  if (await who.count()) {
    await expect(who.getByRole("button")).toHaveText(["Tech", "Owner", "Other"]);
    await who.getByRole("button", { name: "Tech" }).click();
    await expect(page.getByRole("group", { name: /^Who is Speaker \d+\?$/ })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Transcript" }).getByText("named by you").first()).toBeVisible();
  }
  // A saved transcript is never covered: the toast sits up under the top bar.
  await noA11yViolations(page, "visit in progress");
  // The Record tab while recording: the pinned bar and Draft note stay; switch pets and open Past visits.
  await visitTabs.getByRole("tab", { name: "Record" }).click();
  await expect(
    page.getByRole("region", { name: "Visit in progress" }).getByRole("button", { name: "Draft note" }),
  ).toBeVisible();
  const petTabs = page.getByRole("tablist", { name: "Pets" }).getByRole("tab");
  if ((await petTabs.count()) > 1) {
    await petTabs.nth(1).click();
    await expect(petTabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await petTabs.nth(0).click();
  }
  // A reload comes back to the same tab and pet (autosave, review principle 16).
  if ((await petTabs.count()) > 1) await petTabs.nth(1).click();
  const selectedPet = () => page.getByRole("tablist", { name: "Pets" }).getByRole("tab", { selected: true });
  const petShown = (await selectedPet().innerText()).split("\n")[0]?.trim() ?? "";
  await page.reload();
  await expect(visitTabs.getByRole("tab", { name: "Record", selected: true })).toBeVisible();
  await expect(selectedPet()).toContainText(petShown);
  await petTabs.nth(0).click();
  await page.getByRole("tab", { name: "Past visits" }).click();
  await expect(page.getByRole("searchbox", { name: "Search past visits" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Pet" })).toHaveCount(0);
  await noA11yViolations(page, "record tab, past visits, while recording");
  await visitTabs.getByRole("tab", { name: "Visit" }).click();
  await expect(page.getByRole("list", { name: "Transcript" }).getByRole("listitem").first()).toBeVisible();
  // Draft note lives in the pinned bar only, with its help line.
  await expect(page.getByRole("button", { name: "Draft note" })).toHaveCount(1);
  const progress = page.getByRole("region", { name: "Visit in progress" });
  await expect(progress.getByText(/drafts the note with Blinq|Drafts (the|one) note/)).toBeAttached();
  await expect(page.getByRole("list", { name: "Where this visit is" })).toContainText("Record, current");
  await expect(page.getByText(/^Started \d{1,2}:\d{2}\s[AP]M$/)).toBeVisible();
  await progress.getByRole("button", { name: "Draft note" }).click();

  // Review the note: Drafted by Blinq once, SOAP as plain sections, the step bar on Draft.
  await expect(page.getByRole("heading", { name: "Draft note" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Drafted by Blinq")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Where this visit is" })).toContainText("Draft, current");
  await expect(page.getByRole("navigation", { name: "Note sections" })).toHaveCount(0);
  const signBar = page.getByRole("region", { name: "Sign the note" });
  await expect(signBar.getByRole("button", { name: "Patient record" })).toHaveCount(0);
  await noA11yViolations(page, "review the note");
  // A time chip at the end of a drafted line jumps to that moment in the transcript.
  const source = page.getByRole("button", { name: /^\d+:\d{2}.*, go to this line in the transcript$/ }).first();
  await expect(source).toBeVisible();
  await source.click();
  await expect(page.locator("#transcriptPhotos")).toHaveAttribute("open", "");
  await expect(page.locator('[id^="line-"]:focus')).toBeVisible();

  // The server never signs a note still marked to confirm, whatever the client sends.
  const apptId = new URL(page.url()).pathname.split("/").pop() ?? "";
  const drafts = (await (await page.request.get("/api/encounters")).json()) as {
    id: string;
    appointment_id: string;
    status: string;
  }[];
  const draftId = drafts.find((d) => d.appointment_id.split("@")[0] === apptId && d.status === "draft_ready")?.id;
  expect(draftId).toBeTruthy();
  const refused = await page.request.post(`/api/encounters/${draftId}/sign`, {
    data: { signed_by: "Dr. Ana Rivera", send: false },
  });
  expect(refused.status()).toBe(409);
  expect((await refused.json()).detail).toMatch(/confirm/);

  // D1: the one green action names the next step, never a greyed out Sign. It goes to the thing to
  // confirm; Then: says what follows.
  const step = signBar.getByRole("button", { name: /^(Fill in|Confirm) / });
  await expect(step).toBeEnabled();
  await expect(signBar.getByRole("button", { name: /^Sign and send/ })).toHaveCount(0);
  await expect(signBar.getByText(/^Then: /)).toBeVisible();
  await expect(signBar.getByText(/^\d+ things? to confirm · /)).toBeVisible();
  await step.click();
  await expect(page.locator(".confirm-item button:focus")).toBeVisible();
  // Edit at the field: the editor shows a purple chip in words, never "[confirm: ...]", and typing
  // over it (it starts selected) replaces it.
  const firstItem = page.locator(".confirm-item").first();
  if (await firstItem.getByRole("button", { name: /^Edit / }).count()) {
    await firstItem.getByRole("button", { name: /^Edit / }).click();
    const editor = page.locator(".confirm-area textarea");
    await expect(editor).toBeFocused();
    await expect(editor).not.toHaveValue(/\[confirm/);
    await expect(editor).toHaveValue(/Confirm: /);
    await expect(page.locator(".confirm-back mark[data-confirm]").first()).toBeVisible();
    await page.keyboard.type("Otomax, 4 drops twice a day for 10 days");
    await expect(editor).not.toHaveValue(/Confirm: /);
    // An edit not yet saved comes back after a reload, in the same section.
    const typed = await editor.inputValue();
    await page.reload();
    await expect(page.locator(".confirm-area textarea")).toHaveValue(typed);
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  // Anything else to confirm: the primary goes to it, Confirm takes it as it is.
  for (let i = 0; i < 6; i++) {
    const more = signBar.getByRole("button", { name: /^(Fill in|Confirm) / });
    if (!(await more.count())) break;
    await more.click();
    await page.locator(".confirm-item button:focus").click();
  }
  await expect(signBar.getByRole("button", { name: /^Sign and send to the PIMS/ })).toBeEnabled();
  await expect(signBar.getByRole("button", { name: "Sign only" })).toBeVisible();
  await noA11yViolations(page, "review, all confirmed");

  // Edit one section in place and use a Muse action.
  await page
    .getByRole("button", { name: /^Edit / })
    .first()
    .click();
  await page.getByRole("button", { name: "Tighten" }).click();
  await expect(page.getByText(/Suggested:|can only reword|can't edit/)).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  // Approve every follow up still waiting, then sign.
  for (let i = 0; i < 4; i++) {
    const approve = page.getByRole("button", { name: "Approve", exact: true }).first();
    if (!(await approve.isVisible().catch(() => false))) break;
    await approve.click();
    await expect(page.getByText("Approved.").nth(i)).toBeVisible();
  }
  // Sign and send opens the confirm panel first: where it goes, what goes and the texts that follow.
  await page
    .getByRole("region", { name: "Sign the note" })
    .getByRole("button", { name: /^Sign and send to/ })
    .click();
  const confirm = page.getByRole("dialog", { name: /^Sign and send to/ });
  await expect(confirm.getByText("Where it goes")).toBeVisible();
  await expect(confirm.getByText("Texts that follow")).toBeVisible();
  await noA11yViolations(page, "sign confirm");
  await confirm.getByRole("button", { name: /^Sign and send to/ }).click();

  // Signed: one status line in the banner, the PIMS list one click away, the note collapsed.
  await expect(page.getByText(/^Signed by .* at \d{1,2}:\d{2}\s[AP]M$/)).toBeVisible();
  const pimsLine = page.getByRole("button", { name: /saved to the PIMS$/i });
  await expect(pimsLine).toBeVisible();
  await pimsLine.click();
  await expect(page.getByRole("heading", { name: "In the PIMS" })).toBeVisible();
  // Blinq never sends a prescription: it's a front desk task, tracked until someone marks it entered.
  const pimsCard = page.getByRole("region", { name: "In the PIMS" });
  await expect(pimsCard.getByText(/^Enter .+ for \w+ in the PIMS$/)).toBeVisible();
  await expect(pimsCard.getByText("Front desk to enter")).toBeVisible();
  await pimsCard.getByRole("button", { name: "Mark entered" }).click();
  await expect(pimsCard.getByText(/^Entered by .+, \d{1,2}:\d{2}\s[AP]M$/)).toBeVisible();
  // The recheck went out as a booking link, with its one reminder if Jordan doesn't book.
  const followUps = page.getByRole("region", { name: "Follow ups" });
  await expect(followUps.getByText(/Reminder goes out \w{3} \d{1,2} if not booked/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show the signed note" })).toBeVisible();
  await noA11yViolations(page, "signed");
  await page.getByRole("button", { name: "Preview text page" }).click();
  await expect(page.getByText(/Preview: what .* sees/)).toBeVisible();
  // Visit details at the top, as on the PDF and the owner's page: the time is 12-hour.
  await expect(page.getByText("Visit details", { exact: true })).toBeVisible();
  await expect(page.getByText(/\d{4} at \d{1,2}:\d{2}\s[AP]M/)).toBeVisible();
  await expect(page.getByText("Seen by", { exact: true })).toBeVisible();
  // The share card has no send of its own: the pinned bar sends the summary.
  await page.getByRole("radio", { name: /Text a link/ }).click();
  const next = page.getByRole("region", { name: "Next step" });
  await next.getByRole("button", { name: /^Text summary to \w+/ }).click();
  // The demo card holds the text itself. (The Follow ups list keeps its own demo text behind "See the
  // text", so scope to this card rather than take the last match, which is that closed one.)
  const demoText = page.getByRole("region", { name: /^Demo: summary text ready at / });
  await expect(demoText.getByText("Demo mode: the text the owner would get")).toBeVisible();
  await expect(demoText.getByText(/visit summary from .* is ready: /)).toBeVisible();
  await expect(page.getByText(/^Demo: summary text ready at /).first()).toBeVisible();
  await expect(next.getByRole("button", { name: /summary to/ })).toHaveCount(0);
  // Shared: the handoff to the next visit is the green action.
  await expect(next.getByRole("button", { name: /^Next: \w+/ })).toBeVisible();
  await noA11yViolations(page, "signed, summary sent");

  // End of day, from whose day: notes left to sign first, one green action to sign them.
  await page.getByRole("button", { name: /Dr\. Ana Rivera's day/ }).click();
  await page.getByRole("menuitem", { name: "End of day" }).click();
  await expect(page.getByRole("heading", { name: "End of day", level: 1 })).toBeAttached();
  await expect(page.getByRole("region", { name: "Notes left to sign" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "To do", exact: true })).toHaveCount(0);
  // What happened, counted as it happened: the link went out, nobody booked yet.
  await expect(page.getByText(/You saw .* visits? today/)).toBeVisible();
  await expect(page.getByText(/\d+ recheck links? sent, none booked yet\./)).toBeVisible();
  const calls = page.getByRole("region", { name: "Calls and texts left" });
  await expect(calls.getByRole("button", { name: "Retry" })).toBeVisible();
  // Mid-day, not every visit seen: no closing line.
  await expect(page.getByText("That's the day. Everything else can wait until tomorrow.")).toHaveCount(0);
  // The rail folds to a summary with tomorrow in one line.
  await expect(page.getByRole("region", { name: "Your day" }).getByText("Tomorrow")).toBeVisible();
  const eodBar = page.getByRole("region", { name: "Notes to sign" });
  await expect(eodBar.getByRole("button", { name: /^Review and sign \d+ notes?/ })).toBeVisible();
  await noA11yViolations(page, "end of day");

  // Search (Ctrl K), then an owner's record.
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "Search pets, owners or phone" });
  await expect(box).toBeFocused();
  await box.fill("Jordan");
  await expect(page.getByRole("option").first()).toBeVisible();
  await noA11yViolations(page, "search");
  await page.getByRole("option", { name: /^Jordan Lee/ }).click();
  // The record page: the owner is the page's Display, a tab per pet, no pinned bar and nothing green.
  await expect(page).toHaveURL(/\/record\/cli-1/);
  await expect(page.getByRole("heading", { level: 1, name: "Jordan Lee" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Pets" }).getByRole("tab")).toHaveCount(5);
  await expect(page.getByText("From the PIMS · read only")).toBeVisible();
  await expect(page.getByRole("link", { name: "Text" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: /Start the visit|Visit in progress|Sign the note|Next step/ }),
  ).toHaveCount(0);
  await noA11yViolations(page, "record page");
  await page.getByRole("tab", { name: "Texts" }).click();
  await expect(page).toHaveURL(/tab=texts/);
  await page.getByRole("switch", { name: "All pets" }).click();
  await expect(page.getByText("Thank you! We'll be there.")).toBeVisible();

  // Ask Blinq from the top bar's pill: today's brief first, then the answer.
  await page.getByRole("button", { name: /^Ask Blinq/ }).click();
  const panel = page.getByRole("dialog", { name: "Ask Blinq" });
  await expect(panel.getByText("Today's brief")).toBeVisible();
  await expect(panel.getByText("Your day")).toBeVisible();
  await panel.getByRole("textbox", { name: "Ask Blinq about today" }).fill("Who's next?");
  await panel.getByRole("button", { name: "Send" }).click();
  // The vet's own turn carries a screen-reader-only "You:" in front of what they asked.
  await expect(panel.getByRole("log").getByText("You: Who's next?", { exact: true })).toBeVisible();
  // Blinq's mark on the brief and this answer.
  await expect(panel.getByRole("log").getByRole("img", { name: "Blinq" })).toHaveCount(2);
  await noA11yViolations(page, "Ask Blinq");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  // The pill stays in the top bar, with its mic for press to talk.
  await expect(page.locator(".ask-pill").getByRole("button", { name: "Talk to Blinq", exact: true })).toBeVisible();

  // No horizontal page scroll at this width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  expect(errors, "console errors").toEqual([]);
});

test("reduced motion stops the animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /^Ask Blinq/ }).click();
  const duration = await page.evaluate(() => {
    const el = document.createElement("span");
    el.className = "rec-dot";
    document.body.appendChild(el);
    return getComputedStyle(el).animationName;
  });
  expect(duration).toBe("none");
});

test("#oauth_link= is finished by the console and cleared from the address bar", async ({ page }) => {
  await page.goto("/#oauth_link=not-a-real-code");
  // Not signed in as anyone in the open demo, so the server refuses it; the console says why.
  // The notice's own Dismiss, not the brief line's.
  const dismiss = page.getByRole("status").getByRole("button", { name: "Dismiss" });
  await expect(dismiss).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await dismiss.click();
  await expect(dismiss).toHaveCount(0);
});

test("a ?token= in the address never signs anyone in", async ({ page }) => {
  await page.goto("/sign-in?token=someone-elses-session");
  const stored = await page.evaluate(() => [
    localStorage.getItem("blinq_scribe_session"),
    sessionStorage.getItem("blinq_scribe_session"),
  ]);
  expect(stored).toEqual([null, null]);
});

test("the component gallery at /ui shows the library and passes axe", async ({ page }) => {
  await page.goto("/ui");
  await expect(page.getByRole("heading", { name: "Component library" })).toBeVisible();
  // Each section draws its components twice, in the light theme and then the dark one.
  await page.getByRole("button", { name: "Open dialog" }).first().click();
  await expect(page.getByRole("dialog", { name: "A dialog" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText("Enter a name.").first()).toBeVisible();
  await noA11yViolations(page, "component gallery");
});

test("the record page opens on the pet in the address, and the old pages land on it", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo clinic" }).click();
  await expect(page.getByRole("button", { name: /Dr\. Ana Rivera's day/ })).toBeVisible();
  // Waffles is Jordan Lee's dachshund, with a caution.
  await page.goto("/record/cli-1?pet=pat-6");
  const pets = page.getByRole("tablist", { name: "Pets" });
  await expect(pets.getByRole("tab", { name: /^Waffles/, selected: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cautions" })).toBeVisible();
  await noA11yViolations(page, "record page, Waffles");
  // A pet that isn't this owner's shows the first pet.
  await page.goto("/record/cli-1?pet=pat-2");
  await expect(pets.getByRole("tab", { name: /^Biscuit/, selected: true })).toBeVisible();
  await page.goto("/household/cli-1");
  await expect(page).toHaveURL(/\/record\/cli-1$/);
  await page.goto("/patient/pat-7");
  await expect(page).toHaveURL(/\/record\/cli-1\?pet=pat-7$/);
  await expect(pets.getByRole("tab", { name: /^Hazel/, selected: true })).toBeVisible();
});

test("home: the buckets open Notes, two notes sign at once, and Needs me filters the rail", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Try the demo clinic" }).click();
  const follow = page.getByRole("region", { name: "Follow-ups waiting" });
  const ready = follow.getByRole("button", { name: /Ready to sign/ });
  await expect(ready).toContainText(/\d$/);
  // Both widths share one demo server: the first width signs the two seeded notes.
  test.skip((await ready.textContent())?.endsWith("0") ?? false, "the other width signed the seeded notes");
  await ready.click();
  await expect(page).toHaveURL(/\/notes\?bucket=ready$/);
  await expect(page.getByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^Select (?!all)/ }).first()).toBeChecked();
  await noA11yViolations(page, "notes, ready to sign");
  // Both ready notes are picked; the green action opens the confirm that lists them.
  const bar = page.getByRole("region", { name: "Sign notes" });
  await bar.getByRole("button", { name: /^Sign 2 notes/ }).click();
  const dialog = page.getByRole("dialog", { name: "Sign 2 notes" });
  await expect(dialog.getByText(/^Signed as Dr\. Ana Rivera$/)).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Sign and send to the PIMS" })).toBeChecked();
  await noA11yViolations(page, "bulk sign");
  await dialog.getByRole("button", { name: "Sign 2 notes" }).click();
  await expect(dialog.getByText("2 notes signed and sent to the PIMS.")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("No notes are ready to sign.")).toBeVisible();
  // Pending opens each note; no bulk action.
  await page.getByRole("tab", { name: /Pending/ }).click();
  await expect(page).toHaveURL(/bucket=pending/);
  await expect(page.getByText("1 follow up to decide").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // Back on Home: the rail's one quiet toggle keeps the visits that need the provider.
  await page.goto("/");
  const rail = page.getByRole("region", { name: "Your day" });
  const needs = rail.getByRole("switch", { name: /^Needs me · \d+$/ });
  await needs.click();
  await expect(needs).toBeChecked();
  await expect(rail.getByRole("button", { name: /Miso/ })).toBeVisible();
  await expect(rail.getByRole("button", { name: /Rocket/ })).toHaveCount(0);
  // The green action opens the next visit.
  await page
    .getByRole("region", { name: "Next step" })
    .getByRole("button", { name: /^Open \w+'s? visit/ })
    .click();
  await expect(page).toHaveURL(/\/visit\//);
});
