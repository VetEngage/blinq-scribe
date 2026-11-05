"""Demo clinic history: a few earlier days of visits, so the brief, the week strip and
To do have something.

Runs once at startup in the synthetic clinic only (store meta flag), like the
notes sync. Everything here is made up, and only Dr. Rivera's (prov-1) visits
are seeded, on the weekdays before today. Each weekday has its own visits
(mock_practice.json "week"), and the first two of Dr. Rivera's on each have a
note here, so which pets these are depends on the day of the week:

- last weekday: one unsigned draft and one signed visit
- the weekday before: a signed visit whose owner text failed
- 4 or more days ago: a signed visit with a recheck booking link still waiting
- the other earlier weekdays: signed visits, and up to two drafts ready to sign
  (nothing to confirm, no follow ups) for pets not on today's schedule, so Ready to
  sign has notes. An unsigned note never has a text or link out: those go on signing.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from types import SimpleNamespace
from typing import cast

from . import booking_links, note_types
from .adapters.base import PracticeAdapter
from .booking_links import LINK_DAYS
from .documents import Documents
from .llm import MuseClient
from .phone import mask_phone
from .schemas import (
    Appointment,
    Encounter,
    EncounterStatus,
    FollowUp,
    FollowUpKind,
    FollowUpStatus,
    SmsResult,
    SoapNote,
    WriteBackResult,
)
from .store import Store
from .voice import SEEDED_PREFIX

FLAG = "demo_history_seeded"
READY_TO_SIGN = 2  # drafts with nothing left to confirm or decide

# The notes for Dr. Rivera's first two visits on each weekday. "recheck": what a
# booking link would be for, on the day the history needs one.
NOTES: dict[str, dict[str, str]] = {
    "mon-1": {
        "subjective": "Senior visit. Owner reports Hazel is eating well again after "
        "her sore tummy.",
        "objective": "- T 101.4 F, HR 96\n- Mild tartar, abdomen soft\n- Blood drawn "
        "for a senior panel",
        "assessment": "Healthy senior dog. Appetite back to normal.",
        "plan": "- Senior panel sent out\n- Call the owner with results",
        "client_summary": "Hazel looks well and is eating again. We will call you "
        "with her bloodwork results.",
        "recheck": "Recheck Hazel's bloodwork",
    },
    "mon-2": {
        "subjective": "Owner reports Waffles is stiff getting up and hesitant on "
        "stairs x3 days.",
        "objective": "- T 101.3 F, HR 98\n- Mild discomfort on palpation of the lower "
        "back\n- Normal gait otherwise",
        "assessment": "Back pain, mild.",
        "plan": "- Strict rest 2 wk, no stairs or jumping\n- Recheck 2 wk",
        "client_summary": "Waffles has a sore back. Please keep her resting, with no "
        "stairs or jumping.",
        "recheck": "Recheck Waffles' back",
    },
    "tue-1": {
        "subjective": "Owner reports Rocket is using the paw normally. Cone on at "
        "night.",
        "objective": "- T 101.5 F, HR 104\n- Sutures intact, R front pad, no "
        "swelling or discharge",
        "assessment": "Laceration healing well.",
        "plan": "- Continue cone\n- Suture removal as booked",
        "client_summary": "Rocket's paw is healing well. Keep the cone on until the "
        "stitches come out.",
        "recheck": "Remove Rocket's sutures",
    },
    "tue-2": {
        "subjective": "Routine nail trim. Owner reports Mochi is eating hay well.",
        "objective": "- Wt 3.5 lb\n- Teeth even, nails long",
        "assessment": "Healthy rabbit. Weight steady.",
        "plan": "- Nails trimmed\n- Next trim in 3 months",
        "client_summary": "Mochi is healthy. We trimmed her nails today.",
        "recheck": "Trim Mochi's nails",
    },
    "wed-1": {
        "subjective": "Annual visit. Owner reports Kiwi is bright and singing. Mostly "
        "seed diet.",
        "objective": "- Wt 88 g\n- Feathers in good condition, beak and nails long",
        "assessment": "Healthy bird. Diet could be better.",
        "plan": "- Beak and nails trimmed\n- Move toward pellets over 4 wk",
        "client_summary": "Kiwi is healthy. Please mix in more pellets and less seed.",
        "recheck": "Recheck Kiwi's weight",
    },
    "wed-2": {
        "subjective": "Owner reports Biscuit is limping on the right front since a "
        "hike 2 days ago.",
        "objective": "- T 101.6 F, HR 92\n- Mild pain on flexing the right carpus, "
        "no swelling",
        "assessment": "Soft tissue strain, right front.",
        "plan": "- Rest and leash walks only for 1 wk\n- Recheck 1 wk",
        "client_summary": "Biscuit strained his right front leg. Leash walks only "
        "for a week.",
        "recheck": "Recheck Biscuit's leg",
    },
    "thu-1": {
        "subjective": "Dental recheck. Owner reports Waffles is eating dry food again.",
        "objective": "- Extraction sites healed\n- Gums pink",
        "assessment": "Healed well after extractions.",
        "plan": "- Brush daily if she allows\n- Dental check in 6 months",
        "client_summary": "Waffles' mouth has healed well after her dental.",
        "recheck": "Check Waffles' teeth",
    },
    "thu-2": {
        "subjective": "Owner reports Hazel is slow to rise in the mornings for 2 wk.",
        "objective": "- T 101.2 F, HR 94\n- Reduced range of motion in both hips",
        "assessment": "Hip arthritis, likely age related.",
        "plan": "- Continue joint chew\n- Recheck 2 wk to see how she is moving",
        "client_summary": "Hazel has some arthritis in her hips. Keep up the joint "
        "chew.",
        "recheck": "Recheck Hazel's hips",
    },
    "fri-1": {
        "subjective": "Owner reports Luna is scratching both ears x1 wk.",
        "objective": "- T 101.4 F, HR 108\n- Both ear canals red, waxy discharge",
        "assessment": "Ear infection, both ears, likely yeast.",
        "plan": "- Ears cleaned\n- Ear drops twice a day\n- Recheck 2 wk",
        "client_summary": "Luna has an ear infection in both ears. Use the drops "
        "twice a day.",
        "recheck": "Recheck Luna's ears",
    },
    "fri-2": {
        "subjective": "Booster visit. Owner reports Rocket is doing well.",
        "objective": "- T 101.5 F, HR 100\n- Paw fully healed",
        "assessment": "Healthy young dog.",
        "plan": "- DHPP booster given\n- Next booster in 1 year",
        "client_summary": "Rocket had his booster today and his paw has healed.",
        "recheck": "Book Rocket's next booster",
    },
}
OUTSIDE_RECORD = [
    [
        "Lakeside Emergency Vet (demo). Discharge summary for Miso, 14 year old cat.",
        "Seen overnight for vomiting x2.",
        "Bloodwork: creatinine 2.6 mg/dL, BUN 48 mg/dL.",
    ],
    [
        "Given subcutaneous fluids 150 mL.",
        "Sent home the same morning, eating small meals.",
        "Recommend recheck with the primary vet within 1 week.",
    ],
]


def tiny_pdf(pages: list[list[str]]) -> bytes:
    """A plain text PDF, one line per string. Enough for a demo outside record, with no
    dependency."""
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    kids = []
    for lines in pages:
        text = "".join(
            "({}) Tj T* ".format(
                ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            )
            for ln in lines
        )
        stream = f"BT /F1 11 Tf 14 TL 56 760 Td {text}ET"
        objs.append(f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")
        objs.append(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents "
            f"{len(objs)} 0 R "
            "/Resources << /Font << /F1 3 0 R >> >> >>"
        )
        kids.append(f"{len(objs)} 0 R")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
    out += (
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    ).encode()
    return out


def _weekdays_before(today: date, count: int) -> list[date]:
    out: list[date] = []
    d = today
    while len(out) < count:
        d -= timedelta(days=1)
        if d.weekday() < 5:
            out.append(d)
    return out


async def _noted(adapter: PracticeAdapter, day: date) -> list[Appointment]:
    """Dr. Rivera's visits that day with a note here, in time order."""
    return [
        a
        for a in await adapter.get_schedule(day, "prov-1")
        if a.id.partition("@")[0] in NOTES
    ]


