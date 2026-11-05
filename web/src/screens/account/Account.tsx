import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AuthStatus, ConnectedAccount, User } from "../../api/types";
import { useApp } from "../../state/app";
import { onScreen } from "../../state/nav";
import { endSession } from "../../state/session";
import { useNoVisit } from "../../state/useNoVisit";
import { DEMO_USERNAME, MIN_PASSWORD, passwordStrength } from "./rules";
import { VoiceSection } from "./Voice";
import { AuthenticatorRow } from "./Authenticator";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  FormError,
  FormField,
  Icon,
  KeyValueList,
  KeyValueRow,
  ListRow,
  PageHeader,
  SwitchField,
  TextField,
  useToast,
} from "@blinq-scribe/ui";

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Your account: profile, password, two-step sign in, connected accounts and sessions. */
export function AccountScreen() {
  const { t } = useTranslation();
  useNoVisit();
  const me = useApp((s) => s.me);
  const [options, setOptions] = useState<AuthStatus | null>(null);
  const toast = useToast();
  const setToast = (message: string) => toast.show(message);
  useEffect(() => {
    const here = onScreen();
    api
      .authStatus()
      .then((o) => here() && setOptions(o))
      .catch(() => undefined);
  }, []);

  const user = me?.user ?? null;
  // The demo vet sees the settings, every one locked.
  const demoVet = user?.username === DEMO_USERNAME;
  const saved = (u?: User) => {
    if (u && me) useApp.setState({ me: { ...me, user: { ...me.user, ...u } } });
  };

  return (
    <>
      <PageHeader
        eyebrow={t("account.eyebrow")}
        title={t("account.title")}
        sub={user ? `${user.name} · ${user.username}` : undefined}
      />
      {(!user || demoVet) && (
        <Alert icon="science">
          {t("account.demoNote")} {user ? t("account.demoVetLocked") : t("account.signInFirst")}
        </Alert>
      )}
      {user && (
        // The demo vet sees how settings look, but nothing in them changes.
        <fieldset disabled={demoVet} className="account-grid">
          <div className="flex min-w-0 flex-col gap-(--gap)">
            <ProfileSection
              user={user}
              emailLocked={demoVet}
              onSaved={(u) => {
                saved(u);
                setToast(t("account.profileSaved"));
              }}
            />
            <PasswordSection
              user={user}
              options={options}
              locked={demoVet}
              onSaved={() => setToast(t("account.passwordSaved"))}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-(--gap)">
            <TwoFactorSection
              user={user}
              readOnly={demoVet}
              onSaved={(u, message) => {
                saved(u);
                setToast(message ?? (u.two_factor ? t("account.twoFactorOn") : t("account.twoFactorOff")));
              }}
            />
            <ConnectedSection options={options} hasPassword={user.has_password} readOnly={demoVet} onSaved={setToast} />
            <SessionsSection readOnly={demoVet} onSaved={setToast} />
          </div>
        </fieldset>
      )}
      <VoiceSection />
    </>
  );
}

function Section({
  id,
  title,
  help,
  children,
}: {
  id: string;
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section" aria-labelledby={id}>
      <Card.Title id={id}>{title}</Card.Title>
      {help && <p className="text-meta">{help}</p>}
      {children}
    </Card>
  );
}

