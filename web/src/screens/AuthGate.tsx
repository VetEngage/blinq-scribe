import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { api, ApiError, onSignedOut } from "../api";
import { useApp } from "../state/app";
import { endSession } from "../state/session";
import { keepReturnPath, takeReturnPath } from "../state/visitMemory";
import { resumeRecordingSession } from "../recorder/store";
import { fragmentRoute, startApp } from "../state/start";
import { BrandMark, StatusPill } from "@blinq-scribe/ui";

/** Signed in, or on the way to the sign in page. Holds the console until we know who this is. */
export function AuthGate() {
  const { t } = useTranslation();
  const me = useApp((s) => s.me);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");

  useEffect(() => {
    onSignedOut(() => {
      const me = useApp.getState().me;
      if (!me) return;
      // The session ended on its own: signing back in returns to this page, with the draft and the
      // recording kept (D2). Sign, send and text all wait for that.
      const who = me.user?.username || me.via;
      keepReturnPath(`${window.location.pathname}${window.location.search}`);
      endSession(who);
      void navigate("/sign-in", { state: { message: "signedOut" } });
    });
    const onHash = () => {
      const to = fragmentRoute();
      if (to) void navigate(to);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [navigate]);

  // The first visit to the console (and the first after a sign in) checks the session; later
  // navigations reuse it. Setting `me` re-renders this gate, so the check must not cancel itself then.
  const checking = useRef(false);
  useEffect(() => {
    if (me || checking.current) return;
    const to = fragmentRoute();
    if (to) {
      void navigate(to, { replace: true });
      return;
    }
    checking.current = true;
    api
      .me()
      .then(async (m) => {
        await startApp(m);
        const who = m.user?.username || m.via;
        resumeRecordingSession(who);
        const back = takeReturnPath(who);
        if (back && back !== `${window.location.pathname}${window.location.search}`)
          void navigate(back, { replace: true });
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) void navigate("/sign-in", { replace: true });
        else setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        checking.current = false;
      });
  }, [me, location.pathname, navigate]);

  if (me) return <Outlet />;
  return (
    <header className="topbar">
      <BrandMark name={t("app.name")} nameClassName="brand" />
      <span className="flex-1" />
      {error ? (
        <StatusPill status="error">{t("app.offline", { message: error })}</StatusPill>
      ) : (
        <StatusPill status="pending">{t("topbar.connecting")}</StatusPill>
      )}
    </header>
  );
}
