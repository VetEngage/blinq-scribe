import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useSession } from "../api/session";
import type { AuthStatus, Health } from "../api/types";
import { clearFragment, takeFragment } from "../state/start";
import {
  Alert,
  Banner,
  BrandMark,
  Button,
  Card,
  CheckboxField,
  FormError,
  FormField,
  Tag,
  TextField,
} from "@blinq-scribe/ui";

type Step =
  | { kind: "password" }
  | { kind: "code"; challenge: string; sentTo: string; method: "app" | "email" }
  | { kind: "forgot" }
  | { kind: "forgotSent" };

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Sign in (requirement 57): email and password, Remember me, Forgot password, Google and Microsoft when set up, then the 6 digit code. */
export function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [remember, setRemember] = useState(false);
  const flash = (location.state as { message?: string } | null)?.message === "signedOut" ? t("signin.signedOut") : "";

  const [oauthError, setOauthError] = useState("");
  useEffect(() => {
    api
      .authStatus()
      .then(setStatus)
      .catch(() => setStatus({ login_required: true }));
    api
      .health()
      .then(setHealth)
      .catch(() => undefined);
    // Back from Google or Microsoft with a one-time code to trade for a session.
    // A sign in with Google or Microsoft that the server turned down.
    const refused = takeFragment("oauth_error");
    if (refused) {
      clearFragment("oauth_error");
      setOauthError(refused);
    }
    const code = takeFragment("oauth");
    if (code) {
      clearFragment("oauth");
      api
        .finishOAuth(code)
        .then((r) =>
          r.kind === "signed_in"
            ? finish(r.token)
            : setStep({ kind: "code", challenge: r.challenge, sentTo: r.sent_to, method: r.method }),
        )
        .catch((err: unknown) => setOauthError(errMsg(err)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oauth = async (provider: "google" | "microsoft") => {
    setOauthError("");
    try {
      window.location.assign(await api.startOAuth(provider, remember));
    } catch (err) {
      setOauthError(errMsg(err));
    }
  };

  const finish = (token: string) => {
    useSession.getState().setToken(token, remember);
    void navigate("/", { replace: true });
  };

  const demo = status?.demo ?? health?.practice === "mock";

  return (
    <div className="gate">
      <Card className="gap-4">
        <div className="row nowrap gap-3">
          <BrandMark name={t("app.name")} />
        </div>
        {step.kind === "password" && (
          <PasswordStep
            flash={oauthError || flash}
            remember={remember}
            setRemember={setRemember}
            onDone={finish}
            onCode={(challenge, sentTo, method) => setStep({ kind: "code", challenge, sentTo, method })}
            onForgot={status?.password_reset ? () => setStep({ kind: "forgot" }) : undefined}
          />
        )}
        {step.kind === "code" && (
          <CodeStep
            challenge={step.challenge}
            sentTo={step.sentTo}
            method={step.method}
            demo={!!status?.demo}
            onDone={finish}
            onBack={() => setStep({ kind: "password" })}
          />
        )}
        {(step.kind === "forgot" || step.kind === "forgotSent") && (
          <ForgotStep
            sent={step.kind === "forgotSent"}
            onSent={() => setStep({ kind: "forgotSent" })}
            onBack={() => setStep({ kind: "password" })}
          />
        )}
        {step.kind === "password" && (status?.google || status?.microsoft) && (
          <>
            <div className="or-rule" role="separator">
              {t("signin.or")}
            </div>
            {status.google && (
              <Button size="lg" icon="account_circle" fullWidth onClick={() => void oauth("google")}>
                {t("signin.google")}
              </Button>
            )}
            {status.microsoft && (
              <Button size="lg" icon="window" fullWidth onClick={() => void oauth("microsoft")}>
                {t("signin.microsoft")}
              </Button>
            )}
          </>
        )}
        {step.kind === "password" && demo && (
          <DemoButton loginRequired={status?.login_required ?? true} onDone={finish} />
        )}
        {step.kind === "password" && <span className="text-meta">{t("signin.inviteOnly")}</span>}
      </Card>
    </div>
  );
}

const passwordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "signin.emailRequired")
    .regex(/^[^\s@]+(@[^\s@]+\.[^\s@]+)?$/, "signin.emailInvalid"),
  password: z.string().min(1, "signin.passwordRequired"),
});
type PasswordForm = z.infer<typeof passwordSchema>;

function PasswordStep({
  flash,
  remember,
  setRemember,
  onDone,
  onCode,
  onForgot,
}: {
  flash: string;
  remember: boolean;
  setRemember: (v: boolean) => void;
  onDone: (token: string) => void;
  onCode: (challenge: string, sentTo: string, method: "app" | "email") => void;
  onForgot?: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const submit = handleSubmit(async ({ email, password }) => {
    setError("");
    try {
      const r = await api.signIn(email, password, remember);
      if (r.kind === "signed_in") onDone(r.token);
      else onCode(r.challenge, r.sent_to, r.method);
    } catch (err) {
      setError(errMsg(err));
    }
  });
  const fieldError = (key?: string) => (key ? t(key as "signin.emailRequired") : "");
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
      <h1 className="text-title">{t("signin.subtitle")}</h1>
      <FormField id="email" label={t("signin.login")} error={fieldError(errors.email?.message) || undefined}>
        <TextField type="text" inputMode="email" autoComplete="username" autoFocus {...register("email")} />
      </FormField>
      <FormField id="password" label={t("signin.password")} error={fieldError(errors.password?.message) || undefined}>
        <TextField type="password" autoComplete="current-password" {...register("password")} />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <CheckboxField
          id="remember"
          className="text-meta"
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
          label={t("signin.remember")}
        />
        {/* Forgot password only where the server can email a reset link. */}
        {onForgot && (
          <Button variant="link" onClick={onForgot}>
            {t("signin.forgot")}
          </Button>
        )}
      </div>
      <FormError>{error || flash}</FormError>
      <Button type="submit" variant="primary" size="lg" icon="login" disabled={isSubmitting}>
        {t("signin.submit")}
      </Button>
    </form>
  );
}

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "signin.codeInvalid"),
});