def _encounter(a: Appointment, signed: bool, followups: list[FollowUp]) -> Encounter:
    key = a.id.partition("@")[0]
    # clinic-local wall time, stored like a real visit
    started = a.start.astimezone(UTC)
    eid = f"{SEEDED_PREFIX}{key}-{a.start:%m%d}"
    enc = Encounter(
        id=eid,
        appointment_id=a.id,
        patient_id=a.patient.id,
        provider_id=a.provider_id,
        provider_name=a.provider_name,
        consent_recorded=True,
        source="web",
        status=EncounterStatus.signed if signed else EncounterStatus.draft_ready,
        transcript=f"Vet: {a.reason}. Owner: Thanks, doctor.",
        note=SoapNote.model_validate(
            {k: v for k, v in NOTES[key].items() if k != "recheck"}
        ),
        followups=followups,
        created_at=started,
        patient_ids=[a.patient.id],
        patient_name=a.patient.name,
        client_id=a.client.id,
        owner_name=a.client.full_name,
        group_id=eid,
        note_type=note_types.guess(a),
    )
    if signed:
        # Signed by the booked vet. Its id starts with SEEDED_PREFIX, so these made-up
        # notes never shape the vet's voice profile, which comes from the synced notes.
        enc.signed_at, enc.signed_by = started + timedelta(minutes=25), a.provider_name
        enc.write_back = WriteBackResult(
            ok=True,
            status="written",
            pims_id=f"mock-note-{eid}",
            detail="Saved the note to the PIMS.",
            at=enc.signed_at,
        )
    return enc


