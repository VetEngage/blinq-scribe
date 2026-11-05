"""Booking links: a recheck the owner books themselves from a texted link. Not a booking
until they do.

Until the practice system can make a link for one client, pet, visit type and vet, the
link comes from
BOOKING_URL_TEMPLATE with the first day of the window the vet asked for.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from .notes import as_utc, local_naive
from .schemas import (
    BookingLink,
    Encounter,
    EncounterStatus,
    FollowUp,
    FollowUpKind,
    FollowUpStatus,
    SmsResult,
)
from .store import Store

LINK_DAYS = 14  # a link works for 14 days after it is sent
WAITING = ("sent", "opened", "expired")
REMIND_DAYS = 3  # a link still not booked this long after it was sent: one reminder


def window(followup: FollowUp, visit_day: date) -> tuple[date, date]:
    """The days the owner can pick from: around the due date, as the vet asked, never
    before tomorrow."""
    if followup.due_in_days:
        target = visit_day + timedelta(days=followup.due_in_days)
        spread = max(
            2, followup.due_in_days // 7
        )  # same window the suggested times come from
        first, last = target - timedelta(days=spread), target + timedelta(days=spread)
    elif followup.suggested_slots:
        days = sorted(s.start.date() for s in followup.suggested_slots)
        first, last = days[0], days[-1]
    else:
        first, last = (
            visit_day + timedelta(days=1),
            visit_day + timedelta(days=LINK_DAYS),
        )
    first = max(first, visit_day + timedelta(days=1))
    return first, max(first, last)


def make_link(
    template: str, location_id: str, followup: FollowUp, visit_day: date
) -> BookingLink:
    """A queued link for an approved recheck. It goes out with the texts when the note
    is signed."""
    first, last = window(followup, visit_day)
    service_id = (
        followup.suggested_slots[0].service_id if followup.suggested_slots else ""
    )
    url = ""
    if template:
        try:
            url = template.format(
                location_id=location_id,
                service_id=service_id,
                start=datetime.combine(first, datetime.min.time()).isoformat(),
            )
        except KeyError, IndexError, ValueError:
            # a template with other placeholders: the text says to call instead
            url = ""
    return BookingLink(url=url, from_=first.isoformat(), to=last.isoformat())


def mark_sent(link: BookingLink, sms: SmsResult) -> None:
    """A link counts as sent once the owner got it, or would have in demo preview."""
    if sms.status in ("sent", "preview"):
        now = datetime.now(UTC)
        link.status, link.sent_at, link.expires_at = (
            "sent",
            now,
            now + timedelta(days=LINK_DAYS),
        )


def status_now(link: BookingLink) -> str:
    if (
        link.status in ("sent", "opened")
        and link.expires_at
        and as_utc(link.expires_at) < datetime.now(UTC)
    ):
        return "expired"
    return link.status


def _day(enc: Encounter) -> date:
    _, _, on = enc.appointment_id.partition("@")
    try:
        return date.fromisoformat(on)
    except ValueError:
        return local_naive(enc.created_at).date()


def owner_day(store: Store, enc: Encounter) -> list[Encounter]:
    """Every visit for this owner on this visit's day, a household's pets in the
    visit's order: whose rechecks can share one booking link."""
    gid = enc.group_id or enc.id
    if not enc.client_id:
        group = [e for e in store.list(group_id=gid) if (e.group_id or e.id) == gid]
    else:
        day = _day(enc)
        group = [
            e for e in store.list() if e.client_id == enc.client_id and _day(e) == day
        ]
    return sorted(
        group,
        key=lambda e: (
            (e.group_id or e.id) != gid,
            e.group_id or e.id,
            e.id != (e.group_id or e.id),
            e.created_at,
        ),
    )


def held(store: Store, enc: Encounter) -> bool:
    """A household's links wait for each other, so the owner gets one text with one
    link: while another pet's recheck in the same visit is still undecided, or its
    note isn't signed yet."""
    gid = enc.group_id or enc.id
    for e in store.list(group_id=gid):
        if (e.group_id or e.id) != gid or e.id == enc.id:
            continue
        for f in e.followups:
            if f.kind != FollowUpKind.recheck or f.status == FollowUpStatus.dismissed:
                continue
            if f.status == FollowUpStatus.draft:
                return True
            unsent = f.booking_mode == "link" and f.booking_link and not f.sms
            if unsent and e.status != EncounterStatus.signed:
                return True
    return False


