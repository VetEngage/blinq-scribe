"""Share the owner summary after signing: a link by text, a branded PDF, and the owner's
own page.

Built only from the signed note's For the owner section, medicines, home care and next
visit. Never the
assessment, the exam, or anything kept under Remember.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import html
import re
import secrets
import unicodedata
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from . import booking_links, editor, images, pdf
from .day import visit_day
from .llm import MuseClient
from .phone import clinic_contact, clinic_with_phone, format_phone
from .schemas import (
    Appointment,
    Encounter,
    EncounterStatus,
    FollowUpKind,
    FollowUpStatus,
    Patient,
)
from .store import Store
from .text import sentences

LINK_DAYS = 14
MAX_TRIES = 5
DEFAULT_CALL = "Call us if anything changes or you have questions."

LABELS = {
    "en": {
        "title": "Visit summary",
        "visit": "Visit details",
        "date": "Date",
        "pet": "Pet",
        "owner": "Owner",
        "seen_by": "Seen by",
        "for_owner": "For you",
        "found": "What we found",
        "photo": "Photo",
        "visit_date": "Visit date",
        "appointment": "Appointment",
        "prepared": "Prepared by {who}.",
        "questions": "Questions? Call {phone}.",
        "page": "Page {n} of {total}",
        "medicines": "Medicines",
        "home_care": "Home care",
        "photos": "Photos",
        "next_visit": "Next visit",
        "when_to_call": "When to call us",
        "call": "Questions? Call us at",
        "pick": "Pick a time",
        "ask": "To see the visit summary, type the pet owner's last name.",
        "last_name": "Last name",
        "open": "Open summary",
        "wrong": "That last name doesn't match. {n} tries left.",
        "locked": "This link is locked after too many tries. Call {clinic} for your "
        "summary.",
        "expired": "This link has expired. Call {clinic} and we'll send a new one.",
        "missing": "This link doesn't work. Call the clinic and we'll send a new one.",
        "partly_english": "",
    },
    "es": {
        "title": "Resumen de la visita",
        "visit": "Datos de la visita",
        "date": "Fecha",
        "pet": "Mascota",
        "owner": "Dueño",
        "seen_by": "Atendido por",
        "for_owner": "Para usted",
        "found": "Lo que encontramos",
        "photo": "Foto",
        "visit_date": "Fecha de la visita",
        "appointment": "Cita",
        "prepared": "Preparado por {who}.",
        "questions": "¿Preguntas? Llame al {phone}.",
        "page": "Página {n} de {total}",
        "medicines": "Medicamentos",
        "home_care": "Cuidados en casa",
        "photos": "Fotos",
        "next_visit": "Próxima visita",
        "when_to_call": "Cuándo llamarnos",
        "call": "¿Preguntas? Llámenos al",
        "pick": "Elija una hora",
        "ask": "Para ver el resumen de la visita, escriba el apellido del dueño de "
        "la mascota.",
        "last_name": "Apellido",
        "open": "Ver resumen",
        "wrong": "El apellido no coincide. Quedan {n} intentos.",
        "locked": "Este enlace se bloqueó tras demasiados intentos. Llame a {clinic} "
        "para recibir su resumen.",
        "expired": "Este enlace venció. Llame a {clinic} y le enviaremos uno nuevo.",
        "missing": "Este enlace no funciona. Llame a la clínica y le enviaremos uno "
        "nuevo.",
        "partly_english": "Parte de este resumen está en inglés. Llámenos si tiene "
        "preguntas.",
    },
}
_DAYS_ES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
_MONTHS_ES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
]
_HOME_CARE = re.compile(
    r"\b(give|apply|drops?|a "
    r"day|daily|cone|e-collar|keep|clean|feed|walk|rest|bath|avoid|"
    r"restrict|tablets?|pills?|capsules?|with food|at home|ointment|brush|diet)\b",
    re.I,
)
_CALL = re.compile(r"\bcall (us|the clinic|if)\b", re.I)


def group_of(store: Store, enc: Encounter) -> list[Encounter]:
    """Every signed note from this visit, the first pet first."""
    gid = enc.group_id or enc.id
    group = [
        e
        for e in store.list(group_id=gid)
        if (e.group_id or e.id) == gid and e.status == EncounterStatus.signed
    ]
    return sorted(group, key=lambda e: (e.id != gid, e.created_at))


def _when(start: datetime, lang: str) -> str:
    if lang == "es":
        return (
            f"{_DAYS_ES[start.weekday()]} {start.day} "
            f"{_MONTHS_ES[start.month - 1]}, {start:%-I:%M %p}"
        )
    return f"{start:%a %b %-d at %-I:%M %p}"


def visit_when(on: date, start: datetime | None, lang: str) -> str:
    """The visit's day, with the appointment time when there is one, as the clinic
    reads it (times are clinic-local): "Sat, Oct 31, 2026 at 1:30 PM", or in Spanish
    "sáb. 31 de oct. de 2026, 1:30 p. m."."""
    if lang == "es":
        text = (
            f"{_DAYS_ES[on.weekday()]}. {on.day} de {_MONTHS_ES[on.month - 1]}. "
            f"de {on.year}"
        )
        if start:
            noon = "p. m." if start.hour >= 12 else "a. m."
            text += f", {start:%-I:%M} {noon}"
        return text
    return f"{on:%a, %b %-d, %Y}" + (f" at {start:%-I:%M %p}" if start else "")


def age_text(age: int | None, lang: str) -> str:
    if age is None:
        return ""
    if lang == "es":
        return "menos de 1 año" if age == 0 else f"{age} año{'s' if age != 1 else ''}"
    return "under 1 year" if age == 0 else f"{age} year{'s' if age != 1 else ''}"


def pet_line(pet: dict[str, Any]) -> str:
    """One pet's details, the empty ones left out, e.g.
    "Biscuit · Dog · Golden Retriever · Male, neutered · 6 years"."""
    parts = (pet["name"], pet["species"], pet["breed"], pet["sex"], pet["age_text"])
    return " · ".join(p for p in parts if p)


def _day(d: str, lang: str) -> str:
    x = date.fromisoformat(d)
    return f"{x.day} {_MONTHS_ES[x.month - 1]}" if lang == "es" else f"{x:%b %-d}"


def next_visit(enc: Encounter, lang: str) -> dict[str, Any]:
    """Booked shows the time; a link not booked yet is Pick a time, never a booked
    date."""
    for f in enc.followups:
        if f.kind != FollowUpKind.recheck or f.status != FollowUpStatus.approved:
            continue
        link = f.booking_link
        start = (f.booked_slot.start if f.booked_slot else None) or (
            link.booked_start if link else None
        )
        if start:
            return {
                "kind": "booked",
                "text": ("Cita: " if lang == "es" else "Booked: ") + _when(start, lang),
                "url": "",
            }
        if (
            link
            and f.booking_mode == "link"
            and booking_links.status_now(link) not in ("expired", "queued")
        ):
            span = (
                f"{_day(link.from_, lang)} {'al' if lang == 'es' else 'to'} "
                f"{_day(link.to, lang)}"
            )
            text = (
                f"Elija una hora para el control de {enc.patient_name} ({span})"
                if lang == "es"
                else f"Pick a time for {enc.patient_name}'s recheck ({span})"
            )
            if len(link.pets) > 1:  # one link books every pet's recheck
                names = ", ".join(link.pets[:-1]) + (
                    f" {'y' if lang == 'es' else 'and'} {link.pets[-1]}"
                )
                text = (
                    f"Elija una hora para los controles de {names} con un solo "
                    f"enlace ({span})"
                    if lang == "es"
                    else f"Pick a time for {names}'s rechecks with one link ({span})"
                )
            return {"kind": "pick_a_time", "text": text, "url": link.url}
    return {"kind": "none", "text": "", "url": ""}


async def spanish(store: Store, muse: MuseClient, text: str) -> tuple[str, bool]:
    """Spanish for the owner, cached per text. A translation that fails the rules keeps
    the English, and
    says so (False), so the page and the console can tell the vet."""
    if not text.strip():
        return text, True
    key = "es:" + hashlib.sha256(text.encode()).hexdigest()[:24]
    if cached := store.get_meta(key):
        return cached, True
    out = await editor.translate(muse, text)
    if out:
        store.set_meta(key, out)
    return out or text, bool(out)


async def summary(
    store: Store,
    muse: MuseClient,
    clinic: dict[str, Any],
    enc: Encounter,
    lang: str,
    mock: bool,
    appt: Appointment | None = None,
    animals: dict[str, Patient] | None = None,
) -> dict[str, Any]:
    """The owner summary. appt and animals (patient id -> the practice system's pet)
    add the visit details at the top; anything they don't have stays empty."""
    pets, calls, translated = [], [], True
    group = group_of(store, enc)
    for e in group:
        note = e.note
        plan = sentences(note.plan) if note else []
        # The owner summary's own "call us" line is written for the owner; the plan's
        # ("Owner to call if ...") is the vet's version of the same advice, so it's
        # only used when the summary has none.
        said = sentences(note.client_summary if note else "")
        calls += [s for s in said if _CALL.search(s)] or [
            s for s in plan if _CALL.search(s)
        ]
        home = [
            s
            for s in plan
            if _HOME_CARE.search(s)
            and not _CALL.search(s)
            and "[confirm" not in s.lower()
            and not re.search(r"\brecheck\b", s, re.I)
        ]
        animal = (animals or {}).get(e.patient_id)
        pet: dict[str, Any] = {
            "patient_id": e.patient_id,
            "name": e.patient_name,
            "species": animal.species if animal else "",
            "breed": animal.breed if animal else "",
            "sex": animal.sex if animal else "",
            "age": animal.age if animal else None,
            "age_text": age_text(animal.age if animal else None, lang),
            "for_owner": note.client_summary if note else "",
            "medicines": list(note.medications) if note else [],
            "home_care": home,
            "next_visit": next_visit(e, lang),
            # Only photos the vet chose to show, with their label and caption: never
            # the outline or Blinq's longer findings.
            "photos": [
                {
                    "id": p.id,
                    "encounter_id": e.id,
                    "label": p.label,
                    "caption": p.caption,
                    "url": f"/api/encounters/{e.id}/photos/{p.id}",
                    "crop": p.crop.model_dump() if p.crop else None,
                    "rotation": p.rotation,
                }
                for p in e.photos
                if p.show_owner
            ],
        }
        if lang == "es":
            words = [pet["for_owner"], *home]
            for photo in pet["photos"]:
                words += [photo["label"], photo["caption"]]
            done = await asyncio.gather(*(spanish(store, muse, t) for t in words))
            pet["for_owner"] = done[0][0]
            pet["home_care"] = [t for t, _ in done[1 : 1 + len(home)]]
            rest = iter(t for t, _ in done[1 + len(home) :])
            for photo in pet["photos"]:
                photo["label"], photo["caption"] = next(rest), next(rest)
            translated = translated and all(ok for _, ok in done)
        pets.append(pet)
    when = " ".join(dict.fromkeys(calls)) or DEFAULT_CALL
    if lang == "es":
        when, ok = await spanish(store, muse, when)
        translated = translated and ok
    # The vet who signed, else the one the visit was booked with.
    first = group[0] if group else enc
    seen_by = (
        first.signed_by or first.provider_name or (appt.provider_name if appt else "")
    )
    start = appt.start.replace(tzinfo=None) if appt else None
    on = start.date() if start else visit_day(first)
    # translated is False when part of a Spanish summary had to stay in English.
    return {
        "clinic": clinic,
        "language": lang,
        "visit": {
            "date": on.isoformat(),
            "start": start.isoformat() if start else None,
            "when": visit_when(on, start, lang),
            "provider_name": seen_by,
        },
        "owner_name": first.owner_name or (appt.client.full_name if appt else ""),
        "pets": pets,
        "when_to_call": when,
        "translated": translated,
        "mock": mock or (lang == "es" and not muse.enabled),
    }


def text_message(
    first_name: str, pet_names: list[str], clinic_name: str, url: str, lang: str
) -> str:
    """The owner's text says only that a summary is ready: no diagnosis, no medicine."""
    last = " and " if lang == "en" else " y "
    names = (
        ", ".join(pet_names[:-1]) + last + pet_names[-1]
        if len(pet_names) > 1
        else "".join(pet_names)
    )
    if lang == "es":
        return (
            f"Hola {first_name}, el resumen de la visita de {names} de "
            f"{clinic_name} está listo: {url}. "
            "Responde STOP para no recibir más mensajes."
        )
    owner = f"{names}'" if names.endswith("s") else f"{names}'s"
    return (
        f"Hi {first_name}, {owner} visit summary from {clinic_name} is ready: "
        f"{url}. Reply STOP to opt out."
    )


def photo_files(store: Store, s: dict[str, Any]) -> dict[str, bytes]:
    """The original image of each photo in a summary, by photo id."""
    out: dict[str, bytes] = {}
    for pet in s["pets"]:
        for photo in pet["photos"]:
            enc = store.get(photo["encounter_id"])
            found = (
                next((p for p in enc.photos if p.id == photo["id"]), None)
                if enc
                else None
            )
            if found and Path(found.path).is_file():
                out[photo["id"]] = Path(found.path).read_bytes()
    return out


def summary_pdf(s: dict[str, Any], files: dict[str, bytes] | None = None) -> bytes:
    """The owner's visit summary on the clinic's letterhead: the visit details in a
    box, then each pet's findings, medicines, home care, photos and next visit, and
    when to call. Only what the provider approved, in plain words."""
    lab, visit = LABELS[s["language"]], s["visit"]
    on = date.fromisoformat(visit["date"])
    start = datetime.fromisoformat(visit["start"]) if visit["start"] else None
    first: list[tuple[str, str]] = [
        (lab["visit_date"], visit_when(on, None, s["language"]))
    ]
    if start:
        first.append((lab["appointment"], f"{start:%-I:%M %p}"))
    if visit["provider_name"]:
        first.append((lab["seen_by"], visit["provider_name"]))
    rest: list[tuple[str, str]] = []
    if s["owner_name"]:
        rest.append((lab["owner"], s["owner_name"]))
    rest += [(lab["pet"], pet_line(p)) for p in s["pets"]]
    facts = [first] + [rest[i : i + 3] for i in range(0, len(rest), 3)]

    blocks: list[tuple[str, str]] = [("title", lab["title"])]
    if not s["translated"]:
        blocks.append(("text", lab["partly_english"]))
    for pet in s["pets"]:
        blocks.append(("pet", pet["name"]))
        if pet["for_owner"]:
            blocks += [("label", lab["found"]), ("text", pet["for_owner"])]
        if pet["medicines"]:
            blocks += [
                ("label", lab["medicines"]),
                *(("med", m) for m in pet["medicines"]),
            ]
        if pet["home_care"]:
            blocks += [
                ("label", lab["home_care"]),
                *(("bullet", h) for h in pet["home_care"]),
            ]
        if pet["photos"]:
            blocks.append(
                ("label", lab["photo"] if len(pet["photos"]) == 1 else lab["photos"])
            )
            for photo in pet["photos"]:
                blocks.append(("image", photo["id"]))
                words = [w for w in (photo["label"], photo["caption"]) if w]
                if words:
                    blocks.append(("caption", ": ".join(words)))
        nv = pet["next_visit"]
        if nv["kind"] != "none":
            blocks += [
                ("label", lab["next_visit"]),
                ("text", nv["text"] + (f" {nv['url']}" if nv["url"] else "")),
            ]
    blocks += [("label", lab["when_to_call"]), ("text", s["when_to_call"])]
    clinic = s["clinic"]
    phone = format_phone(clinic["phone"])
    footer = " ".join(
        x
        for x in (
            lab["prepared"].format(who=visit["provider_name"])
            if visit["provider_name"]
            else "",
            lab["questions"].format(phone=phone) if phone else "",
        )
        if x
    )
    shown = {
        p["id"]: ((files or {})[p["id"]], p["crop"], p["rotation"])
        for pet in s["pets"]
        for p in pet["photos"]
        if p["id"] in (files or {})
    }
    return pdf.render(clinic, blocks, footer, shown, facts, lab["page"])


# ---------- owner links ----------


def _name_hash(token: str, last_name: str) -> str:
    # Letters only, without case or accents, so O’Brien, o'brien and OBRIEN all match.
    norm = "".join(
        c for c in unicodedata.normalize("NFKD", last_name.casefold()) if c.isalpha()
    )
    return hashlib.sha256(f"blinq-share:{token}:{norm}".encode()).hexdigest()


def create_link(
    store: Store, encounter_id: str, lang: str, last_name: str
) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(24)
    now = datetime.now(UTC)
    expires = now + timedelta(days=LINK_DAYS)
    store.add_share(
        token, encounter_id, lang, _name_hash(token, last_name), now, expires
    )
    return token, expires


def open_link(
    store: Store, token: str, last_name: str | None
) -> tuple[str, dict[str, Any] | None]:
    """Check a link and, when given, the last name. Returns (state, row): state is one
    of
    missing, expired, locked, ask, wrong, ok."""
    link = store.share(token) if token else None
    if not link:
        return "missing", None
    failures: int = link.failures
    row = {
        "encounter_id": link.encounter_id,
        "language": link.language,
        "tries_left": MAX_TRIES - failures,
    }
    if datetime.fromisoformat(link.expires_at) < datetime.now(UTC):
        return "expired", row
    if failures >= MAX_TRIES:
        return "locked", row
    if last_name is None:
        return "ask", row
    if hmac.compare_digest(_name_hash(token, last_name), link.name_hash):
        store.share_tried(token, ok=True)
        return "ok", row
    store.share_tried(token, ok=False)
    row["tries_left"] = max(0, MAX_TRIES - failures - 1)
    return ("locked" if row["tries_left"] == 0 else "wrong"), row


# ---------- the owner's page ----------

_e = html.escape

PAGE = """<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>{title}</title>
<style>
:root {{ --green: #047857; --ink: #1f2937; --muted: #6b7280; --line: #e5e7eb; --bg: #f8faf9; --card: #fff; }}
@media (prefers-color-scheme: dark) {{ :root {{ --ink: #e5e7eb; --muted: #9ca3af; --line: #374151; --bg: #111827; --card: #1f2937; }} }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.55; }}
header {{ background: var(--green); color: #fff; padding: 20px 16px; }}
header h1 {{ margin: 0; font-size: 1.25rem; font-weight: 600; }}
header p {{ margin: 4px 0 0; font-size: .875rem; opacity: .9; }}
figure {{ margin: 12px 0; }} svg.photo {{ display: block; width: 100%; max-height: 60vh; border-radius: 8px; }}
.visit p {{ margin: 2px 0; }}
figcaption {{ color: var(--muted); font-size: .875rem; margin-top: 4px; }}
main {{ max-width: 640px; margin: 0 auto; padding: 20px 16px 40px; }}
.card {{ background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin: 0 0 16px; }}
h2 {{ margin: 0 0 4px; font-size: 1.15rem; color: var(--green); font-weight: 600; }}
h3 {{ margin: 14px 0 4px; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 600; }}
p, ul {{ margin: 0; }} ul {{ padding-left: 20px; }}
label {{ display: block; font-weight: 500; margin: 12px 0 6px; }}
input {{ width: 100%; font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink); }}
button, .btn {{ display: inline-block; margin-top: 14px; background: var(--green); color: #fff; border: 0; border-radius: 8px;
  padding: 10px 18px; font: inherit; font-weight: 500; text-decoration: none; cursor: pointer; }}
.error {{ color: #b91c1c; margin-top: 10px; }}
footer {{ color: var(--muted); font-size: .875rem; text-align: center; }}
</style></head>
<body><header><h1>{clinic}</h1><p>{contact}</p></header><main>{body}</main></body></html>"""  # noqa: E501


def _shell(clinic: dict[str, Any], lang: str, title: str, body: str) -> str:
    contact = clinic_contact(clinic, " | ")
    return PAGE.format(
        lang=_e(lang),
        title=_e(title),
        clinic=_e(clinic["name"]),
        contact=_e(contact),
        body=body,
    )


def page_message(clinic: dict[str, Any], lang: str, state: str) -> str:
    lab = LABELS.get(lang, LABELS["en"])
    who = clinic_with_phone(clinic)
    return _shell(
        clinic,
        lang,
        lab["title"],
        f'<div class="card"><p>{_e(lab[state].format(clinic=who))}</p></div>',
    )


def page_form(clinic: dict[str, Any], lang: str, error: str = "") -> str:
    lab = LABELS.get(lang, LABELS["en"])
    err = f'<p class="error" role="alert">{_e(error)}</p>' if error else ""
    body = (
        '<form class="card" method="post" '
        f'autocomplete="off"><h2>{_e(lab["title"])}</h2><p>{_e(lab["ask"])}</p>'
        f'<label for="last_name">{_e(lab["last_name"])}</label>'
        '<input id="last_name" name="last_name" autocomplete="family-name" '
        'required maxlength="80">'
        f'{err}<button type="submit">{_e(lab["open"])}</button></form>'
    )
    return _shell(clinic, lang, lab["title"], body)


def visit_lines(s: dict[str, Any]) -> list[str]:
    """The visit details at the top of the PDF and the owner's page: when, who and
    which pets. One line per pet; empty facts are left out."""
    lab, visit = LABELS[s["language"]], s["visit"]
    lines = [f"{lab['date']}: {visit['when']}"]
    lines += [f"{lab['pet']}: {pet_line(p)}" for p in s["pets"]]
    if s["owner_name"]:
        lines.append(f"{lab['owner']}: {s['owner_name']}")
    if visit["provider_name"]:
        lines.append(f"{lab['seen_by']}: {visit['provider_name']}")
    return lines


def page_summary(s: dict[str, Any], files: dict[str, bytes] | None = None) -> str:
    lab = LABELS[s["language"]]
    cards = [
        f'<section class="card visit"><h2>{_e(lab["visit"])}</h2>'
        + "".join(f"<p>{_e(line)}</p>" for line in visit_lines(s))
        + "</section>"
    ]
    if not s["translated"]:
        cards.append(f'<p class="card">{_e(lab["partly_english"])}</p>')
    for pet in s["pets"]:
        parts = [f"<h2>{_e(pet['name'])}</h2>"]
        if pet["for_owner"]:
            parts.append(
                f"<h3>{_e(lab['for_owner'])}</h3><p>{_e(pet['for_owner'])}</p>"
            )
        if pet["medicines"]:
            parts.append(
                f"<h3>{_e(lab['medicines'])}</h3><ul>"
                + "".join(f"<li>{_e(m)}</li>" for m in pet["medicines"])
                + "</ul>"
            )
        if pet["home_care"]:
            parts.append(
                f"<h3>{_e(lab['home_care'])}</h3><ul>"
                + "".join(f"<li>{_e(h)}</li>" for h in pet["home_care"])
                + "</ul>"
            )
        nv = pet["next_visit"]
        if nv["kind"] != "none":
            link = (
                f' <a class="btn" href="{_e(nv["url"])}" rel="noopener '
                f'noreferrer">{_e(lab["pick"])}</a>'
                if nv["url"].startswith(("https://", "http://"))
                else ""
            )
            parts.append(
                f"<h3>{_e(lab['next_visit'])}</h3><p>{_e(nv['text'])}</p>{link}"
            )
        shown = [p for p in pet["photos"] if p["id"] in (files or {})]
        if shown:
            parts.append(f"<h3>{_e(lab['photos'])}</h3>")
        for photo in shown:
            words = ": ".join(w for w in (photo["label"], photo["caption"]) if w)
            drawn = images.svg(
                (files or {})[photo["id"]],
                photo["crop"],
                photo["rotation"],
                _e(words or lab["photos"]),
            )
            if drawn:
                parts.append(
                    f"<figure>{drawn}<figcaption>{_e(words)}</figcaption></figure>"
                )
        cards.append('<section class="card">' + "".join(parts) + "</section>")
    cards.append(
        "<section "
        f'class="card"><h3>{_e(lab["when_to_call"])}</h3><p>{_e(s["when_to_call"])}</p></section>'
    )
    if phone := format_phone(s["clinic"]["phone"]):
        cards.append(f"<footer>{_e(lab['call'])} {_e(phone)}</footer>")
    return _shell(s["clinic"], s["language"], lab["title"], "".join(cards))
