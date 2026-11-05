import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { clearFragment, takeFragment } from "../state/start";
import { Banner, Button, Card, FormError, FormField, TextField, buttonClasses } from "@blinq-scribe/ui";

const schema = z
  .object({
    password: z.string().min(10, "invite.tooShort"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "invite.mismatch" });
type Form = z.infer<typeof schema>;

/** A reset link from Forgot password: set a new password, then sign in with it. */
export function ResetPassword() {
  const { t } = useTranslation();
  const [token] = useState(() => takeFragment("reset"));
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  const msg = (key?: string) => (key ? t(key as "invite.tooShort") : "");
  const submit = handleSubmit(async ({ password }) => {
    setError("");
    try {
      await api.resetPassword(token, password);
      clearFragment("reset");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  });
  return (
    <div className="gate">
      <Card as="form" onSubmit={(e) => void submit(e)} noValidate>
        <h1 className="text-display">{t("signin.resetTitle")}</h1>
        {done ? (
          <>
            <Banner>{t("signin.resetDone")}</Banner>
            <Link className={buttonClasses("primary", "lg")} to="/sign-in">
              {t("signin.back")}
            </Link>
          </>
        ) : (
          <>
            <p className="muted">{t("signin.resetHelp")}</p>
            <FormField id="newPassword" label={t("invite.password")} error={msg(errors.password?.message) || undefined}>
              <TextField type="password" autoComplete="new-password" autoFocus {...register("password")} />
            </FormField>
            <FormField
              id="confirmPassword"
              label={t("invite.confirm")}
              error={msg(errors.confirm?.message) || undefined}
            >
              <TextField type="password" autoComplete="new-password" {...register("confirm")} />
            </FormField>
            <FormError>{error}</FormError>
            <Button type="submit" variant="primary" size="lg" icon="check" disabled={isSubmitting || !token}>
              {t("signin.resetSubmit")}
            </Button>
            <Link className={buttonClasses("link")} to="/sign-in">
              {t("signin.back")}
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