function ProfileSection({
  user,
  emailLocked,
  onSaved,
}: {
  user: User;
  emailLocked: boolean;
  onSaved: (u: User) => void;
}) {
  const { t } = useTranslation();
  const providers = useApp((s) => s.doctors);
  const [error, setError] = useState("");
  const schema = z
    .object({
      name: z.string().trim().min(1, "account.nameRequired").max(80, "account.nameTooLong"),
      email: z.union([z.literal(""), z.string().trim().email("account.emailInvalid")]),
      current_password: z.string(),
    })
    .refine((v) => !user.has_password || v.email.trim() === (user.email ?? "") || v.current_password.length > 0, {
      path: ["current_password"],
      message: "account.currentForEmail",
    });
  type Form = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, email: user.email ?? "", current_password: "" },
  });
  const emailChanged = watch("email").trim() !== (user.email ?? "");
  const submit = handleSubmit(async (v) => {
    setError("");
    try {
      // Only what changed goes to the server.
      const updated = await api.updateMyProfile({
        ...(v.name.trim() !== user.name ? { name: v.name.trim() } : {}),
        ...(emailChanged ? { email: v.email.trim(), current_password: v.current_password } : {}),
      });
      reset({ name: updated.name, email: updated.email ?? "", current_password: "" });
      onSaved(updated);
    } catch (err) {
      setError(errText(err));
    }
  });
  const msg = (k?: string) => (k ? t(k as "account.nameRequired") : "");
  const provider = providers.find((p) => p.id === user.provider_id)?.name || user.provider_id;
  return (
    <Section id="profileTitle" title={t("account.profile")}>
      <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
        <div className="form-grid">
          <FormField id="accName" label={t("account.name")} error={msg(errors.name?.message) || undefined}>
            <TextField type="text" maxLength={80} autoComplete="name" {...register("name")} />
          </FormField>
          <FormField id="accUsername" label={t("account.username")}>
            <TextField type="text" value={user.username} readOnly aria-readonly="true" />
          </FormField>
          <FormField
            id="accEmail"
            label={t("account.email")}
            error={msg(errors.email?.message) || undefined}
            hint={emailLocked ? t("account.demoLocked") : undefined}
          >
            <TextField disabled={emailLocked} type="email" autoComplete="email" {...register("email")} />
          </FormField>
          {emailChanged && user.has_password && (
            <FormField
              id="accEmailPassword"
              label={t("account.currentPassword")}
              error={msg(errors.current_password?.message) || undefined}
              hint={t("account.currentForEmailHelp")}
            >
              <TextField type="password" autoComplete="current-password" {...register("current_password")} />
            </FormField>
          )}
        </div>
        <KeyValueList>
          <KeyValueRow label={t("account.role")} value={user.role === "admin" ? t("team.admin") : t("team.vet")} />
          <KeyValueRow label={t("account.provider")} value={provider || t("team.notProvider")} />
        </KeyValueList>
        <p className="text-meta">{t("account.adminSets")}</p>
        <FormError>{error}</FormError>
        <div>
          <Button type="submit" variant="primary" icon="save" disabled={isSubmitting || !isDirty}>
            {t("account.saveProfile")}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection({
  user,
  options,
  locked,
  onSaved,
}: {
  user: User;
  options: AuthStatus | null;
  locked: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const schema = z
    .object({
      current: user.has_password ? z.string().min(1, "account.currentRequired") : z.string(),
      next: z.string().min(MIN_PASSWORD, "invite.tooShort"),
      confirm: z.string(),
    })
    .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "invite.mismatch" })
    .refine((v) => v.next !== v.current, { path: ["next"], message: "account.samePassword" });
  type Form = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { current: "", next: "", confirm: "" } });
  const strength = passwordStrength(watch("next"));
  const submit = handleSubmit(async (v) => {
    setError("");
    try {
      await api.changePassword(v.current, v.next);
      reset();
      onSaved();
    } catch (err) {
      setError(errText(err));
    }
  });
  const msg = (k?: string) => (k ? t(k as "invite.tooShort") : "");
  return (
    <Section
      id="passwordTitle"
      title={t("account.password")}
      help={
        // The demo vet has no password by design: only the demo notice applies.
        locked
          ? t("account.demoLocked")
          : user.has_password
            ? t("account.passwordHelp")
            : options?.password_reset
              ? `${t("account.noPassword")} ${t("account.noPasswordReset")}`
              : t("account.noPassword")
      }
    >
      {!locked && (
        <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)} noValidate>
          <fieldset disabled={locked} className="contents">
            {/* For password managers: which account this is. */}
            <span className="sr-only" aria-hidden="true">
              <TextField autoComplete="username" value={user.username} readOnly tabIndex={-1} />
            </span>
            <div className="form-grid">
              {user.has_password && (
                <>
                  <FormField
                    id="pwCurrent"
                    label={t("account.currentPassword")}
                    error={msg(errors.current?.message) || undefined}
                  >
                    <TextField type="password" autoComplete="current-password" {...register("current")} />
                  </FormField>
                  <span className="hidden md:block" />
                </>
              )}
              <FormField
                id="pwNew"
                label={t("account.newPassword")}
                hint={strength ? t(`account.strength.${strength}`) : t("account.passwordRule", { count: MIN_PASSWORD })}
              >
                <TextField type="password" autoComplete="new-password" {...register("next")} />
              </FormField>
              <FormField id="pwConfirm" label={t("invite.confirm")} error={msg(errors.confirm?.message) || undefined}>
                <TextField type="password" autoComplete="new-password" {...register("confirm")} />
              </FormField>
            </div>
            <FormError>{error}</FormError>
            <div>
              <Button type="submit" variant="primary" icon="key" disabled={isSubmitting}>
                {user.has_password ? t("account.changePassword") : t("account.setPassword")}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </Section>
  );
}

