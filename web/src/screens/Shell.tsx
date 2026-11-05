import { useEffect, useRef } from "react";
import { ConsentDialog } from "./visit/consent";
import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router";
import { useTranslation } from "react-i18next";
import { myProviderId, useApp } from "../state/app";
import { bumpNav } from "../state/nav";
import { signOut } from "../state/session";
import { useTheme, type ThemeChoice } from "../state/theme";
import { useRecorder } from "../recorder/store";
import { stopCamera } from "../recorder/camera";
import { stopSpeech } from "../lib/speak";
import { LeftColumn } from "./LeftColumn";
import { SearchDialog, SearchTrigger } from "./Search";
import { AskBlinq, AskBlinqPill } from "./AskBlinq";
import { initials, wdMonthDay } from "../lib/format";
import {
  Alert,
  Avatar,
  Banner,
  BrandMark,
  Button,
  DropdownMenu,
  Icon,
  Pressable,
  StatusPill,
  ToastOutlet,
  formatPhonesIn,
} from "@blinq-scribe/ui";
import { useShallow } from "zustand/react/shallow";

let lastKey = "";

export function Shell() {
  const location = useLocation();
  // Read in the effect below, which runs only when the address changes, not when this does.
  const navigationType = useNavigationType();
  const navType = useRef(navigationType);
  navType.current = navigationType;
  // Every navigation bumps the one navigation token, before the new screen renders, so anything the
  // last screen still had on its way is dropped instead of landing here.
  if (location.key !== lastKey) {
    lastKey = location.key;
    bumpNav();
  }
  const screen = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    // Leaving a visit stops the mic. Each chunk already recorded still goes to its own visit.
    useRecorder.getState().stop();
    stopCamera();
    stopSpeech();
    // Moving to another screen starts at the top; stacked on a phone, the screen sits under the schedule.
    const el = screen.current;
    if (!el) return;
    el.scrollTop = 0;
    if (first.current) {
      first.current = false;
      return;
    }
    // A replace is the app moving the vet on by itself (the first open landing on Morning), not the vet
    // going somewhere: the page stays put, so the top bar under their thumb doesn't scroll away.
    if (navType.current === "REPLACE") return;
    if (window.matchMedia("(max-width:1100px)").matches) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <>
      <Topbar />
      <main className="layout">
        <LeftColumn />
        <section className="col screen" ref={screen}>
          <ViewingBanner />
          <Notice />
          <Outlet />
        </section>
      </main>
      <SearchDialog />
      <AskBlinq />
      <ConsentDialog />
    </>
  );
}

/**
 * The top bar: the name (home), search (⌘K), Ask Blinq (⌘J, with its mic), the toasts, the clinic, whose
 * day it is (which also holds Today and End of day), and the account menu. Every control keeps its
 * words; on a narrow screen the clinic moves into the account menu.
 */
