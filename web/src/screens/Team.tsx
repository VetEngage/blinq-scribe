import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { t as tr } from "../i18n";
import { api } from "../api";
import type { Invite, Provider, User } from "../api/types";
import { useApp } from "../state/app";
import { onScreen } from "../state/nav";
import { endSession } from "../state/session";
import { initials, webUrl } from "../lib/format";
import { useNoVisit } from "../state/useNoVisit";
import {
  Avatar,
  Button,
  Card,
  CheckboxField,
  FormError,
  FormField,
  PageHeader,
  Select,
  SwitchField,
  TextField,
} from "@blinq-scribe/ui";
import { Loading } from "../components/common";

const schema = z
  .object({
    name: z.string().trim().min(1, "team.nameRequired"),
    username: z.string().trim().min(1, "team.usernameRequired"),
    // Spaces alone count as no email.
    email: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.string().email("account.emailInvalid")])),
    role: z.enum(["vet", "front_office", "admin"]),
    provider_id: z.string(),
    require2fa: z.boolean(),
    manages: z.boolean(),
  })
  .refine((v) => v.role !== "vet" || v.provider_id, { path: ["provider_id"], message: "team.providerRequired" });
type Form = z.infer<typeof schema>;

// A vet who also manages the team is an admin who keeps their provider: one login for both.
const roleName = (u: Pick<User, "role" | "provider_id">) =>
  u.role === "admin" && u.provider_id
    ? tr("team.vetManager")
    : u.role === "admin"
      ? tr("team.admin")
      : u.role === "front_office"
        ? tr("team.frontOffice")
        : tr("team.vet");

function CopyBox({ url, withButton = true }: { url: string; withButton?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async (ev: React.MouseEvent) => {
    (ev.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null)?.select();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* the link is selected to copy by hand */
    }
  };
  return (
    <div className="invite-box">
      <TextField id="inviteUrl" aria-label={t("invite.link")} num readOnly value={url} />
      {withButton && (
        <Button icon="content_copy" onClick={(e) => void copy(e)}>
          {copied ? t("invite.copied") : t("invite.copy")}
        </Button>
      )}
    </div>
  );
}

