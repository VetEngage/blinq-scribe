"""The patient record (read only), household, search, outside records and Ask Blinq on
the open patient."""

import re
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import anyio
import pytest

from blinqscribe.adapters.base import PracticeAdapter
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.assistant import DayAssistant
from blinqscribe.demo_seed import OUTSIDE_RECORD, tiny_pdf
from blinqscribe.documents import pdf_pages
from blinqscribe.schemas import (
    AssistantRequest,
    Encounter,
    EncounterStatus,
    PastNote,
    Photo,
    SoapNote,
)
from blinqscribe.store import Store


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ---------- past visits ----------


def test_visits_merge_history_synced_notes_and_signed_visits(client, settings):
    with client:  # startup syncs the demo notes
        Store(settings.data_dir).save(
            Encounter(
                id="e1",
                appointment_id="appt-1",
                patient_id="pat-1",
                consent_recorded=True,
                status=EncounterStatus.signed,
                note=SoapNote(
                    subjective="Head shaking",
                    assessment="Otitis externa, left",
                    medications=["Ear drops"],
                ),
                photos=[
                    Photo(
                        id="ph1",
                        path="/x.jpg",
                        caption="Left ear",
                        taken_at=datetime.now(UTC),
                    )
                ],
                signed_by="Dr. Ana Rivera",
                signed_at=datetime.now(UTC),
                created_at=datetime.now(UTC),
            )
        )
        rows = client.get("/api/patients/pat-1/visits").json()
        wellness = client.get(
            "/api/patients/pat-1/visits", params={"type": "wellness"}
        ).json()
        apoquel = client.get(
            "/api/patients/pat-1/visits", params={"q": "apoquel"}
        ).json()
        related = client.get(
            "/api/patients/pat-1/visits", params={"related_to": "appt-1"}
        ).json()
        assert client.get("/api/patients/pat-404/visits").json() == []
        assert (
            client.get(
                "/api/patients/pat-1/visits", params={"type": "bogus"}
            ).status_code
            == 422
        )
    assert [r["date"] for r in rows] == sorted((r["date"] for r in rows), reverse=True)
    assert set(rows[0]) == {
        "id",
        "date",
        "type",
        "kind",
        "reason",
        "provider_name",
        "appointment_id",
        "summary",
        "related",
        "note",
        "sections",  # the note by its headings, for SOAP form
        "medications",
        "photos",
    }
    ours = rows[0]
    assert (
        ours["id"] == "blinq-e1" and ours["type"] == "Sick" and ours["kind"] == "sick"
    )
    assert ours["photos"] == [
        {"id": "ph1", "caption": "Left ear", "url": "/api/encounters/e1/photos/ph1"}
    ]
    assert (
        ours["medications"] == ["Ear drops"]
        and "A: Otitis externa, left" in ours["note"]
    )
    # A synced note joins the practice system's visit of the same day.
    synced = next(r for r in rows if r["reason"] == "Itchy face")
    assert synced["note"].startswith("S: Owner reports itching") and synced[
        "medications"
    ][0].startswith("Apoquel 16 mg")
    assert synced["provider_name"] == "Dr. Ana Rivera" and synced["kind"] == "sick"
    assert synced["summary"] == "Suspect environmental allergy."
    old = next(r for r in rows if r["reason"] == "Ear infection, left")
    assert (
        old["kind"] == "sick"
        and old["provider_name"] == "Dr. Sam Okafor"
        and old["note"] is None
    )
    assert [r["reason"] for r in wellness] == ["Annual wellness"]
    assert [r["reason"] for r in apoquel] == ["Itchy face"]
    flags = {r["reason"]: r["related"] for r in related}
    assert flags["Ear infection, left"] is True and flags["Annual wellness"] is False


# ---------- profile, invoices, household ----------


def test_profile(client):
    p = client.get("/api/patients/pat-1/profile").json()
    assert p["patient"] == {
        "id": "pat-1",
        "name": "Biscuit",
        "species": "Canine",
        "breed": "Golden Retriever",
        "age": 6,
        "sex": "Male, neutered",
        "alerts": [],
        "color": "Golden",
        "microchip": "900000000000101",
    }
    assert p["weight"]["latest"]["value"] == 72 and len(p["weight"]["history"]) == 3
    assert (
        p["reminders_due"][0]["text"] == "Rabies vaccine"
        and p["reminders_due"][0]["patient_name"] == "Biscuit"
    )
    c = p["client"]
    assert (c["name"], c["prefers"], c["reminders"], c["client_since"]) == (
        "Jordan Lee",
        "text",
        "On, by text",
        "2019-04-12",
    )
    assert c["latest_message"]["text"] == "Thank you! We'll be there."
    waffles = p["other_pets"][0]
    assert (
        waffles["name"] == "Waffles"
        and waffles["last_visit"]["reason"] == "Soft stool after diet change"
    )
    assert waffles["due"][0].startswith("DHPP booster due ") and p["mock"] is True
    assert client.get("/api/patients/pat-404/profile").status_code == 404


