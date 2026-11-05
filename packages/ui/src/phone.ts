// The one place phone numbers become text: US numbers read "(555) 014-2231" on every screen.

/** "x12", "ext 12", "ext. 12", "extension 12" or "#12" at the end of a number. */
const EXT = /\s*(?:,|;)?\s*(?:ext(?:ension)?\.?|x|#)\s*(\d{1,6})\s*$/i;
/** "***0101", "•••0101", "(***) ***-0101": only the last four digits are shown. */
const MASKED = /^[\s()*•.-]*[*•][\s()*•.-]*(\d{4})$/;

/**
 * "(555) 014-2231". A leading +1 is dropped, an extension reads "ext. 12", a masked number reads
 * "(•••) •••-0101", and anything else (another country, letters) shows as given. Empty for nothing.
 */
export function formatPhone(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const masked = MASKED.exec(raw);
  if (masked) return `(•••) •••-${masked[1]}`;
  const ext = EXT.exec(raw);
  const main = ext ? raw.slice(0, ext.index) : raw;
  const suffix = ext ? ` ext. ${ext[1]}` : "";
  if (/[^\d\s()+.-]/.test(main)) return raw;
  let d = main.replace(/\D/g, "");
  if (main.trim().startsWith("+") && !main.trim().startsWith("+1")) return raw;
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}${suffix}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}${suffix}`;
  return raw;
}

/**
 * Any number shown masked, last four digits only: "(•••) •••-2231", the same as formatPhone shows a
 * number that came masked. Empty for nothing.
 */
export function maskPhone(value: string | null | undefined): string {
  const d = String(value ?? "").replace(/\D/g, "");
  return d ? `(•••) •••-${d.slice(-4)}` : "";
}

/** A tel: link for a number that can be called; "" for a masked or unreadable one. */
export function phoneHref(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || MASKED.test(raw)) return "";
  const ext = EXT.exec(raw);
  const main = ext ? raw.slice(0, ext.index) : raw;
  if (/[^\d\s()+.-]/.test(main)) return "";
  const d = main.replace(/\D/g, "");
  if (d.length < 7) return "";
  const intl = main.trim().startsWith("+");
  const number = intl ? `+${d}` : d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : d;
  return `tel:${number}${ext ? `;ext=${ext[1]}` : ""}`;
}

/** What a phone field stores: the digits, with a leading + kept for an international number. */
export function phoneDigits(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  const d = raw.replace(/\D/g, "");
  return raw.startsWith("+") && !raw.startsWith("+1") ? `+${d}` : d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** Masked ("***0101") and US numbers ("+1 555 014 2231", "555-014-2231") inside a sentence, formatted. */
const IN_TEXT = /[*•]{3,}\d{4}\b|(?<![\w+])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\+1\d{10}\b/g;
export function formatPhonesIn(text: string | null | undefined): string {
  return String(text ?? "").replace(IN_TEXT, (m) => formatPhone(m));
}
