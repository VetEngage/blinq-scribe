// Runs before first paint (a blocking script in <head>) so the page never flashes the wrong theme.
// Same rule as src/state/theme.ts: the saved choice, else System, resolved to "light" or "dark".
(function () {
  var choice = "system";
  try {
    choice = localStorage.getItem("blinq.theme") || "system";
  } catch (e) {
    // Storage is blocked: follow the device.
  }
  var dark =
    choice === "dark" ||
    (choice !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