def test_invoices(client):
    inv = client.get("/api/clients/cli-1/invoices").json()
    assert inv["balance"] == 86.9 and inv["counts"] == {
        "all": 10,
        "pat-1": 3,
        "pat-6": 2,
        "pat-7": 2,
        "pat-8": 1,
        "pat-9": 2,
    }
    assert inv["last_payment"]["amount"] == 757.5 and inv["mock"] is True
    # Kiwi's invoice and one each for Hazel and Mochi are more than a year old.
    assert len(inv["invoices"]) == 10 and inv["last_12_months"] == 1457.35
    first = inv["invoices"][0]
    assert (
        first["patient_name"] == "Waffles"
        and first["status"] == "open"
        and first["total"] == 86.9
    )
    assert first["items"][1] == {
        "name": "Metronidazole 250 mg",
        "qty": 10,
        "price": 1.89,
    }
    assert all(
        i["paid_by"] in (None, "Card", "Cash") for i in inv["invoices"]
    )  # never a card number
    only = client.get(
        "/api/clients/cli-1/invoices", params={"patient_id": "pat-6"}
    ).json()
    assert [i["patient_id"] for i in only["invoices"]] == ["pat-6", "pat-6"] and only[
        "counts"
    ]["all"] == 10
    empty = client.get("/api/clients/cli-4/invoices").json()
    assert (
        empty["invoices"] == []
        and empty["balance"] == 0
        and empty["counts"] == {"all": 0}
    )
    assert client.get("/api/clients/cli-404/invoices").status_code == 404


def test_household_pets_for_the_list(client):
    pets = {
        p["name"]: p for p in client.get("/api/clients/cli-1/household").json()["pets"]
    }
    hazel, kiwi, mochi, waffles = (
        pets["Hazel"],
        pets["Kiwi"],
        pets["Mochi"],
        pets["Waffles"],
    )
    assert (hazel["species"], hazel["breed"], hazel["age"]) == ("Dog", "Beagle", 13)
    assert hazel["tags"] == ["Senior"] and pets["Biscuit"]["tags"] == []
    assert hazel["last_visit"]["type"] == "Sick"
    assert kiwi["last_visit"]["type"] == "Wellness"
    assert (kiwi["species"], kiwi["breed"]) == ("Bird", "Cockatiel")
    assert (mochi["species"], mochi["breed"]) == ("Rabbit", "Holland Lop")
    # What is next due, and how soon: overdue, soon (within 60 days) or later.
    assert (hazel["next_due"]["text"], hazel["next_due"]["state"]) == (
        "Bloodwork",
        "soon",
    )
    assert (kiwi["next_due"]["text"], kiwi["next_due"]["state"]) == (
        "Wellness exam",
        "overdue",
    )
    assert (mochi["next_due"]["text"], mochi["next_due"]["state"]) == (
        "Nail trim",
        "later",
    )
    assert waffles["next_due"]["text"] == "DHPP booster"
    assert waffles["alert_tags"] == ["Back care"]
    # Each date is a day, never a sentence: the page words it.
    assert all(
        re.fullmatch(r"\d{4}-\d{2}-\d{2}", p["next_due"]["due"]) for p in pets.values()
    )


def test_household_booking_link(client):
    h = client.get("/api/clients/cli-1/household").json()
    assert h["book_url"].startswith("https://") and "{" not in h["book_url"]


