"""Visit details at the top of the owner summary: the same in the JSON, the PDF and
the owner's page, in English and Spanish, one line per pet."""

import re
from datetime import date, datetime

from blinqscribe import share


def pdf_lines(pdf: bytes) -> list[str]:
    raw = re.findall(rb"\(((?:[^()\\]|\\.)*)\) Tj", pdf)
    return [re.sub(rb"\\(.)", rb"\1", t).decode("cp1252") for t in raw]


def signed_visit(client, patient_ids=("pat-1",)):
    eid = client.post(
        "/api/encounters",
        json={
            "appointment_id": "appt-1",
            "consent_recorded": True,
            "patient_ids": list(patient_ids),
        },
    ).json()["id"]
    sample = client.get("/api/sample-transcript").json()["text"]
    client.post(f"/api/encounters/{eid}/transcript", json={"text": sample})
    client.post(f"/api/encounters/{eid}/draft")
    for e in client.get(f"/api/encounters?group_id={eid}").json():
        client.post(
            f"/api/encounters/{e['id']}/sign", json={"signed_by": "Dr. Ana Rivera"}
        )
    return eid


def appointment_start(client) -> datetime:
    appt = next(a for a in client.get("/api/schedule").json() if a["id"] == "appt-1")
    return datetime.fromisoformat(appt["start"]).replace(tzinfo=None)


def test_english_summary_and_pdf_lead_with_the_visit_details(client):
    eid = signed_visit(client)
    start = appointment_start(client)
    s = client.get(f"/api/encounters/{eid}/summary").json()
    assert s["visit"] == {
        "date": start.date().isoformat(),
        "start": start.isoformat(),
        "when": f"{start:%a, %b %-d, %Y at %-I:%M %p}",
        "provider_name": "Dr. Ana Rivera",
    }
    assert s["owner_name"] == "Jordan Lee"
    [pet] = s["pets"]
    assert (pet["species"], pet["breed"], pet["sex"], pet["age"]) == (
        "Canine",
        "Golden Retriever",
        "Male, neutered",
        6,
    )
    assert pet["age_text"] == "6 years"

    lines = pdf_lines(client.get(f"/api/encounters/{eid}/summary.pdf").content)
    # Under the title, the visit details box: each label over its value.
    box = " ".join(lines[lines.index("Visit summary") + 1 :])
    for cell in (
        f"Visit date {start:%a, %b %-d, %Y}",
        f"Appointment {start:%-I:%M %p}",
        "Seen by Dr. Ana Rivera",
        "Owner Jordan Lee",
        "Pet Biscuit · Canine · Golden Retriever · Male, neutered · 6 years",
    ):
        assert cell in box, cell
    assert lines[-2:] == [
        "Prepared by Dr. Ana Rivera. Questions? Call (217) 555-0100.",
        "Page 1 of 1",
    ] or lines[-1].startswith("Page 1 of")
    text = " ".join(lines)
    # The owner's contact details never go on the summary.
    assert "0142" not in text and "jordan@example.com" not in text


def test_spanish_summary_and_pdf(client):
    eid = signed_visit(client)
    start = appointment_start(client)
    s = client.get(f"/api/encounters/{eid}/summary?lang=es").json()
    when = s["visit"]["when"]
    assert when.startswith(f"{share._DAYS_ES[start.weekday()]}. {start.day} de ")
    assert f"de {start.year}, {start:%-I:%M} " in when
    assert when.endswith("a. m." if start.hour < 12 else "p. m.")
    assert s["pets"][0]["age_text"] == "6 años"
    lines = pdf_lines(client.get(f"/api/encounters/{eid}/summary.pdf?lang=es").content)
    box = " ".join(lines[lines.index("Resumen de la visita") + 1 :])
    for cell in (
        f"Fecha de la visita {when.rsplit(', ', 1)[0]}",
        "Mascota Biscuit · Canine · Golden Retriever · Male, neutered · 6 años",
        "Dueño Jordan Lee",
        "Atendido por Dr. Ana Rivera",
    ):
        assert cell in box, cell
    assert lines[-1].startswith("Página 1 de")


def test_a_visit_with_two_pets_lists_each_once_and_the_rest_once(client):
    eid = signed_visit(client, ("pat-1", "pat-6"))
    s = client.get(f"/api/encounters/{eid}/summary").json()
    assert [(p["name"], p["breed"], p["age"]) for p in s["pets"]] == [
        ("Biscuit", "Golden Retriever", 6),
        ("Waffles", "Dachshund", 9),
    ]
    lines = pdf_lines(client.get(f"/api/encounters/{eid}/summary.pdf").content)
    box = " ".join(lines[lines.index("Visit summary") + 1 :])
    for cell in (
        "Pet Biscuit · Canine · Golden Retriever · Male, neutered · 6 years",
        "Pet Waffles · Canine · Dachshund · Female, spayed · 9 years",
    ):
        assert cell in box, cell
    for once in ("Visit date", "Owner", "Seen by"):
        assert lines.count(once) == 1
    # Each pet still gets its own section below the details.
    assert lines.index("Biscuit") < lines.index("Waffles")

    share_out = client.post(
        f"/api/encounters/{eid}/share", json={"channel": "text", "language": "en"}
    ).json()
    page = client.post(
        f"/s/{share_out['url'].rsplit('/s/', 1)[1]}", data={"last_name": "Lee"}
    ).text
    visit = page.split('<section class="card visit">', 1)[1].split("</section>")[0]
    assert "<h2>Visit details</h2>" in visit
    assert visit.count("<p>Pet: ") == 2 and "Owner: Jordan Lee" in visit
    assert f"Date: {s['visit']['when']}" in visit


def test_missing_facts_are_left_out_and_text_is_escaped():
    s = {
        "language": "en",
        "visit": {
            "date": "2026-10-31",
            "start": None,
            "when": share.visit_when(date(2026, 10, 31), None, "en"),
            "provider_name": "",
        },
        "owner_name": "<b>Lee</b>",
        "pets": [
            {
                "name": "Miso <3",
                "species": "",
                "breed": "",
                "sex": "",
                "age_text": share.age_text(None, "en"),
                "for_owner": "",
                "medicines": [],
                "home_care": [],
                "next_visit": {"kind": "none", "text": "", "url": ""},
                "photos": [],
            }
        ],
        "when_to_call": "Call us.",
        "translated": True,
        "clinic": {"name": "Clinic", "address": "", "phone": ""},
    }
    assert share.visit_lines(s) == [
        "Date: Sat, Oct 31, 2026",
        "Pet: Miso <3",
        "Owner: <b>Lee</b>",
    ]
    page = share.page_summary(s)
    assert "<p>Owner: &lt;b&gt;Lee&lt;/b&gt;</p>" in page and "Miso &lt;3" in page
    assert "Seen by" not in page


def test_time_and_age_wording():
    afternoon = datetime(2026, 10, 31, 13, 30)
    assert (
        share.visit_when(afternoon.date(), afternoon, "en")
        == "Sat, Oct 31, 2026 at 1:30 PM"
    )
    assert (
        share.visit_when(afternoon.date(), afternoon, "es")
        == "sáb. 31 de oct. de 2026, 1:30 p. m."
    )
    morning = datetime(2026, 1, 5, 9, 5)
    assert share.visit_when(morning.date(), morning, "es") == (
        "lun. 5 de ene. de 2026, 9:05 a. m."
    )
    assert share.age_text(0, "en") == "under 1 year"
    assert share.age_text(1, "es") == "1 año" and share.age_text(0, "es") == (
        "menos de 1 año"
    )