/** Team (admins): invite people, link each to their provider, turn them off. */
export function TeamScreen() {
  const { t } = useTranslation();
  useNoVisit();
  const me = useApp((s) => s.me);
  const [people, setPeople] = useState<User[] | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [lastInvite, setLastInvite] = useState<Invite | null>(null);
  const [firstInvite, setFirstInvite] = useState<Invite | null>(null);
  const [error, setError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      role: "vet",
      provider_id: "",
      require2fa: false,
      manages: false,
    },
  });
  const role = watch("role");

  const load = useCallback(() => {
    const here = onScreen();
    void api
      .team()
      .then((r) => {
        if (here()) {
          setPeople(r.users);
          setProviders(r.providers);
        }
      })
      .catch((err: unknown) => {
        if (here()) setError(err instanceof Error ? err.message : String(err));
      });
  }, []);
  useEffect(load, [load]);

  const submit = handleSubmit(async (body) => {
    setError("");
    try {
      const { require2fa, manages, ...person } = body;
      // "Can also manage the team" makes a vet an admin who keeps their provider.
      const r = await api.addUser({ ...person, role: person.role === "vet" && manages ? "admin" : person.role });
      if (require2fa) await api.setUserTwoFactor(r.user.id, true);
      // The first account ends the open demo, so from here on everyone signs in. Hand over the link first.
      if (me?.via === "open") {
        setFirstInvite(r);
        return;
      }
      setLastInvite(r);
      reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  });
  const act = async (u: User, action: "reinvite" | "on" | "off" | "manage" | "unmanage") => {
    setError("");
    try {
      if (action === "reinvite") setLastInvite(await api.reinvite(u.id));
      else if (action === "manage" || action === "unmanage")
        await api.updateUser(u.id, { role: action === "manage" ? "admin" : "vet" });
      else await api.updateUser(u.id, { active: action === "on" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (firstInvite) {
    return (
      <Card className="max-w-[560px]">
        <span className="text-meta">{t("invite.firstEyebrow")}</span>
        <h1 className="text-display">{t("invite.firstTitle", { name: firstInvite.user.name })}</h1>
        <p className="muted">
          {firstInvite.user.role === "admin" ? t("invite.firstHelpYour") : t("invite.firstHelpTheir")}
        </p>
        <CopyBox url={firstInvite.invite_url} />
        <div className="row">
          <Button
            variant="primary"
            size="lg"
            icon="login"
            onClick={() => {
              const url = webUrl(firstInvite.invite_url);
              endSession();
              if (url) window.location.assign(url);
            }}
          >
            {t("invite.open")}
          </Button>
        </div>
      </Card>
    );
  }

  const fieldError = (key?: string) => (key ? t(key as "team.nameRequired") : "");
  const providerName = Object.fromEntries(providers.map((p) => [p.id, p.name]));
  return (
    <>
      <PageHeader eyebrow={t("team.eyebrow")} title={t("team.title")} sub={t("team.help")} />
      {lastInvite && (
        <Card>
          <Card.Title as="span">{t("team.inviteFor", { name: lastInvite.user.name })}</Card.Title>
          <CopyBox url={lastInvite.invite_url} />
          <span className="text-meta">{t("team.sendIt")}</span>
        </Card>
      )}
      <Card as="form" onSubmit={(e) => void submit(e)} noValidate>
        <Card.Title as="span">{t("team.add")}</Card.Title>
        <div className="form-grid">
          <FormField id="newName" label={t("team.name")} error={fieldError(errors.name?.message) || undefined}>
            <TextField type="text" placeholder={t("team.namePh")} {...register("name")} />
          </FormField>
          <FormField
            id="newUsername"
            label={t("team.username")}
            error={fieldError(errors.username?.message) || undefined}
          >
            <TextField type="text" placeholder={t("team.usernamePh")} {...register("username")} />
          </FormField>
          <FormField
            id="newEmail"
            label={t("team.email")}
            hint={t("team.emailHelp")}
            error={fieldError(errors.email?.message) || undefined}
          >
            <TextField type="email" placeholder={t("team.emailPh")} {...register("email")} />
          </FormField>
          <FormField id="newRole" label={t("team.role")} hint={t("team.roleHelp")}>
            {(a11y) => (
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select
                    {...a11y}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: "vet", label: t("team.vet") },
                      { value: "front_office", label: t("team.frontOffice") },
                      { value: "admin", label: t("team.admin") },
                    ]}
                  />
                )}
              />
            )}
          </FormField>
          <FormField
            id="newProvider"
            label={t("team.provider")}
            error={fieldError(errors.provider_id?.message) || undefined}
          >
            {(a11y) => (
              <Controller
                control={control}
                name="provider_id"
                render={({ field }) => (
                  <Select
                    {...a11y}
                    name={field.name}
                    required={role === "vet"}
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: "", label: t("team.notProvider") },
                      ...providers.map((p) => ({
                        value: p.id,
                        disabled: !!p.linked_to,
                        label: p.linked_to ? t("team.linkedTo", { name: p.name, to: p.linked_to }) : p.name,
                      })),
                    ]}
                  />
                )}
              />
            )}
          </FormField>
        </div>
        {role === "vet" && (
          <Controller
            control={control}
            name="manages"
            render={({ field }) => (
              <SwitchField
                id="newManages"
                label={t("team.managesLabel")}
                description={t("team.managesHelp")}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="require2fa"
          render={({ field }) => (
            <SwitchField
              id="newRequire2fa"
              label={t("team.require2fa")}
              description={t("team.require2faHelp")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <FormError>{error}</FormError>
        <div>
          <Button type="submit" variant="primary" icon="person_add" disabled={isSubmitting}>
            {t("team.create")}
          </Button>
        </div>
      </Card>
      <Card density="list">
        <Card.Title as="span">{t("team.people")}</Card.Title>
        <div>
          {people === null ? (
            <Loading />
          ) : people.length ? (
            people.map((u) => (
              <div key={u.id} className="team-row">
                <Avatar initials={initials(u.name)} />
                <span className="text">
                  <b>{u.name}</b>
                  <span className="text-meta">
                    <span className="font-num">{u.username}</span> · {roleName(u)}
                    {u.provider_id ? ` · ${providerName[u.provider_id] ?? u.provider_id}` : ""}
                  </span>
                </span>
                {/* Status is plain grey text: none of these needs attention. */}
                <span className="text-meta">
                  {!u.active ? t("team.off") : u.has_password ? t("team.active") : t("team.invited")}
                </span>
                {u.active ? (
                  <>
                    <Button icon="link" onClick={() => void act(u, "reinvite")}>
                      {t("team.newLink")}
                    </Button>
                    {u.provider_id && u.role !== "front_office" && me?.user?.id !== u.id && (
                      <CheckboxField
                        id={`manage-${u.id}`}
                        label={t("team.managesTeam")}
                        checked={u.role === "admin"}
                        onCheckedChange={(v) => void act(u, v === true ? "manage" : "unmanage")}
                      />
                    )}
                    {me?.user?.id !== u.id && <Button onClick={() => void act(u, "off")}>{t("team.turnOff")}</Button>}
                  </>
                ) : (
                  <Button onClick={() => void act(u, "on")}>{t("team.turnOn")}</Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-meta">{t("team.nobody")}</p>
          )}
        </div>
      </Card>
    </>
  );
}