function TwoFactorSection({
  user,
  readOnly,
  onSaved,
}: {
  user: User;
  readOnly: boolean;
  onSaved: (u: User, message?: string) => void;
}) {
  const { t } = useTranslation();
  const [on, setOn] = useState(!!user.two_factor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = !!user.two_factor_required;
  const toggle = async (enabled: boolean) => {
    setError("");
    setBusy(true);
    setOn(enabled);
    try {
      onSaved(await api.setTwoFactor(enabled));
    } catch (err) {
      setOn(!enabled);
      setError(errText(err));
    }
    setBusy(false);
  };
  return (
    <Section id="twoFactorTitle" title={t("account.twoFactor")}>
      <SwitchField
        id="twoFactor"
        label={t("account.twoFactorLabel")}
        description={
          user.authenticator
            ? t("account.twoFactorAppHelp")
            : user.email
              ? t("account.twoFactorHelp", { email: user.email })
              : t("account.twoFactorNoEmail")
        }
        checked={on || locked}
        disabled={readOnly || busy || locked || (!on && !user.email && !user.authenticator)}
        aria-describedby={locked ? "twoFactorLocked" : undefined}
        onCheckedChange={(v) => void toggle(v)}
      />
      {locked && (
        <p className="text-meta" id="twoFactorLocked">
          <Icon name="lock" /> {t("account.twoFactorRequired")}
        </p>
      )}
      <AuthenticatorRow
        user={user}
        readOnly={readOnly}
        onSaved={(u, message) => {
          setOn(!!u.two_factor);
          onSaved(u, message);
        }}
      />
      {user.email && <p className="text-meta">{t("account.emailBackup", { email: user.email })}</p>}
      <FormError>{error}</FormError>
    </Section>
  );
}

const PROVIDERS = [
  ["google", "account_circle"],
  ["microsoft", "window"],
] as const;

function ConnectedSection({
  options,
  hasPassword,
  readOnly,
  onSaved,
}: {
  options: AuthStatus | null;
  hasPassword: boolean;
  readOnly: boolean;
  onSaved: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    const here = onScreen();
    api
      .connectedAccounts()
      .then((a) => here() && setAccounts(a))
      .catch((err: unknown) => here() && setError(errText(err)));
  }, []);
  useEffect(load, [load]);
  const shown = PROVIDERS.filter(([p]) => options?.[p]);
  if (!shown.length) return null; // neither is set up on this server
  // With a password, connecting or disconnecting asks for it; without one, the server checks for a
  // recent sign in and says so if there wasn't one.
  const connect = async (provider: "google" | "microsoft", password = "") => {
    setError("");
    try {
      window.location.assign(await api.connectAccount(provider, password));
    } catch (err) {
      setError(errText(err));
    }
  };
  const disconnect = async (provider: "google" | "microsoft", password = "") => {
    setError("");
    try {
      await api.disconnectAccount(provider, password);
      onSaved(t("account.disconnected", { provider: t(`account.providers.${provider}`) }));
      load();
    } catch (err) {
      setError(errText(err));
    }
  };
  return (
    <Section id="connectedTitle" title={t("account.connected")} help={t("account.connectedHelp")}>
      <div>
        {shown.map(([p, icon]) => {
          const linked = accounts?.find((a) => a.provider === p);
          const name = t(`account.providers.${p}`);
          return (
            <ListRow
              key={p}
              lead={icon}
              title={name}
              meta={linked ? t("account.connectedAs", { email: linked.email }) : t("account.notConnected")}
              action={
                linked ? (
                  <Confirm
                    trigger={t("account.disconnect")}
                    title={t("account.disconnectTitle", { provider: name })}
                    help={t("account.disconnectHelp", { provider: name })}
                    confirm={t("account.disconnect")}
                    disabled={readOnly}
                    askPassword={hasPassword}
                    onConfirm={(pw) => disconnect(p, pw)}
                  />
                ) : hasPassword ? (
                  <Confirm
                    trigger={t("account.connect")}
                    title={t("account.connectTitle", { provider: name })}
                    help={t("account.connectHelp", { provider: name })}
                    confirm={t("account.connect")}
                    disabled={readOnly || accounts === null}
                    askPassword
                    onConfirm={(pw) => connect(p, pw)}
                  />
                ) : (
                  <Button disabled={readOnly || accounts === null} icon="link" onClick={() => void connect(p)}>
                    {t("account.connect")}
                  </Button>
                )
              }
            />
          );
        })}
      </div>
      <FormError>{error}</FormError>
    </Section>
  );
}

