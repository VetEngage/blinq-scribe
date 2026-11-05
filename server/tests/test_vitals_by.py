"""Vitals credited to the tech who said them, from the transcript's own labels."""

import anyio

from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.prompts import SCRIBE_SYSTEM
from blinqscribe.scribe import mock_draft, tech_name


def test_the_draft_credits_the_tech_who_said_the_vitals():
    appt = anyio.run(MockAdapter().get_appointment, "appt-1")
    assert appt
    text = (
        "Tech Priya: He weighs 74 lb today, temp is 101.8, heart rate 96.\n"
        "Dr. Rivera: The right ear canal is red and swollen.\n"
    )
    got = mock_draft(text, appt)
    assert got.vitals["weight"] == "74 lb"
    assert got.vitals_by == "tech Priya"


def test_no_tech_label_no_credit():
    appt = anyio.run(MockAdapter().get_appointment, "appt-1")
    assert appt
    got = mock_draft("Speaker 3: He weighs 74 lb today.\n", appt)
    assert got.vitals_by == ""
    assert tech_name("priya (tech)") == "tech Priya"
    assert tech_name("dr. rivera") == ""
    assert "vitals_by" in SCRIBE_SYSTEM
