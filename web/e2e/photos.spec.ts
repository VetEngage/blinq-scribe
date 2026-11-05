import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

// Requirement 59: add a photo, edit it, delete it. No camera in CI, so the file path carries the
// edits and the camera path runs on a stand-in getUserMedia that streams a drawn canvas.

const PNG = fileURLToPath(new URL("./fixtures/exam-photo.png", import.meta.url));

async function noA11yViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
    `axe on ${where}`,
  ).toEqual([]);
}

/** Open a visit nobody has started yet and start it, so the photos card is on screen. */
async function startAVisit(page: Page) {
  await page.goto("/");
  // Other tests start visits on the same demo server, so look ahead day by day for one still free.
  const fresh = page
    .locator(".appt")
    .filter({ hasNotText: /In visit|Draft ready|Signed|didn.t send|save failed/ })
    .first();
  for (let day = 0; day < 6 && !(await fresh.isVisible().catch(() => false)); day++) {
    await page.getByRole("button", { name: "Day after" }).click();
    await page.waitForTimeout(400);
  }
  await fresh.click();
  // Start visit asks one question first, in the bar; the owner's answer is saved with the visit.
  const startBar = page.getByRole("region", { name: "Start the visit" });
  await startBar.getByRole("button", { name: "Start visit" }).click();
  await expect(page.getByRole("button", { name: "Add photo" })).toBeVisible();
}

const dialog = (page: Page) => page.getByRole("dialog");

test("a photo from a file: label, owner's summary, rotate, delete and undo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await startAVisit(page);
  await expect(page.getByText("None taken")).toBeVisible();

  await page.getByRole("button", { name: "Add photo" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Add a photo" })).toBeVisible();
  await dialog(page).getByRole("radio", { name: "Upload from device" }).click();
  await noA11yViolations(page, "capture view");
  await dialog(page).getByLabel("Choose a photo from this device").setInputFiles(PNG);
  await dialog(page).getByLabel("What is it? (optional)").fill("right ear canal");
  await dialog(page).getByRole("button", { name: "Take photo" }).click();

  // The edit view: the photo with its outline, then the edits.
  await expect(dialog(page).getByRole("heading", { name: "Photo", exact: true })).toBeVisible();
  await expect(dialog(page).getByRole("region", { name: "Description" })).toBeVisible();
  await expect(dialog(page).getByRole("switch", { name: /Add to the note/ })).toBeChecked();
  await expect(dialog(page).getByRole("switch", { name: /Show in the owner's summary/ })).not.toBeChecked();
  await noA11yViolations(page, "edit view");

  await dialog(page).getByLabel("Label").fill("Right ear canal");
  await expect(dialog(page).getByText("Saved", { exact: true })).toBeVisible();
  // Blinq's description is read like a note section and edited in place; Esc finishes it, not the dialog.
  await dialog(page).getByRole("button", { name: "Edit Description" }).click();
  await dialog(page).getByRole("textbox", { name: "Description" }).fill("Red, swollen ear canal");
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByText("Red, swollen ear canal")).toBeVisible();
  await dialog(page)
    .getByRole("switch", { name: /Show in the owner's summary/ })
    .click();
  await dialog(page).getByRole("button", { name: "Rotate" }).click();
  await expect(dialog(page).getByText("Saving", { exact: true })).toBeVisible();
  await expect(dialog(page).getByText("Saved", { exact: true })).toBeVisible();

  // Outline adjusted from the keyboard.
  await dialog(page).getByRole("button", { name: "Adjust outline" }).click();
  await dialog(page).getByRole("button", { name: "Bottom right corner of the outline" }).press("Shift+ArrowLeft");
  await noA11yViolations(page, "outline editor");
  await dialog(page).getByRole("button", { name: "Adjust outline" }).click();
  await expect(dialog(page).getByText("Saved", { exact: true })).toBeVisible();

  // Save closes the view; opened again from its thumbnail, the edits stuck.
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const thumb = page.getByRole("button", { name: "Open photo: Right ear canal" });
  await expect(thumb).toBeVisible();
  await expect(thumb.getByText("In owner's summary")).toBeVisible();
  await thumb.click();
  await expect(dialog(page).getByLabel("Label")).toHaveValue("Right ear canal");
  await expect(dialog(page).getByText("Red, swollen ear canal")).toBeVisible();
  await expect(dialog(page).getByRole("switch", { name: /Show in the owner's summary/ })).toBeChecked();

  // Delete, with a confirmation.
  await dialog(page).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete this photo?" })).toBeVisible();
  await noA11yViolations(page, "delete confirmation");
  await page.getByRole("button", { name: "Delete photo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Open photo:/ })).toHaveCount(0);

  // Undo brings it back with its edits; a second delete sticks.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Open photo: Right ear canal" })).toBeVisible();
  await page.getByRole("button", { name: "Open photo: Right ear canal" }).click();
  await dialog(page).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete photo" }).click();
  await expect(page.getByText("Photo deleted.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open photo:/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("this computer's camera: live view, Take photo, then the camera is off", async ({ page }) => {
  // A stand-in camera: a canvas stream, and a count of live tracks so we can see it stop.
  await page.addInitScript(() => {
    const w = window as unknown as { streams: MediaStream[] };
    w.streams = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 240;
      const ctx = c.getContext("2d")!;
      setInterval(() => {
        ctx.fillStyle = "#c86";
        ctx.fillRect(0, 0, 320, 240);
        ctx.fillStyle = "#733";
        ctx.fillRect(120, 80, 60, 60);
      }, 30);
      const stream = c.captureStream(15);
      w.streams.push(stream);
      return stream;
    };
  });
  // Tracks of every stream the page was handed that are still running.
  const liveTracks = () =>
    page.evaluate(
      () =>
        (window as unknown as { streams: MediaStream[] }).streams
          .flatMap((s) => s.getTracks())
          .filter((tr) => tr.readyState === "live").length,
    );
  await startAVisit(page);
  await page.getByRole("button", { name: "Add photo" }).click();
  const take = dialog(page).getByRole("button", { name: "Take photo" });
  await expect(take).toBeEnabled();
  expect(await liveTracks()).toBe(1);
  await take.click();
  await expect(dialog(page).getByRole("heading", { name: "Photo", exact: true })).toBeVisible();
  expect(await liveTracks()).toBe(0);

  // Opening the camera again and closing the view turns it off too.
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Add photo" }).click();
  await expect(take).toBeEnabled();
  expect(await liveTracks()).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await liveTracks()).toBe(0);

  // And leaving the visit with the camera on (the browser's Back button) stops it as well.
  await page.getByRole("button", { name: "Add photo" }).click();
  await expect(take).toBeEnabled();
  expect(await liveTracks()).toBe(1);
  await page.goBack();
  await expect.poll(liveTracks).toBe(0);
});