function SessionsSection({ readOnly, onSaved }: { readOnly: boolean; onSaved: (msg: string) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const others = async () => {
    setError("");
    try {
      await api.signOutOthers();
      onSaved(t("account.signedOutOthers"));
    } catch (err) {
      setError(errText(err));
    }
  };
  const everywhere = async () => {
    setError("");
    try {
      await api.signOutEverywhere();
      endSession();
      void navigate("/sign-in");
    } catch (err) {
      setError(errText(err));
    }
  };
  return (
    <Section id="sessionsTitle" title={t("account.sessions")} help={t("account.sessionsHelp")}>
      <div className="row">
        <Confirm
          trigger={t("account.signOutOthers")}
          title={t("account.signOutOthersTitle")}
          help={t("account.signOutOthersHelp")}
          confirm={t("account.signOutOthers")}
          disabled={readOnly}
          onConfirm={others}
        />
        <Confirm
          trigger={t("account.signOutEverywhere")}
          title={t("account.signOutEverywhereTitle")}
          help={t("account.signOutEverywhereHelp")}
          confirm={t("account.signOutEverywhere")}
          variant="link"
          disabled={readOnly}
          onConfirm={everywhere}
        />
      </div>
      <FormError>{error}</FormError>
    </Section>
  );
}

/** A button that asks first, and for the password when that proves it's you. Errors show by the section. */
function Confirm({
  trigger,
  title,
  help,
  confirm,
  disabled,
  askPassword = false,
  variant,
  onConfirm,
}: {
  trigger: string;
  title: string;
  help: string;
  confirm: string;
  disabled?: boolean;
  askPassword?: boolean;
  variant?: "link";
  onConfirm: (password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  return (
    <ConfirmDialog
      trigger={
        <Button disabled={disabled} variant={variant}>
          {trigger}
        </Button>
      }
      title={title}
      description={help}
      confirmLabel={confirm}
      cancelLabel={t("account.cancel")}
      confirmDisabled={askPassword && !password}
      onCancel={() => setPassword("")}
      onConfirm={() => {
        const pw = password;
        setPassword("");
        void onConfirm(pw);
      }}
    >
      {askPassword && (
        <FormField id="confirmPassword" label={t("account.currentPassword")}>
          <TextField
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
      )}
    </ConfirmDialog>
  );
}
