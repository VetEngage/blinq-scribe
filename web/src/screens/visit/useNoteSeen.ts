import { useCallback, useEffect, useRef } from "react";
import { ACTION_BAR_HEIGHT } from "@blinq-scribe/ui";

// A household pet's note is reviewed once the provider saw all of it, never just by opening its tab:
// the end of the note scrolled into view, or every section of it in view at some point. The pinned bar
// covers the bottom of the page, so what is under it isn't seen.

/** The note's sections, in the order it reads, and its end. */
const SECTIONS = "#noteCard .note-sec";
export const NOTE_END = "noteEnd";

/** How much of the window the pinned bar covers, so a line under it isn't counted as seen. */
function barHeight(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(ACTION_BAR_HEIGHT)) || 0;
}

/** Whether an element is in view now, above the pinned bar. */
function inView(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const bottom = window.innerHeight - barHeight();
  return r.bottom > 0 && r.top < bottom && r.height >= 0;
}

/**
 * Watch the note on screen (`key`, its encounter) while `on`: calls `onSeen` once the provider has seen
 * all of it. `firstUnseen` is the first section not seen yet (for the green action to scroll to), and
 * `endInView` says whether the note's end is on screen now.
 */
export function useNoteSeen(on: boolean, key: string, onSeen: () => void) {
  const seen = useRef(new Set<string>());
  const done = useRef(false);
  const said = useRef(onSeen);
  said.current = onSeen;

  useEffect(() => {
    seen.current = new Set();
    done.current = false;
  }, [key]);

  useEffect(() => {
    if (!on || typeof IntersectionObserver === "undefined") return;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      said.current();
    };
    const sections = [...document.querySelectorAll<HTMLElement>(SECTIONS)];
    const end = document.getElementById(NOTE_END);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const x of entries) {
          if (!x.isIntersecting) continue;
          if (x.target === end) return finish();
          // Seen: half of it in view, or as much of it as fits on the screen.
          const room = (x.rootBounds?.height ?? window.innerHeight) * 0.5;
          if (x.intersectionRatio >= 0.5 || x.intersectionRect.height >= room) seen.current.add(x.target.id);
        }
        if (sections.length && sections.every((s) => seen.current.has(s.id))) finish();
      },
      { rootMargin: `0px 0px -${Math.round(barHeight())}px 0px`, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    if (end) observer.observe(end);
    return () => observer.disconnect();
  }, [on, key]);

  const firstUnseen = useCallback((): HTMLElement | null => {
    const sections = [...document.querySelectorAll<HTMLElement>(SECTIONS)];
    return sections.find((s) => !seen.current.has(s.id) && !inView(s)) ?? null;
  }, []);
  const endInView = useCallback(() => inView(document.getElementById(NOTE_END)), []);
  return { firstUnseen, endInView };
}