async def _linked_recheck(adapter: PracticeAdapter, enc: Encounter) -> FollowUp:
    """A recheck sent as a booking link when the note was signed, the same way a real
    one is made, with the reminder on, as approving one leaves it."""
    key = enc.appointment_id.partition("@")[0]
    first = enc.owner_name.split()[0] if enc.owner_name else "there"
    f = FollowUp(
        id="f1",
        kind=FollowUpKind.recheck,
        reason=NOTES[key]["recheck"],
        due_in_days=14,
        status=FollowUpStatus.approved,
        booking_mode="link",
        message_draft=f"Hi {first}, please pick a time for {enc.patient_name}'s "
        "next visit.",
        remind_unbooked=True,
    )
    assert enc.signed_at is not None
    first_day, last_day = booking_links.window(f, enc.signed_at.date())
    f.suggested_slots = (await adapter.find_slots(first_day, last_day))[:3]
    f.booking_link = booking_links.make_link(
        adapter.booking_url_template, adapter.location_id, f, enc.signed_at.date()
    )
    f.booking_link.status, f.booking_link.sent_at = "sent", enc.signed_at
    f.booking_link.expires_at = enc.signed_at + timedelta(days=LINK_DAYS)
    return f


BUSY_FLAG = "demo_busy_day_seeded"
# A signed visit on the heavy day whose owner text didn't send, for its brief. No note
# is left unsigned there, so today's notes to sign and counts don't move.
BUSY_FAILED_TEXT = "bz-5"

