// Plain words for what Blinq says, the same rules as the server's blinqscribe/plain.py: vet
// shorthand spelled out ("6yo" is "6 year old", "SID x10d" is "once a day for 10 days"), and an answer
// as spoken sentences with no markdown, bullets or "[confirm ...]" markers. Both are checked against
// the shared cases in plainWords.cases.json, so the browser's voice and the server's say the same thing.

const FREQUENCY: Record<string, string> = {
  SID: "once a day",
  BID: "twice a day",
  TID: "three times a day",
  QID: "four times a day",
  q24h: "every 24 hours",
  q12h: "every 12 hours",
  q8h: "every 8 hours",
  PRN: "as needed",
  PO: "by mouth",
};
const SPAN: Record<string, string> = {
  d: "day",
  day: "day",
  days: "day",
  w: "week",
  wk: "week",
  wks: "week",
  week: "week",
  weeks: "week",
  mo: "month",
  mos: "month",
  month: "month",
  months: "month",
};
const DISCHARGE =
  "ear|ears|nasal|ocular|eye|eyes|vaginal|vulvar|preputial|wound|brown|yellow|green|white|clear|bloody|" +
  "purulent|serous|mucoid|mucopurulent|waxy|ceruminous|some|mild|moderate|marked|scant|copious|thick|thin|malodorous";

const AGE_YEARS = /\b(\d+)[\s-]*(?:y\.o\.?|yo|y\/o|yrs?\.?[\s-]*old)(?![A-Za-z])/gi;
const AGE_MONTHS = /\b(\d+)[\s-]*(?:m\.o\.?|mo|m\/o|mos?\.?[\s-]*old)(?![A-Za-z])/gi;
const FOR_SPAN = new RegExp(`(?<![A-Za-z])x\\s*(\\d+)\\s*(${Object.keys(SPAN).join("|")})\\b`, "gi");
// "Bland diet 4d" is "for 4 days"; "in 48h" is "in 48 hours". Lowercase only, so "3D" stays.
const BARE_SPAN = /(?:\b(in|within|after|over|for|every)\s+)?(?<![\w.])(\d+)(d|h)(?![\w/])/g;
const FREQ = new RegExp(`(?<![\\w/])(${Object.keys(FREQUENCY).join("|")})(?![\\w/])`, "g");

// "Rx Apoquel" is the drug; "Recheck 4 wk" is "Recheck in 4 weeks".
const RX = /(?<![A-Za-z])Rx:?\s+(?=[A-Za-z])/g;
const RECHECK = new RegExp(`\\b(recheck)\\s+(?:in\\s+)?(\\d+)\\s*(${Object.keys(SPAN).join("|")})\\b`, "gi");

/** Vet shorthand in plain words. Numbers stay digits. */
export function plainWords(text: string): string {
  return text
    .replace(RX, "")
    .replace(RECHECK, (_, word: string, n: string, unit: string) => {
      const count = Number(n);
      return `${word} in ${count} ${SPAN[unit.toLowerCase()]}${count === 1 ? "" : "s"}`;
    })
    .replace(AGE_YEARS, "$1 year old")
    .replace(AGE_MONTHS, "$1 month old")
    .replace(FOR_SPAN, (_, n: string, unit: string) => {
      const count = Number(n);
      return `for ${count} ${SPAN[unit.toLowerCase()]}${count === 1 ? "" : "s"}`;
    })
    .replace(BARE_SPAN, (_, word: string | undefined, n: string, unit: string) => {
      const count = Number(n);
      return `${word ?? "for"} ${count} ${unit === "d" ? "day" : "hour"}${count === 1 ? "" : "s"}`;
    })
    .replace(FREQ, (_, k: string) => FREQUENCY[k] ?? k)
    .replace(/(?<![A-Za-z])w\/o(?![A-Za-z])/gi, "without")
    .replace(/(?<![A-Za-z])w\/(?=\s|[A-Za-z])\s*/gi, "with ")
    .replace(new RegExp(`\\b(${DISCHARGE})\\s+d/c\\b`, "gi"), "$1 discharge")
    .replace(/(?<=[A-Za-z])\s*\+\s*(?=[A-Za-z])/g, " and ");
}

function confirm(_: string, what: string): string {
  const items = what
    .split(/[/,]| and /)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!items.length) return " (not confirmed yet)";
  const said = items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return ` (${said} not confirmed yet)`;
}

/** An answer as a few spoken sentences: no markdown, no bullet list, no "[confirm ...]" marker, no shorthand. */
export function plainAnswer(text: string): string {
  const cleaned = text
    .replace(/\s*\[\s*confirm\s*:?\s*([^\]]*)\]/gi, confirm)
    .replace(/\*\*|__|`/g, "")
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1");
  const sentences: string[] = [];
  for (const raw of cleaned.split("\n")) {
    let line = raw.replace(/^\s*(?:#+\s*|[-*•]\s+|\d+[.)]\s+)/, "").trim();
    if (!line) continue;
    if (/[:;,]$/.test(line)) line = `${line.slice(0, -1)}.`;
    else if (!/[.!?]["')]*$/.test(line)) line += ".";
    sentences.push(line);
  }
  const out = sentences
    .join(" ")
    .replace(/(?<=\d)\s*[–—]\s*(?=\d)/g, " to ")
    .replace(/\s*[—–]\s*|\s+-\s+/g, ", ");
  return plainWords(out)
    .replace(/\s{2,}/g, " ")
    .trim();
}