def test_household(client):
    h = client.get("/api/clients/cli-1/household").json()
    assert h["client"]["name"] == "Jordan Lee" and [p["name"] for p in h["pets"]] == [
        "Biscuit",
        "Waffles",
        "Hazel",
        "Kiwi",
        "Mochi",
    ]
    biscuit = h["pets"][0]
    assert biscuit["today"] == {
        "appointment_id": "appt-1",
        "time": "09:00",
        "reason": "Ear scratching, head shaking",
        "visit_status": "not_started",
        "encounter_id": "",
    }
    assert (
        biscuit["spend_12m"] == 495.9
        and h["spend_12m"] == 1457.35
        and h["balance"] == 86.9
    )
    # Spend per pet: Kiwi's only invoice is more than a year old.
    assert {p["name"]: p["spend_12m"] for p in h["pets"]} == {
        "Biscuit": 495.9,
        "Waffles": 844.4,
        "Hazel": 69.05,
        "Kiwi": 0,
        "Mochi": 48.0,
    }
    assert any(c["text"] == "Rabies vaccine due" for c in h["coming_up"])
    assert (
        h["messages"][0]["direction"] in ("in", "out")
        and h["remember"] == []
        and h["mock"] is True
    )
    assert client.get("/api/clients/cli-404/household").status_code == 404


# ---------- search ----------


def test_search(client):
    hits = client.get("/api/search", params={"q": "bisc"}).json()
    assert [p["name"] for p in hits["pets"]] == ["Biscuit"]
    pet = hits["pets"][0]
    assert pet["owner_name"] == "Jordan Lee" and pet["client_id"] == "cli-1"
    assert pet["last_visit"]["reason"] == "Itchy face"
    assert pet["next_visit"] is None or pet["next_visit"]["appointment_id"].startswith(
        "appt-1"
    )
    assert hits["owners"] == [
        {
            "id": "cli-1",
            "name": "Jordan Lee",
            "phone": "+12175550142",
            "email": "jordan@example.com",
            "pets": ["Biscuit", "Waffles", "Hazel", "Kiwi", "Mochi"],
        }
    ]
    assert [
        p["name"] for p in client.get("/api/search", params={"q": "lee"}).json()["pets"]
    ] == ["Biscuit", "Waffles", "Hazel", "Kiwi", "Mochi"]
    assert [
        p["name"]
        for p in client.get("/api/search", params={"q": "(217) 555-0167"}).json()[
            "pets"
        ]
    ] == ["Rocket"]
    assert [
        p["name"]
        for p in client.get("/api/search", params={"q": "tom@ex"}).json()["pets"]
    ] == ["Pepper"]
    assert client.get("/api/search", params={"q": "b"}).json() == {
        "pets": [],
        "owners": [],
    }
    assert client.get("/api/search", params={"q": "zzz"}).json() == {
        "pets": [],
        "owners": [],
    }


# ---------- outside records ----------


def test_outside_records(client):
    with client:  # the demo seeds one outside record for Miso
        seeded = client.get("/api/patients/pat-2/documents").json()
        pdf = tiny_pdf(
            [
                [
                    "Referral from Hillside Vet (demo) for Biscuit.",
                    "Ear cytology: cocci 3+.",
                ],
                ["Recommend recheck in 2 weeks."],
            ]
        )
        doc = client.post(
            "/api/patients/pat-1/documents",
            files={"file": ("referral.pdf", pdf, "application/pdf")},
        ).json()
        f = client.get(f"/api/patients/pat-1/documents/{doc['id']}/file")
        bad = client.post(
            "/api/patients/pat-1/documents",
            files={"file": ("x.txt", b"hello", "text/plain")},
        )
        photo = client.post(
            "/api/patients/pat-1/documents",
            files={"file": ("p.png", b"\x89PNG\r\n rest", "image/png")},
        ).json()
        listed = client.get("/api/patients/pat-1/documents").json()
        assert (
            client.get(f"/api/patients/pat-2/documents/{doc['id']}/file").status_code
            == 404
        )  # another pet's
        assert client.get("/api/patients/pat-404/documents").json() == []
    assert len(seeded) == 1 and seeded[0]["pages"] == 2 and seeded[0]["mock"] is True
    assert {p["page"] for p in seeded[0]["key_points"]} == {1, 2}
    assert set(doc) == {
        "id",
        "patient_id",
        "name",
        "uploaded_at",
        "pages",
        "content_type",
        "key_points",
        "mock",
        "detail",
    }
    assert (
        doc["pages"] == 2
        and doc["content_type"] == "application/pdf"
        and doc["mock"] is True
    )
    assert doc["key_points"] == [
        {"text": "Referral from Hillside Vet (demo) for Biscuit.", "page": 1},
        {"text": "Ear cytology: cocci 3+.", "page": 1},
        {"text": "Recommend recheck in 2 weeks.", "page": 2},
    ]
    assert [d["id"] for d in listed] == [photo["id"], doc["id"]]  # newest first
    assert (
        f.status_code == 200
        and f.headers["content-type"] == "application/pdf"
        and f.content == pdf
    )
    assert bad.status_code == 415
    assert photo["key_points"] == [] and "MODEL_API_KEY" in photo["detail"]