# The busy day's first nine visits, seen before its clock: each signed, with a short
# note in the provider's words.
BUSY_NOTES: dict[str, dict[str, str]] = {
    "bz-1": {
        "subjective": "Here for yearly vaccines. Owner reports Bella is doing well.",
        "objective": "- T 101.2 F, HR 92\n- Bright and alert, normal exam",
        "assessment": "Healthy adult dog.",
        "plan": "- Rabies and DHPP vaccines given\n- Next vaccines in one year",
        "client_summary": "Bella is healthy and had her vaccines today.",
    },
    "bz-2": {
        "subjective": "Owner reports Gus vomited twice yesterday. Eating this morning.",
        "objective": "- T 101.6 F, HR 180\n- Abdomen soft, not painful\n- Mildly dry",
        "assessment": "Vomiting, mild. Likely ate something he shouldn't have.",
        "plan": "- Bland diet for 3 days\n- Owner to call if he vomits again",
        "client_summary": "Gus had an upset stomach. Feed a bland diet for 3 days "
        "and call us if he vomits again.",
    },
    "bz-3": {
        "subjective": "Third round of puppy vaccines. Eating and playing well.",
        "objective": "- T 101.8 F, HR 120\n- Normal puppy exam",
        "assessment": "Healthy puppy.",
        "plan": "- DHPP vaccine given\n- Rabies vaccine at the next visit",
        "client_summary": "Tucker is growing well and had his vaccine today.",
    },
    "bz-4": {
        "subjective": "Owner reports bad breath and chewing on one side.",
        "objective": "- T 101.0 F, HR 170\n- Heavy tartar on the back teeth\n- Red "
        "gums on the left",
        "assessment": "Dental disease.",
        "plan": "- Dental cleaning booked\n- Pre-anesthetic bloodwork drawn",
        "client_summary": "Cleo needs a dental cleaning. We drew her bloodwork today.",
    },
    "bz-5": {
        "subjective": "Owner reports Pickles is going outside the litter box for "
        "a week.",
        "objective": "- T 101.4 F, HR 176\n- Bladder small, not painful\n- Urine "
        "sample collected",
        "assessment": "Urinating outside the box. Urine results pending.",
        "plan": "- Urine sent to the lab\n- Call the owner with results",
        "client_summary": "We sent Pickles' urine to the lab and will call you with "
        "the results.",
    },
    "bz-6": {
        "subjective": "Ear recheck after 10 days of drops. No more head shaking.",
        "objective": "- Right ear canal clean, no discharge",
        "assessment": "Right ear infection resolved.",
        "plan": "- Stop the drops\n- Clean ears once a week",
        "client_summary": "Benny's ear has healed. Clean his ears once a week.",
    },
    "bz-7": {
        "subjective": "Owner reports licking the paws for two weeks.",
        "objective": "- T 101.5 F, HR 96\n- Red skin between the toes on all four feet",
        "assessment": "Itchy paws, likely allergies.",
        "plan": "- Medicated wipes once a day\n- Recheck if not better in 2 weeks",
        "client_summary": "Rex has itchy paws. Use the wipes once a day.",
    },
    "bz-8": {
        "subjective": "Nail and beak trim. Eating and singing normally.",
        "objective": "- Weight 36 g\n- Nails and beak overgrown, trimmed",
        "assessment": "Healthy budgie.",
        "plan": "- Next trim in 3 months",
        "client_summary": "Sunny had his nails and beak trimmed today.",
    },
    "bz-9": {
        "subjective": "Owner reports Peanut is dropping food and eating less hay.",
        "objective": "- Weight 2.0 lb\n- Front teeth overgrown, trimmed",
        "assessment": "Overgrown front teeth.",
        "plan": "- Unlimited hay\n- Recheck the teeth in 6 weeks",
        "client_summary": "Peanut's front teeth were trimmed. Give him all the hay "
        "he wants.",
    },
}


async def seed_busy_day(adapter: PracticeAdapter, store: Store) -> int:
    """The demo's heavy day as it stands at its clock: the visits seen by then,
    started when the data says (late by `started_late` minutes), so the day's pace
    comes from the record; each signed, one with an owner text that didn't send.
    Once per busy day; returns how many were added."""
    busy = getattr(adapter, "busy_day", None)
    if adapter.name != "mock" or not isinstance(busy, date):
        return 0
    if store.get_meta(BUSY_FLAG) == busy.isoformat():
        return 0
    late = {
        v["id"]: v["started_late"]
        for v in getattr(adapter, "data", {}).get("busy_day", {}).get("visits", [])
        if "started_late" in v
    }
    added = 0
    for a in await adapter.get_schedule(busy):
        key = a.id.partition("@")[0]
        if key not in late or key not in BUSY_NOTES:
            continue
        eid = f"{SEEDED_PREFIX}{key}-{a.start:%m%d}"
        if store.get(eid):
            continue
        started = (a.start + timedelta(minutes=late[key])).astimezone(UTC)
        enc = Encounter(
            id=eid,
            appointment_id=a.id,
            patient_id=a.patient.id,
            provider_id=a.provider_id,
            provider_name=a.provider_name,
            consent_recorded=True,
            source="web",
            status=EncounterStatus.signed,
            transcript=f"Vet: {a.reason}. Owner: Thanks, doctor.",
            note=SoapNote.model_validate(BUSY_NOTES[key]),
            created_at=started,
            patient_ids=[a.patient.id],
            patient_name=a.patient.name,
            client_id=a.client.id,
            owner_name=a.client.full_name,
            group_id=eid,
            note_type=note_types.guess(a),
        )
        done = started + timedelta(minutes=a.duration_min + 5)
        enc.signed_at = done
        enc.signed_by = a.provider_name
        enc.write_back = WriteBackResult(
            ok=True,
            status="written",
            pims_id=f"mock-note-{eid}",
            detail="Saved the note to the PIMS.",
            at=enc.signed_at,
        )
        if key == BUSY_FAILED_TEXT:
            first = a.client.first_name or "there"
            enc.followups = [
                FollowUp(
                    id="f1",
                    kind=FollowUpKind.client_update,
                    reason=f"Check in on {a.patient.name}",
                    status=FollowUpStatus.approved,
                    message_draft=f"Hi {first}, how is {a.patient.name} doing? "
                    "Reply here if anything changes.",
                    sms=SmsResult(
                        status="failed",
                        detail="Could not reach the texting service.",
                        to_masked=mask_phone(next(iter(a.client.phones), "")),
                        at=done,
                    ),
                )
            ]
        store.save(enc)
        added += 1
    store.set_meta(BUSY_FLAG, busy.isoformat())
    store.audit("system", "demo_busy_day_seeded", None, {"encounters": added})
    return added


