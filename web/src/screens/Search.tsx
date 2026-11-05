import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { api } from "../api";
import type { SearchResults } from "../api/types";
import { useApp } from "../state/app";
import { useOpen } from "../state/open";
import { useRecent, type RecentPatient } from "../state/recent";
import { dayName, monthDay, petFacts, ymd } from "../lib/format";
import { Avatar, Dialog, DialogClose, formatTime, Icon, Pressable, TextField, formatPhone } from "@blinq-scribe/ui";

const useSearchUi = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/** "9:40 AM" today, "Yesterday", else "Oct 30". */
function openedAt(at: string, today: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const day = ymd(d);
  if (day === today) return formatTime(d);
  return dayName(day, today) || monthDay(day);
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Top bar search: Cmd K or Ctrl K anywhere in the console. */
export function SearchTrigger() {
  const { t } = useTranslation();
  const setOpen = useSearchUi((s) => s.setOpen);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setOpen(!useSearchUi.getState().open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
  return (
    <Pressable
      className="search-trigger"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      onClick={() => setOpen(true)}
    >
      <Icon name="search" />
      <span className="lbl">{t("topbar.search")}</span>
      <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
    </Pressable>
  );
}

type Result =
  | { type: "pet"; item: SearchResults["pets"][number] }
  | { type: "owner"; item: SearchResults["owners"][number] }
  | { type: "recent"; item: RecentPatient };

export function SearchDialog() {
  const { t } = useTranslation();
  const { open, setOpen } = useSearchUi();
  const go = useOpen();
  const today = useApp((s) => s.today);
  const appts = useApp((s) => s.appts);
  const viewDate = useApp((s) => s.viewDate);
  const recent = useRecent((s) => s.list);
  const [text, setText] = useState("");
  // null: nothing typed yet; false: search failed
  const [results, setResults] = useState<SearchResults | null | false>(null);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setText("");
      setResults(null);
      setActive(-1);
    }
  }, [open]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setResults(null);
      setActive(-1);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      api
        .search(q)
        .catch(() => false as const)
        .then((r) => {
          if (mine !== seq.current) return;
          setResults(r);
          setActive(r && (r.pets.length || r.owners.length) ? 0 : -1);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [text]);

  // Before anything is typed: the records opened lately, else today's patients.
  const todays: RecentPatient[] =
    viewDate === today
      ? appts.map((a) => ({
          id: a.patient.id,
          client_id: a.patient.client_id || a.client.id,
          name: a.patient.name,
          species: a.patient.species,
          breed: a.patient.breed,
          owner_name: [a.client.first_name, a.client.last_name].filter(Boolean).join(" "),
          at: "",
        }))
      : [];
  const recents: Result[] = (recent.length ? recent : todays).slice(0, 5).map((item) => ({ type: "recent", item }));
  const list: Result[] = results
    ? [
        ...results.pets.map((item) => ({ type: "pet" as const, item })),
        ...results.owners.map((item) => ({ type: "owner" as const, item })),
      ]
    : results === null && !text.trim()
      ? recents
      : [];
  const petCount = results ? results.pets.length : list.length;

  // Recent patients are there to pick with the arrow keys from the start.
  useEffect(() => {
    if (open && !text.trim()) setActive(list.length ? 0 : -1);
    // Only when the dialog opens or the field empties.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, text === ""]);

  useEffect(() => {
    if (active >= 0) listRef.current?.querySelector(`#sr-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (r: Result | undefined) => {
    if (!r) return;
    setOpen(false);
    if (r.type === "pet") void go.patient(r.item);
    else if (r.type === "recent") void go.patient(r.item);
    else go.household(r.item.id);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!list.length) return;
      setActive((a) => (a + (ev.key === "ArrowDown" ? 1 : -1) + list.length) % list.length);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      pick(list[active]);
    }
  };

  const option = (r: Result, i: number) => {
    const selected = i === active;
    if (r.type === "recent") {
      const it = r.item;
      return (
        <div
          key={`r-${it.id}`}
          role="option"
          id={`sr-${i}`}
          aria-selected={selected}
          className="result-opt"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(r)}
        >
          <Avatar icon="pets" size={32} />
          <span className="text">
            <b>{it.name}</b>
            <span className="text-meta">{[it.breed, it.owner_name].filter(Boolean).join(" · ")}</span>
          </span>
          {it.at && <span className="side">{t("search.opened", { when: openedAt(it.at, today) })}</span>}
        </div>
      );
    }
    if (r.type === "pet") {
      const it = r.item,
        nv = it.next_visit;
      const next = nv
        ? nv.date === today
          ? t("search.todayAt", { time: formatTime(nv.time) })
          : t("search.next", { date: monthDay(nv.date) })
        : "";
      return (
        <div
          key={`p-${it.id}`}
          role="option"
          id={`sr-${i}`}
          aria-selected={selected}
          className="result-opt"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(r)}
        >
          <Avatar icon="pets" size={32} />
          <span className="text">
            <b>{it.name}</b>
            <span className="text-meta">{[petFacts(it), it.owner_name].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="side">
            {next}
            {next && it.last_visit ? <br /> : null}
            {it.last_visit ? t("search.last", { date: monthDay(it.last_visit.date) }) : ""}
          </span>
        </div>
      );
    }
    const it = r.item;
    return (
      <div
        key={`o-${it.id}`}
        role="option"
        id={`sr-${i}`}
        aria-selected={selected}
        className="result-opt"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pick(r)}
      >
        <Avatar icon="person" />
        <span className="text">
          <b>{it.name}</b>
          <span className="text-meta">
            {[
              formatPhone(it.phone),
              it.pets.length
                ? t("search.petsList", { pets: t("count.pet", { count: it.pets.length }), names: it.pets.join(", ") })
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      placement="top"
      title={t("search.dialog")}
      closeLabel={t("search.close")}
    >
      <div className="search-box">
        <Icon name="search" className="muted" />
        <TextField
          bare
          id="searchInput"
          aria-label={t("topbar.search")}
          placeholder={t("topbar.search")}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={list.length > 0}
          aria-controls="searchList"
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `sr-${active}` : undefined}
        />
        <DialogClose label={t("search.close")} />
      </div>
      <div id="searchList" ref={listRef} className="search-list" role="listbox" aria-label={t("search.results")}>
        {results === null ? (
          list.length ? (
            <>
              <div className="search-group" role="presentation">
                {recent.length ? t("search.recent") : t("search.todaysPatients")}
              </div>
              {list.map((r, i) => option(r, i))}
            </>
          ) : (
            <p className="text-meta px-2 py-3">{t("search.type")}</p>
          )
        ) : results === false ? (
          <p className="text-meta px-2 py-3">{t("search.unavailable")}</p>
        ) : !list.length ? (
          <p className="text-meta px-2 py-3">{t("search.none")}</p>
        ) : (
          <>
            {petCount > 0 && (
              <div className="search-group" role="presentation">
                {t("search.pets")}
              </div>
            )}
            {list.slice(0, petCount).map((r, i) => option(r, i))}
            {list.length > petCount && (
              <div className="search-group" role="presentation">
                {t("search.owners")}
              </div>
            )}
            {list.slice(petCount).map((r, i) => option(r, petCount + i))}
          </>
        )}
      </div>
      <div className="search-foot">
        {/* Says what Enter opens: the selected result is a pet or an owner. */}
        <span>{active >= petCount ? t("search.enterOwner") : t("search.enter")}</span>
        <span>{t("search.by")}</span>
      </div>
    </Dialog>
  );
}