def test_pdf_text_by_page():
    pages, texts = pdf_pages(tiny_pdf(OUTSIDE_RECORD))
    assert (
        pages == 2
        and texts[1].splitlines()[-1]
        == "Recommend recheck with the primary vet within 1 week."
    )


@pytest.mark.anyio
async def test_live_outside_records_ask_muse_with_pages(tmp_path):
    from blinqscribe.documents import Documents, KeyPoint, KeyPoints

    class FakeMuse:
        enabled = True

        async def structured(self, system, user, schema, images=None):
            self.system, self.user = system, user
            return KeyPoints(
                points=[
                    KeyPoint(text="Cocci 3+", page=1),
                    KeyPoint(text="Made up", page=9),
                ]
            )

    muse = FakeMuse()
    doc = await Documents(Store(tmp_path), muse).add(
        "pat-1", "r.pdf", tiny_pdf([["Ear cytology: cocci 3+."]])
    )
    assert (
        "Page 1:\nEar cytology: cocci 3+." in muse.user
        and "Never interpret" in muse.system
    )
    assert (
        doc["key_points"] == [{"text": "Cocci 3+", "page": 1}] and doc["mock"] is False
    )  # page 9 does not exist


# ---------- adapter defaults for a practice system that shares less ----------


class ScheduleOnly(PracticeAdapter):
    """Only the required methods, like a new practice system on day one."""

    name = "live"

    def __init__(self):
        self.mock = MockAdapter()

    async def get_schedule(self, day, provider_id=None):
        return await self.mock.get_schedule(self.mock.today, provider_id)

    async def get_appointment(self, appointment_id):
        return await self.mock.get_appointment(appointment_id)

    async def get_visit_history(self, patient_id, patient_name=""):
        return []

    async def find_slots(self, start, end, species=""):
        return []

    async def write_back(self, encounter):
        raise NotImplementedError


@pytest.mark.anyio
async def test_base_adapter_defaults_never_invent(tmp_path):
    from blinqscribe import record

    a = ScheduleOnly()
    assert (await a.get_clinic()).name == ""
    assert (await a.get_patient("pat-1")).client_id == "cli-1"
    assert [p.name for p in await a.get_household("cli-1")] == ["Biscuit", "Waffles"]
    inv = await record.invoices(a, "cli-1")
    assert (
        inv["invoices"] == []
        and inv["balance"] is None
        and inv["last_payment"] is None
        and inv["mock"] is False
    )
    prof = await record.profile(a, "pat-1")
    assert (
        prof["weight"] == {"latest": None, "previous": None, "history": []}
        and prof["reminders_due"] == []
    )
    assert (
        prof["client"]["latest_message"] is None and prof["other_pets"][0]["due"] == []
    )
    assert [p["name"] for p in (await record.search(a, "(217) 555-0153"))["pets"]] == [
        "Miso"
    ]
    assert await a.get_updates(datetime.now()) == []


# ---------- Ask Blinq ----------


@pytest.mark.anyio
async def test_ask_blinq_pulls_up_and_knows_the_open_patient(tmp_path):
    a = DayAssistant(SimpleNamespace(enabled=False), MockAdapter(), Store(tmp_path))
    found = await a.chat(AssistantRequest(message="Pull up Biscuit"))
    assert (
        found.tools_used == ["search_patients"]
        and "Biscuit (Canine, Golden Retriever), owner Jordan Lee" in found.reply
    )
    clinical = await a.chat(
        AssistantRequest(
            message="What dose of Apoquel should I give her?", patient_id="pat-1"
        )
    )
    assert clinical.reply.startswith("That's your call.")
    history = await a.chat(
        AssistantRequest(message="What's her history?", appointment_id="appt-2")
    )
    assert history.tools_used == ["get_patient_record"] and history.reply.startswith(
        "Miso: Fractious, use towel wrap"
    )
    assert "Latest weight 8.9 lb" in history.reply