async def seed_history(
    adapter: PracticeAdapter, store: Store, today: date | None = None
) -> int:
    """Seed the demo clinic's earlier days once. Returns how many encounters were
    added."""
    if adapter.name != "mock" or store.get_meta(FLAG):
        return 0
    today = today or date.today()
    days = _weekdays_before(today, 5)
    link_day = next(
        d for d in [*days[2:], today - timedelta(days=7)] if (today - d).days >= 4
    )
    last = await _noted(adapter, days[0])
    before = (await _noted(adapter, days[1]))[0]
    owner = before.client.first_name or "there"
    encs = [
        _encounter(
            last[0],
            False,
            [
                FollowUp(
                    id="f1",
                    kind=FollowUpKind.client_update,
                    reason=f"Send {last[0].patient.name}'s visit summary to the owner",
                    message_draft=f"Hi {last[0].client.first_name or 'there'}, here is "
                    f"{last[0].patient.name}'s visit summary. Thanks for coming in!",
                )
            ],
        ),
        _encounter(last[1], True, []),
        _encounter(
            before,
            True,
            [
                FollowUp(
                    id="f1",
                    kind=FollowUpKind.client_update,
                    reason=f"Check in on {before.patient.name}",
                    status=FollowUpStatus.approved,
                    message_draft=f"Hi {owner}, how is {before.patient.name} doing? "
                    "Reply here if anything changes.",
                    sms=SmsResult(
                        status="failed",
                        detail="Could not reach the texting service.",
                        to_masked=mask_phone(next(iter(before.client.phones), "")),
                    ),
                )
            ],
        ),
    ]
    on_today = {a.patient.id for a in await adapter.get_schedule(today)}
    ready = 0
    for d in days[2:]:
        if d == link_day:
            continue
        noted = await _noted(adapter, d)
        free = next((a for a in noted if a.patient.id not in on_today), None)
        pick = free if ready < READY_TO_SIGN else None
        if pick:
            ready += 1
            encs.append(_encounter(pick, False, []))
        if noted[0] is not pick:
            encs.append(_encounter(noted[0], True, []))
    linked = _encounter((await _noted(adapter, link_day))[0], True, [])
    linked.followups = [await _linked_recheck(adapter, linked)]
    encs.append(linked)
    for e in encs:
        store.save(e)
    docs = Documents(store, cast(MuseClient, SimpleNamespace(enabled=False)))
    await docs.add(
        "pat-2",
        "Lakeside Emergency discharge (demo).pdf",
        tiny_pdf(OUTSIDE_RECORD),
        # 9:40 AM twelve days ago, clinic time
        uploaded_at=datetime.combine(
            today - timedelta(days=12), time(9, 40)
        ).astimezone(UTC),
        doc_id="demo-lakeside",
    )  # once
    store.set_meta(FLAG, datetime.now().isoformat(timespec="seconds"))
    store.audit("system", "demo_history_seeded", None, {"encounters": len(encs)})
    return len(encs)