def shared(links: list[tuple[str, str, BookingLink]]) -> BookingLink:
    """One link for several pets' rechecks (each its pet, follow up and own link):
    the earliest link (its first day starts the booking page), open from the first
    day any pet can come to the last."""
    first = min(links, key=lambda x: x[2].from_ or "9999")[2]
    return BookingLink(
        url=first.url,
        from_=min(x[2].from_ for x in links),
        to=max(x[2].to for x in links),
        pets=list(dict.fromkeys(pet for pet, _, _ in links)),
        followup_ids=[fid for _, fid, _ in links],
    )


def _and(names: list[str]) -> str:
    return names[0] if len(names) < 2 else f"{', '.join(names[:-1])} and {names[-1]}"


def shared_text(enc: Encounter, link: BookingLink) -> str:
    """The one owner text for several rechecks: who to bring and the one link. Plain
    words and no medical detail."""
    owner = enc.owner_name.split()[0] if enc.owner_name.strip() else "there"
    vet = enc.provider_name.split()[-1] if enc.provider_name.strip() else ""
    who = f"Dr. {vet}" if vet else "We"
    many = "both" if len(link.pets) == 2 else f"all {len(link.pets)}"
    pick = (
        f"Pick a time for {many} rechecks with one link: {link.url}"
        if link.url
        else f"Call us to pick a time for {many} rechecks."
    )
    return f"Hi {owner}, {who} would like to see {_and(link.pets)} again. {pick}"


def reminder_due(f: FollowUp, now: datetime) -> bool:
    """One reminder text, when the vet left it on: the link went out REMIND_DAYS
    ago, the owner hasn't booked, and it hasn't expired or been reminded yet."""
    link = f.booking_link
    # One link for several pets: one reminder, from its first follow up.
    if link and link.followup_ids and link.followup_ids[0] != f.id:
        return False
    return bool(
        f.status == FollowUpStatus.approved
        and f.remind_unbooked
        and f.reminder is None
        and f.booking_mode == "link"
        and not f.booked_slot
        and link
        and link.sent_at
        and status_now(link) in ("sent", "opened")
        and as_utc(link.sent_at) + timedelta(days=REMIND_DAYS) <= now
    )


def reminder_text(enc: Encounter, f: FollowUp) -> str:
    """The reminder in plain words, with the same link."""
    owner = enc.owner_name.split()[0] if enc.owner_name.strip() else "there"
    pet = enc.patient_name or "your pet"
    url = f.booking_link.url if f.booking_link else ""
    pick = (
        f"Pick a time that works for you: {url}" if url else "Call us to pick a time."
    )
    pets = f.booking_link.pets if f.booking_link else []
    if len(pets) > 1:
        whose = _and([f"{p}'s" for p in pets])
        return f"Hi {owner}, a reminder to book {whose} rechecks. {pick}"
    return f"Hi {owner}, a reminder to book {pet}'s recheck. {pick}"


def item(enc: Encounter, f: FollowUp) -> dict[str, Any]:
    link = f.booking_link
    assert link is not None  # only follow ups that have a link
    sent = link.sent_at or enc.created_at
    return {
        "encounter_id": enc.id,
        "followup_id": f.id,
        "patient_id": enc.patient_id,
        "patient_name": enc.patient_name,
        "owner_name": enc.owner_name,
        "reason": f.reason,
        "title": f.title,  # short, for the booking link's sentence
        "url": link.url,
        "sent_at": link.sent_at.isoformat() if link.sent_at else None,
        "days_waiting": (datetime.now(UTC) - as_utc(sent)).days,
        "status": status_now(link),
        "pets": link.pets,  # one link for several pets: every pet it books
    }


def find(store: Store, followup_id: str) -> tuple[Encounter, FollowUp] | None:
    for enc in store.list():
        for f in enc.followups:
            if f.id == followup_id:
                return enc, f
    return None


def waiting_links(store: Store, older_than_days: int = 0) -> list[dict[str, Any]]:
    """Booking links sent and not booked yet (shape in the API contract), newest
    first."""
    out = [
        item(enc, f)
        for enc in store.list()
        for f in enc.followups
        if f.booking_link
        and f.booking_mode == "link"
        and status_now(f.booking_link) in WAITING
        # One link for several pets is one row, its first follow up's.
        and (not f.booking_link.followup_ids or f.booking_link.followup_ids[0] == f.id)
    ]
    out = [x for x in out if x["days_waiting"] >= older_than_days]
    return sorted(out, key=lambda x: x["sent_at"] or "", reverse=True)
