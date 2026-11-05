import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { radius, shadow, type } from "@blinq-scribe/tokens";

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// tailwind-merge needs our token names, or it reads a type role (`text-meta`) as a color and drops
// it next to `text-text-secondary`. `font-num` is a family, so it replaces `font-sans`.
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: Object.keys(type).map(kebab),
      radius: Object.keys(radius).map(kebab),
      shadow: Object.keys(shadow).map(kebab),
      font: ["num"],
    },
  },
});

/** Joins class names, skipping the empty ones; a later class wins over an earlier one it conflicts with. */
export const cx = (...parts: ClassValue[]): string => merge(clsx(parts));

export type Tone = "neutral" | "success" | "warning" | "error" | "ai";

/** Text and tint for each status tone, used by tags, pills, alerts and tiles alike. */
export const toneClass: Record<Tone, string> = {
  neutral: "bg-divider text-text-secondary",
  success: "bg-selected text-primary",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  ai: "bg-ai-bg text-ai",
};
