import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { api } from "../api";
import { useSession } from "../api/session";
import { clearInvite, takeInvite } from "../state/start";
import { Button, Card, FormError, FormField, TextField, buttonClasses } from "@blinq-scribe/ui";

const schema = z
  .object({
    password: z.string().min(10, "invite.tooShort"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "invite.mismatch" });
type Form = z.infer<typeof schema>;

/** An invite link: set a password, then straight into the console. */
export function AcceptInvite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token] = useState(takeInvite);
  const [who, setWho] = useState<{ name: string; username: string } | null>(null);
  const [linkError, setLinkError] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) {
      void navigate("/sign-in", { replace: true });
      return;
    }
    api
      .inviteInfo(token)
      .then(setWho)
      .catch((err: unknown) => setLinkError(err instanceof Error ? err.message : String(err)));
  }, [token, navigate]);

  const submit = handleSubmit(async ({ password }) => {
    setError("");
    try {
      const session = await api.acceptInvite(token, password);
      clearInvite();
      useSession.getState().setToken(session);
      void navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  });

  const msg = (key?: string) => (key ? t(key as "invite.tooShort") : "");

  return (
    <div className="gate">
      {linkError ? (
        <Card>
          <h1 className="text-display">{t("invite.title")}</h1>
          <FormError>{linkError}</FormError>
          <Link className={buttonClasses()} to="/sign-in" onClick={clearInvite}>
            {t("invite.goToSignIn")}
          </Link>
        </Card>
      ) : !who ? (
        <Card>
          <p className="text-meta" role="status">
            {t("app.loading")}
          </p>
        </Card>
      ) : (
        <Card as="form" onSubmit={(e) => void submit(e)} noValidate>
          <span className="text-meta">{t("invite.eyebrow")}</span>
          <h1 className="text-display">{who.name}</h1>
          <p className="muted">
            <Trans
              i18nKey="invite.help"
              values={{ username: who.username }}
              components={{ b: <b className="font-num" /> }}
            />
          </p>
          <span className="sr-only" aria-hidden="true">
            <TextField autoComplete="username" value={who.username} readOnly tabIndex={-1} />
          </span>
          <FormField id="newPassword" label={t("invite.password")} error={msg(errors.password?.message) || undefined}>
            <TextField type="password" autoComplete="new-password" autoFocus {...register("password")} />
          </FormField>
          <FormField id="confirmPassword" label={t("invite.confirm")} error={msg(errors.confirm?.message) || undefined}>
            <TextField type="password" autoComplete="new-password" {...register("confirm")} />
          </FormField>
          <FormError>{error}</FormError>
          <Button type="submit" variant="primary" size="lg" icon="check" disabled={isSubmitting}>
            {t("invite.submit")}
          </Button>
        </Card>
      )}
    </div>
  );
}