export function Topbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, health, doctors } = useApp(useShallow((s) => ({ me: s.me, health: s.health, doctors: s.doctors })));
  const sms = String(health?.sms ?? "");
  const { choice: theme, setChoice: setTheme } = useTheme();
  // The open demo has no one signed in: it acts as the demo clinic's vet (the first doctor).
  const mine = myProviderId(me, doctors);
  const who = me?.user?.name || doctors.find((d) => d.id === mine)?.name || "";
  const clinic = health
    ? t("topbar.status", {
        ai: health.ai === "mock" ? t("topbar.mockAi") : t("topbar.muse"),
        practice: health.practice === "mock" ? t("topbar.demoClinicLower") : t("topbar.livePracticeLower"),
      })
    : "";

  return (
    <header className="topbar">
      <Pressable className="brand-home" aria-label={t("topbar.home")} onClick={() => void navigate("/")}>
        <BrandMark name={t("app.name")} nameClassName="brand" />
      </Pressable>
      <SearchTrigger />
      <AskBlinqPill />
      {/* Toasts show here, in the bar, so they never cover the page. */}
      <ToastOutlet className="topbar-toast" />
      {/* One pill for what runs this console; the texting mode is in the account menu. */}
      <span className="health">
        {!health ? (
          <StatusPill status="pending">{t("topbar.connecting")}</StatusPill>
        ) : (
          <StatusPill status={!health.ok ? "error" : health.ai === "mock" ? "demo" : "ok"}>{clinic}</StatusPill>
        )}
      </span>
      <DayMenu />
      {me && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Pressable
              className="avatar-menu"
              aria-label={
                who ? t("topbar.accountMenuInitials", { initials: initials(who), name: who }) : t("topbar.accountMenu")
              }
            >
              <Avatar initials={who ? initials(who) : undefined} icon={who ? undefined : "person"} size={36} />
            </Pressable>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {me.user && <DropdownMenu.Label>{me.user.name}</DropdownMenu.Label>}
            {clinic && <DropdownMenu.Label className="menu-clinic">{clinic}</DropdownMenu.Label>}
            {health && (
              <DropdownMenu.Label>
                <Icon name="sms" />{" "}
                {sms.startsWith("demo to")
                  ? t("topbar.textsTo", { to: formatPhonesIn(sms.replace("demo to ", "")) })
                  : sms === "preview"
                    ? t("topbar.textsPreview")
                    : t("topbar.textsOff")}
              </DropdownMenu.Label>
            )}
            <DropdownMenu.Separator />
            <DropdownMenu.Label>{t("topbar.theme")}</DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeChoice)}>
              <DropdownMenu.RadioItem value="light" icon="light_mode">
                {t("topbar.themeLight")}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="dark" icon="dark_mode">
                {t("topbar.themeDark")}
              </DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="system" icon="contrast">
                {t("topbar.themeSystem")}
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator />
            {me.admin && (
              <DropdownMenu.Item icon="group" onSelect={() => void navigate("/team")}>
                {t("topbar.team")}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item icon="manage_accounts" onSelect={() => void navigate("/account")}>
              {t("account.open")}
            </DropdownMenu.Item>
            {me.user && (
              <DropdownMenu.Item icon="logout" onSelect={() => void signOut().then(() => navigate("/sign-in"))}>
                {t("topbar.signOut")}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </header>
  );
}

/** "Dr. Sam Okafor" reads as "Dr. Okafor" where space is short. */
const shortName = (name: string) => (/^Dr\.?\s/i.test(name) ? `Dr. ${name.trim().split(/\s+/).pop() ?? ""}` : name);

/**
 * Whose day, by name ("Dr. Ana Rivera's day", never "My day"), and the day's two places: Today and End
 * of day. A vet opens on their own day and can look at a colleague's, view only; front office and admins
 * see all providers or one. The server scopes and checks the same way.
 */
export function DayMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onEndOfDay = useLocation().pathname === "/end-of-day";
  const { me, doctors, provider, setProvider, busyDay, viewDate, today } = useApp(
    useShallow((s) => ({
      me: s.me,
      doctors: s.doctors,
      provider: s.provider,
      setProvider: s.setProvider,
      busyDay: s.health?.busy_day ?? "",
      viewDate: s.viewDate,
      today: s.today,
    })),
  );
  // A vet signed in, and the open demo acting as its vet, open on their own day.
  const open = me?.via === "open";
  const vet = me?.role === "vet" || (open && !!doctors.length);
  const mine = myProviderId(me, doctors);
  // A signed-in vet's "" is their own day (the server scopes it); the open demo's "" is every vet.
  const value = vet && !open && !provider ? mine : provider;
  const doctor = doctors.find((d) => d.id === value);
  // Another vet's day is view only for a vet; the open demo can work on every visit, so it isn't marked.
  const viewOnly = vet && !open && !!value && value !== mine;
  const dayOf = (name: string) => t("topbar.theirDay", { name });
  const label = doctor ? dayOf(doctor.id === mine ? doctor.name : shortName(doctor.name)) : t("topbar.allDoctors");
  const ordered = vet ? [...doctors.filter((d) => d.id === mine), ...doctors.filter((d) => d.id !== mine)] : doctors;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button className="day-menu" iconClassName="text-text-secondary" icon="calendar_today" iconEnd="expand_more">
          <span className="truncate">{label}</span>
          {viewOnly && <span className="text-meta">{t("topbar.viewOnly")}</span>}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="min-w-[260px]">
        <DropdownMenu.Label>{t("topbar.whoseDay")}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={value} onValueChange={setProvider}>
          {ordered.map((d) => (
            <DropdownMenu.RadioItem key={d.id} value={d.id}>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate">{dayOf(d.name)}</span>
                {vet && !open && d.id !== mine && <span className="text-meta">{t("topbar.viewOnly")}</span>}
              </span>
            </DropdownMenu.RadioItem>
          ))}
          {(!vet || open) && <DropdownMenu.RadioItem value="">{t("topbar.allDoctors")}</DropdownMenu.RadioItem>}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          icon="today"
          onSelect={() => {
            if (viewDate !== today) void useApp.getState().goToDay(today);
            void navigate("/");
          }}
        >
          {t("topbar.today")}
        </DropdownMenu.Item>
        {/* The demo clinic's heavy day (20 visits, 24 pets), always a set number of days after today. */}
        {busyDay && (
          <DropdownMenu.Item
            icon="event_upcoming"
            aria-current={viewDate === busyDay}
            onSelect={() => {
              void useApp.getState().goToDay(busyDay);
              void navigate("/");
            }}
          >
            {t("topbar.busyDemoDay", { date: wdMonthDay(busyDay) })}
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item icon="checklist" onSelect={() => void navigate("/end-of-day")} aria-current={onEndOfDay}>
          {t("topbar.endOfDay")}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/** A vet looking at a colleague's day: say so, and the way back. */
export function ViewingBanner() {
  const { t } = useTranslation();
  const { me, doctors, provider, setProvider } = useApp(
    useShallow((s) => ({ me: s.me, doctors: s.doctors, provider: s.provider, setProvider: s.setProvider })),
  );
  const mine = me?.provider_id ?? "";
  if (me?.role !== "vet" || !provider || provider === mine) return null;
  const name = doctors.find((d) => d.id === provider)?.name ?? t("topbar.anotherVet");
  return (
    <Alert
      icon="visibility"
      action={
        <Button icon="arrow_back" onClick={() => setProvider(mine)}>
          {t("topbar.backToMyDay")}
        </Button>
      }
    >
      <b>{t("topbar.viewingTitle", { name })}</b> {t("topbar.viewingHelp", { name })}
    </Alert>
  );
}

function Notice() {
  const { t } = useTranslation();
  const notice = useApp((s) => s.notice);
  if (!notice) return null;
  return (
    <Banner
      icon="info"
      action={
        <Button variant="link" size="sm" onClick={() => useApp.setState({ notice: "" })}>
          {t("signin.dismiss")}
        </Button>
      }
    >
      {notice}
    </Banner>
  );
}