function CodeStep({
  challenge,
  sentTo,
  method: firstMethod,
  demo,
  onDone,
  onBack,
}: {
  challenge: string;
  sentTo: string;
  method: "app" | "email";
  demo: boolean;
  onDone: (token: string) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState(challenge);
  const [resent, setResent] = useState(false);
  // An authenticator app first; "Email me a code" switches to the emailed backup code.
  const [method, setMethod] = useState(firstMethod);
  const [to, setTo] = useState(sentTo);
  const resend = async () => {
    setError("");
    try {
      const r = await api.resendCode(ticket);
      if (r.kind === "code_needed") {
        if (r.challenge) setTicket(r.challenge);
        if (r.sent_to) setTo(r.sent_to);
      }
      setMethod("email");
      setResent(true);
    } catch (err) {
      setError(errMsg(err));
    }
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ code: string }>({ resolver: zodResolver(codeSchema) });
  const submit = handleSubmit(async ({ code }) => {
    setError("");
    try {
      onDone(await api.verifyCode(ticket, code));
    } catch (err) {
      setError(errMsg(err));
    }
  });
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
      <h1 className="text-display">{method === "app" ? t("signin.appTitle") : t("signin.codeTitle")}</h1>
      <p className="muted">
        {method === "app" ? t("signin.appHelp") : to ? t("signin.codeHelp", { to }) : t("signin.codeHelpNoTo")}
      </p>
      {demo && method === "email" && <Alert icon="terminal">{t("signin.demoCode")}</Alert>}
      <FormField id="code" label={t("signin.code")} error={(errors.code ? t("signin.codeInvalid") : "") || undefined}>
        <TextField
          size="lg"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          num
          className="text-center"
          autoFocus
          {...register("code")}
        />
      </FormField>
      <FormError>{error}</FormError>
      <Button type="submit" variant="primary" size="lg" icon="verified_user" disabled={isSubmitting}>
        {t("signin.verify")}
      </Button>
      <div className="flex items-center justify-between gap-3">
        <Button variant="link" onClick={() => void resend()} disabled={resent}>
          {resent ? t("signin.codeResent") : method === "app" ? t("signin.emailInstead") : t("signin.resend")}
        </Button>
        <Button variant="link" onClick={onBack}>
          {t("signin.back")}
        </Button>
      </div>
    </form>
  );
}

const forgotSchema = z.object({ email: z.string().trim().min(1, "signin.emailRequired") });

function ForgotStep({ sent, onSent, onBack }: { sent: boolean; onSent: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema) });
  const submit = handleSubmit(async ({ email }) => {
    setError("");
    try {
      await api.forgotPassword(email);
      onSent();
    } catch (err) {
      setError(errMsg(err));
    }
  });
  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-display">{t("signin.forgotTitle")}</h1>
        <Banner icon="mark_email_read">{t("signin.forgotSent")}</Banner>
        <Button variant="link" onClick={onBack}>
          {t("signin.back")}
        </Button>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
      <h1 className="text-display">{t("signin.forgotTitle")}</h1>
      <p className="muted">{t("signin.forgotHelp")}</p>
      <FormField
        id="forgotEmail"
        label={t("signin.email")}
        error={(errors.email ? t("signin.emailRequired") : "") || undefined}
      >
        <TextField type="text" inputMode="email" autoComplete="username" autoFocus {...register("email")} />
      </FormField>
      <FormError>{error}</FormError>
      <Button type="submit" variant="primary" size="lg" icon="send" disabled={isSubmitting}>
        {t("signin.sendLink")}
      </Button>
      <Button variant="link" onClick={onBack}>
        {t("signin.back")}
      </Button>
    </form>
  );
}

function DemoButton({ loginRequired, onDone }: { loginRequired: boolean; onDone: (token: string) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setError("");
    // Before anyone has an account the console is an open demo, so there is nothing to sign in to.
    if (!loginRequired) {
      void navigate("/", { replace: true });
      return;
    }
    setBusy(true);
    try {
      onDone(await api.demoSignIn());
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };
  return (
    <section className="demo-card" aria-labelledby="demoTitle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b id="demoTitle" className="text-body-strong">{t("signin.demoTitle")}</b>
        <Tag icon="science">{t("signin.demoMode")}</Tag>
      </div>
      <p className="text-meta">{t("signin.demoHelp")}</p>
      <div>
        <Button variant="link" icon="arrow_forward" loading={busy} disabled={busy} onClick={() => void go()}>
          {t("signin.demo")}
        </Button>
      </div>
      <FormError>{error}</FormError>
    </section>
  );
}