@pytest.mark.anyio
async def test_ask_blinq_live_prompt_names_the_open_patient(tmp_path):
    class Muse:
        enabled = True

        async def chat(self, messages, tools=None):
            self.system, self.tools = (
                messages[0]["content"],
                [t["function"]["name"] for t in tools],
            )
            return SimpleNamespace(content="Done.", tool_calls=None)

    muse = Muse()
    a = DayAssistant(muse, MockAdapter(), Store(tmp_path))
    await a.chat(AssistantRequest(message="How is she?", appointment_id="appt-2"))
    assert (
        "The vet has Miso open on screen (patient id pat-2, appointment id appt-2)"
        in muse.system
    )
    assert {"search_patients", "get_patient_record"} <= set(muse.tools)
    await a.chat(AssistantRequest(message="Hi"))
    assert "open on screen" not in muse.system
    assert (await a._run_tool("search_patients", {"q": "miso"}, ""))["pets"][0][
        "id"
    ] == "pat-2"
    assert (await a._run_tool("get_patient_record", {"patient_id": "nope"}, "")) == {
        "error": "patient not found"
    }


def test_upload_needs_a_known_patient_and_saves_by_real_type(client, settings):
    pdf = tiny_pdf([["Referral letter (demo)."]])
    assert (
        client.post(
            "/api/patients/pat-404/documents", files={"file": ("r.pdf", pdf)}
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/patients/..%2Fx/documents", files={"file": ("r.pdf", pdf)}
        ).status_code
        == 404
    )
    doc = client.post(
        "/api/patients/pat-1/documents", files={"file": ("x.html", pdf, "text/html")}
    ).json()
    saved = list((settings.data_dir / "media" / "documents" / "pat-1").iterdir())
    assert [p.name for p in saved] == [f"{doc['id']}.pdf"] and doc[
        "content_type"
    ] == "application/pdf"
    f = client.get(f"/api/patients/pat-1/documents/{doc['id']}/file")
    assert f.headers["content-type"] == "application/pdf"


@pytest.mark.anyio
async def test_documents_refuse_unsafe_ids(tmp_path):
    from blinqscribe.documents import Documents

    docs = Documents(Store(tmp_path), SimpleNamespace(enabled=False))
    for bad in ("../etc", "a/b", ""):
        with pytest.raises(ValueError):
            await docs.add(bad, "r.pdf", tiny_pdf([["x"]]))
    assert not (tmp_path / "media" / "documents").exists()


def test_a_note_with_no_visit_gets_a_plain_label(settings):
    """A synced note the practice system has no visit for shows as "Visit note",
    its assessment as the summary: a "Last visit" line never reads like a
    diagnosis."""
    from blinqscribe import record

    store = Store(settings.data_dir)
    store.upsert_notes(
        [
            PastNote(
                id="n-luna",
                patient_id="pat-4",
                date=datetime.now() - timedelta(days=5),
                provider_id="prov-1",
                provider_name="Dr. Ana Rivera",
                text="S: Snoring more.\nA: Brachycephalic airway syndrome suspected.",
            )
        ]
    )
    rows = anyio.run(record.visits, MockAdapter(), store, "pat-4")
    assert [(r["reason"], r["summary"]) for r in rows] == [
        ("Visit note", "Brachycephalic airway syndrome suspected.")
    ]


def test_next_due_and_booking_link_edges():
    from blinqscribe import record
    from blinqscribe.schemas import Reminder

    today = date(2026, 10, 30)
    assert record._next_due([], today) is None
    assert record._next_due([Reminder(text="Note")], today) is None  # no day
    later = Reminder(text="Dental", due="2027-03-01")
    soon = Reminder(text="Rabies", due="2026-12-20")
    assert record._next_due([later, soon], today) == {
        "text": "Rabies",
        "due": "2026-12-20",
        "state": "soon",
    }
    assert record._next_due([Reminder(text="Exam", due="2026-10-29")], today)[
        "state"
    ] == ("overdue")
    assert record._next_due([later], today)["state"] == "later"
    # No template, no link; a template with other placeholders, no link.
    assert record._book_url(MockAdapter(), today) == ""
    assert (
        record._book_url(MockAdapter(booking_url_template="https://b/{nope}"), today)
        == ""
    )
    assert record._book_url(
        MockAdapter(
            booking_url_template="https://b/{location_id}?s={service_id}&t={start}"
        ),
        today,
    ).startswith("https://b/mock-loc-1?s=&t=2026-10-31")
