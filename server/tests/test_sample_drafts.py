"""Demo mode (no API keys): each sample visit drafts the note a real model writes, and
any other transcript drafts a note in note wording, never raw speech."""

import json
import re

import anyio
import pytest

from blinqscribe import sample
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.scribe import NoteDraft, mock_draft

FIXTURE = json.loads((sample.DATA / "sample_drafts.json").read_text())
SHIPPED = sorted(
    [sample.GENERIC, *sample.PER_PET.glob("*.txt")], key=lambda p: p.as_posix()
)
APPT = {  # the demo appointment for each sample's pet
    "Biscuit": "appt-1",
    "Miso": "appt-2",
    "Rocket": "appt-3",
    "Luna": "appt-4",
    "Pepper": "appt-5",
    "Waffles": "appt-6",
}
SPEECH = re.compile(
    r"\b(okay|ok|um+|uh+|so|I|I'm|I'll|me|my|we|we'll|us|you|your|let's)\b", re.I
)


def _appt(pet):
    if pet in HOUSEHOLD:  # the busy day's Lee household visit, on this pet
        mock = MockAdapter()
        appt = anyio.run(mock.get_appointment, f"bz-12@{mock.busy_day}")
        assert appt
        return appt.model_copy(
            update={
                "patient": next(p.patient for p in appt.pets if p.patient.name == pet)
            }
        )
    return anyio.run(MockAdapter().get_appointment, APPT[pet])


def _cases():
    for entry in FIXTURE["drafts"]:
        for path in entry["transcripts"]:
            yield pytest.param(
                path,
                entry["patient"],
                entry["draft"],
                entry.get("household", False),
                id=f"{path}:{entry['patient']}",
            )


# The household sample: one recording for the Lee household's three pets.
HOUSEHOLD = ["Hazel", "Kiwi", "Mochi"]


def test_every_shipped_sample_has_a_written_note():
    covered = {p for e in FIXTURE["drafts"] for p in e["transcripts"]}
    shipped = {p.relative_to(sample.DATA).as_posix() for p in SHIPPED}
    assert shipped == covered


@pytest.mark.parametrize(("path", "pet", "draft", "household"), list(_cases()))
def test_each_sample_drafts_its_written_note(path, pet, draft, household):
    pets = HOUSEHOLD if household else []
    got = mock_draft((sample.DATA / path).read_text(), _appt(pet), pets)
    assert got == NoteDraft.model_validate(draft)
    # Every field the real model fills, in note wording.
    for section in ("subjective", "objective", "assessment", "plan"):
        text = getattr(got, section)
        assert text and not SPEECH.search(text), (section, text)
    # A household's small pets (a bird, a rabbit) are weighed, not much more.
    said = {"weight"} if household else {"weight", "temperature", "heart_rate"}
    assert said <= set(got.vitals)
    assert got.client_summary and pet in got.client_summary
    assert all(f.reason for f in got.followups)
    words = json.dumps(draft)
    assert "—" not in words and "–" not in words  # no em or en dashes


def test_a_sample_matches_after_its_speakers_are_renamed():
    text = sample.for_patient("pat-6").replace("Dr. Rivera:", "Speaker 1:")
    got = mock_draft(text.replace("Owner:", "Jordan Lee:"), _appt("Waffles"))
    assert got.assessment.startswith("Back pain")


def test_a_sample_is_never_charted_on_another_pet():
    got = mock_draft(sample.text(), _appt("Luna"))  # Biscuit's visit, Luna's chart
    expected = FIXTURE["drafts"][0]["draft"]
    assert got.objective != expected["objective"]
    assert got.client_summary.startswith("Thanks for bringing Luna in")


MESSY = """Vet: Okay so um let's take a look at him. How long has this been going on?
Owner: Like a week I think. He keeps licking his paw.
Vet: Alright. So his temp is 102.1, heart rate is 120, he weighs 30 pounds.
Vet: Okay, his gums look good. I can feel a small lump on the left side of his chest.
Vet: So, um, the left front paw is red and swollen between the toes.
Vet: I'm going to, you know, look at it again later, I think.
Vet: I think this is an interdigital cyst, likely from allergies.
Vet: We'll start Cephalexin 500 mg twice a day and let's recheck in two weeks.
Owner: Okay thanks."""


def test_the_fallback_objective_is_note_wording_not_speech():
    draft = mock_draft(MESSY, _appt("Biscuit"))
    lines = draft.objective.splitlines()
    assert lines[0] == "- Wt 30 pounds, T 102.1 F, HR 120"  # vitals as values
    assert "- Gums normal" in lines
    assert "- Small lump on the left side of his chest" in lines
    assert "- The left front paw is red and swollen between the toes" in lines
    for line in lines:
        assert not SPEECH.search(line.removeprefix("- ")), line
        assert not line.endswith("?"), line
    assert draft.vitals == {
        "weight": "30 pounds",
        "temperature": "102.1 F",
        "heart_rate": "120",
    }
    # "I'm going to, you know, look at it again later, I think." can't be note text.
    assert draft.assessment == (
        "Interdigital cyst, likely from allergies. [confirm: other assessment]"
    )
    for section in (draft.assessment, draft.plan):
        assert not SPEECH.search(section), section


def test_speech_it_cannot_rewrite_becomes_a_confirm_marker():
    said = "Vet: Okay, I'm going to check her ears and you can hold her.\n"
    said += "Vet: Her ear is red, I'd say, um, you know?"
    draft = mock_draft(said, _appt("Luna"))
    assert draft.objective == "- [confirm: exam findings]"
    assert "hold" not in draft.objective and "?" not in draft.objective


def test_a_side_at_the_start_of_a_finding_is_kept():
    # "Right" is filler only with punctuation after it; as a side it must stay.
    said = "Vet: Right, let's look.\nVet: Right ear canal is red and swollen."
    draft = mock_draft(said, _appt("Biscuit"))
    assert "Right ear canal is red and swollen" in draft.objective
    assert "let's" not in draft.objective.lower()
