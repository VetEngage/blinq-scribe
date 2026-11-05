import { useMemo, useState } from "react";
import { encode } from "uqr";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { User } from "../../api/types";
import { Button, Dialog, FormError, FormField, Icon, TextField } from "@blinq-scribe/ui";

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The otpauth:// link as a QR code, drawn as plain SVG squares (no HTML from strings). */
function QrCode({ value, label }: { value: string; label: string }) {
  const qr = useMemo(() => encode(value, { border: 2 }), [value]);
  const path = useMemo(
    () =>
      qr.data
        .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")))
        .filter(Boolean)
        .join(""),
    [qr],
  );
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      width={176}
      height={176}
      shapeRendering="crispEdges"
      className="theme-light rounded-tile border border-border bg-surface p-2 text-text"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/** Groups of four, so the secret can be typed into an app by hand. */
const spaced = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/**
 * Two step sign in with an authenticator app: the row in Account, and the setup. Setup asks for the
 * password, shows what to add to the app, then checks one code from it before anything changes.
 */
export function AuthenticatorRow({
  user,
  readOnly,
  onSaved,
}: {
  user: User;
  readOnly: boolean;
  onSaved: (u: User, message: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"password" | "code">("password");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = !!user.authenticator;

  const reset = () => {
    setStep("password");
    setPassword("");
    setSetup(null);
    setCode("");
    setError("");
  };
  const begin = async () => {
    setBusy(true);
    setError("");
    try {
      setSetup(await api.startAuthenticator(password));
      setPassword("");
      setStep("code");
    } catch (err) {
      setError(errText(err));
    }
    setBusy(false);
  };
  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const u = await api.confirmAuthenticator(code.replace(/\s/g, ""));
      setOpen(false);
      reset();
      onSaved(u, t("account.appOn"));
    } catch (err) {
      setError(errText(err));
    }
    setBusy(false);
  };

  return (
    <div className="auth-row">
      <Icon name="phone_iphone" className="text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-body-strong">{t("account.appTitle")}</b>
        <span className="text-meta">{on ? t("account.appOnHelp") : t("account.appOffHelp")}</span>
      </span>
      {!readOnly && (
        <Button
          variant="link"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          {on ? t("account.appAgain") : t("account.appSetUp")}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        title={t("account.appSetupTitle")}
        closeLabel={t("account.cancel")}
        size="sm"
      >
        {step === "password" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void begin();
            }}
          >
            <p className="text-meta">{t("account.appPasswordHelp")}</p>
            {user.has_password && (
              <FormField id="appPassword" label={t("account.currentPassword")}>
                <TextField
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>
            )}
            <FormError>{error}</FormError>
            <div>
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={busy || (user.has_password && !password)}
              >
                {t("account.appContinue")}
              </Button>
            </div>
          </form>
        ) : (
          setup && (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              <ol className="steps-list">
                <li>{t("account.appStep1")}</li>
                <li>
                  {t("account.appStepScan")}
                  <span className="mt-2 block">
                    <QrCode value={setup.otpauth_uri} label={t("account.appQr")} />
                  </span>
                </li>
                <li>
                  {t("account.appStep2")}
                  <span className="font-num mt-1 block break-all select-all" aria-label={t("account.appSecret")}>
                    {spaced(setup.secret)}
                  </span>
                  <a href={setup.otpauth_uri}>{t("account.appOpen")}</a>
                </li>
                <li>{t("account.appStep3")}</li>
              </ol>
              <FormField id="appCode" label={t("account.appCode")}>
                <TextField
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  num
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </FormField>
              <FormError>{error}</FormError>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  icon="verified_user"
                  loading={busy}
                  disabled={busy || code.replace(/\s/g, "").length !== 6}
                >
                  {t("account.appConfirm")}
                </Button>
              </div>
            </form>
          )
        )}
      </Dialog>
    </div>
  );
}
