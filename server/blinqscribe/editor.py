"""Edit tools on one note section: Tighten, Bullets, Prose, Re-pull, Show sources,
Spanish, and the vet's own
instruction. Every result is a suggestion; nothing changes the note until the vet
accepts it.

The rules hold whatever the model says. A rewording may not bring in any word, number or
drug the vet's
text does not have; Spanish must keep exactly the same numbers and drug names; Re-pull
may not bring in a
number, drug or diagnosis word the transcript does not have. Anything else is dropped
and the vet told why.
"""

from __future__ import annotations

import re
from collections import Counter

from pydantic import BaseModel

from . import note_types
from .llm import SECTION_TOKENS, MuseClient
from .prompts import EDIT_SYSTEM, REPULL_SYSTEM, TRANSLATE_SYSTEM
from .schemas import Appointment, AssistOut, Encounter, SourceLink
from .scribe import mock_draft
from .text import BULLET, bullets, cap, prose, sentences, split_label

REWORD_ONLY = (
    "I can only reword what's already there. Add new findings, diagnoses or "
    "drugs yourself."
)
ADDED_SOMETHING = (
    "The suggestion added something that isn't in your text, so it was dropped. "
    "Edit it by hand or try again."
)

# A custom instruction asking for something new is refused before any model sees it.
ASKS_FOR_NEW = re.compile(
    r"\b(diagnos\w*|differentials?|rule[ -]?outs?|prescrib\w*|what('s| is) "
    r"wrong|recommend\w*)\b"
    r"|\b(add|include|insert|write in|put in|fill in|come up with|make up|invent|"
    r"give (him|her|them|the (dog|cat|pet|patient)))\b.{0,40}"
    r"\b(diagnos\w*|drugs?|medications?|medicines?|meds|doses?|dosages?|treatments?|findings?|tests?|labs?|"
    r"vaccines?|therapy|antibiotics?|advice|vitals?|weight|temperature|plan)\b"
    r"|\bmake (it|this|that) (say|mention)\b|\bsay (it'?s|it is|that)\b"
    r"|\b(change|switch|swap|replace)\b.{0,40}"
    r"\b(drugs?|medications?|medicines?|meds|doses?|dosages?|diagnos\w*|findings?|treatments?|antibiotics?)\b",
    re.I,
)

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
# Drug names by their usual endings, plus a few common veterinary brand names.
_DRUG = re.compile(
    r"\b\w*(cillin|mycin|micin|oxacin|azole|pril|olol|solone|sone|prazole|dipine|tidine|profen|coxib|cycline|"
    r"zepam|barbital|mectin|oxime|xetine|semide|thiazide|pentin|odone|ectin|lukast|triptyline|adol|pitant|"
    r"orphine)\b"
    r"|\b(cef\w+|meloxicam|apoquel|cytopoint|trazodone|gabapentin|carprofen|prednisone|metronidazole|"
    r"amoxicillin|clavamox|convenia|simparica|nexgard|bravecto|heartgard|insulin|vetmedin|pimobendan|"
    r"cerenia|ketamine|propofol)\b",
    re.I,
)
_CLAIM = re.compile(
    r"\b(diagnos\w*|consistent with|suspect\w*|likely|probabl\w*|rule[ "
    r"-]?out|differential\w*|"
    r"prescrib\w*|dosage|dose)\b",
    re.I,
)
_STOP = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "was",
    "were",
    "has",
    "have",
    "had",
    "his",
    "her",
    "him",
    "she",
    "they",
    "them",
    "our",
    "your",
    "you",
    "are",
    "from",
    "but",
    "not",
    "all",
    "any",
    "can",
    "will",
    "would",
    "about",
    "into",
    "its",
    "it's",
    "there",
    "their",
    "then",
    "than",
    "when",
    "what",
    "which",
    "also",
    "just",
    "very",
    "really",
    "today",
    "okay",
    "let's",
    "we'll",
    "i'm",
    "been",
    "being",
    "does",
    "done",
    "each",
    "more",
    "most",
    "much",
    "many",
    "only",
    "other",
    "over",
    "some",
    "such",
    "these",
    "those",
    "after",
    "before",
    "while",
    "both",
    "here",
    "plus",
    "because",
    "now",
    "should",
    "could",
    "shall",
    "must",
    "every",
    "once",
    "same",
}


class _Suggestion(BaseModel):
    suggestion: str = ""
    refused: str = ""


# Numbers said as words ("ten days", "twenty-five", "two hundred") become digits on
# both sides before comparing, so "10 days" matches a transcript's "ten days".
_ONES = [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
]
_TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
_WORD_VALUE = {w: i + 1 for i, w in enumerate(_ONES)} | {
    w: 10 * (i + 2) for i, w in enumerate(_TENS)
}


def _any(words: list[str]) -> str:
    return "|".join(sorted(words, key=len, reverse=True))


_SMALL = rf"(?:(?:{_any(_TENS)})(?:[\s-]+(?:{_any(_ONES[:9])}))?|(?:{_any(_ONES)}))"
_SPELLED = re.compile(
    rf"\b(?:(?:(?P<times>{_SMALL})[\s-]+)?hundred"
    rf"(?:[\s-]+(?:and[\s-]+)?(?P<plus>{_SMALL}))?|(?P<alone>{_SMALL}))\b",
    re.I,
)


def _small(words: str) -> int:
    return sum(_WORD_VALUE[w] for w in re.split(r"[\s-]+", words.lower()))


def _digits(text: str) -> str:
    """Spelled-out numbers as digits: "ten days" -> "10 days"."""

    def value(m: re.Match[str]) -> str:
        if m["alone"]:
            return str(_small(m["alone"]))
        times = _small(m["times"]) if m["times"] else 1
        return str(times * 100 + (_small(m["plus"]) if m["plus"] else 0))

    return _SPELLED.sub(value, text)


def _numbers(text: str) -> Counter[str]:
    return Counter(
        _NUMBER.findall(text)
    )  # whole tokens, so "5" never matches inside "15"


def _drugs(text: str) -> Counter[str]:
    return Counter(m.group(0).lower() for m in _DRUG.finditer(text))


def _stem(word: str) -> str:
    for suffix, to in (
        ("ies", "y"),
        ("ing", ""),
        ("ed", ""),
        ("es", ""),
        ("s", ""),
        ("ly", ""),
    ):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)] + to
    return word


# The only words a rewording may bring in freely. Never "no", "not", "never", "none" or
# "without": a new
# negation turns a finding around. No pronouns either: "she" to "he" changes the
# patient's sex.
_FUNCTION = {
    "a",
    "an",
    "the",
    "of",
    "to",
    "in",
    "on",
    "at",
    "and",
    "or",
    "is",
    "are",
    "was",
    "were",
    "with",
    "for",
    "by",
    "as",
    "it",
}


def _raw_words(text: str) -> set[str]:
    """Every word of any length, so "UTI", "BID", "OS", "no" and "r/o" all count. A
    token with a slash
    ("r/o", "w/") stays one word."""
    return {
        w for w in re.findall(r"[a-z]+(?:/[a-z]*)*", text.lower()) if w not in _FUNCTION
    }


def _words(text: str) -> set[str]:
    return {_stem(w) for w in _raw_words(text)}


# Neutral reporting verbs and connectors a rewording may bring in. Never a finding,
# diagnosis, drug, dose,
# body part, severity or plan item (so not "mild", "normal", "recheck" or "call").
_NEUTRAL = {
    "noted",
    "observed",
    "reports",
    "reported",
    "owner",
    "patient",
    "today",
    "also",
    "both",
    "which",
    "while",
    "then",
    "after",
    "before",
    "since",
    "including",
    "within",
    "appears",
    "shows",
}


def adds_something(suggestion: str, source: str, words: str = "all") -> bool:
    """True when the suggestion has a number, drug name or word the source does not.

    words="all" checks every content word (rewording), "claims" only diagnosis words
    (Re-pull from the
    transcript), "none" only numbers and drugs (a translation). Numbers said as words
    count as digits, except in a translation, whose words are another language's.
    """
    if words != "none":
        suggestion, source = _digits(suggestion), _digits(source)
    if _numbers(suggestion) - _numbers(source) or _drugs(suggestion) - _drugs(source):
        return True
    if words == "all":
        known = _words(source)
        return any(
            _stem(w) not in known and w not in _NEUTRAL for w in _raw_words(suggestion)
        )
    low = source.lower()
    return words == "claims" and any(
        m.group(0).lower() not in low for m in _CLAIM.finditer(suggestion)
    )


def drops_something(suggestion: str, source: str, spelled: bool = True) -> bool:
    """True when a number or drug in the source is missing from the suggestion (counted,
    as whole tokens). With `spelled`, numbers said as words count as digits."""
    if spelled:
        suggestion, source = _digits(suggestion), _digits(source)
    return bool(
        _numbers(source) - _numbers(suggestion) or _drugs(source) - _drugs(suggestion)
    )


# ---------------- deterministic edits (mock mode, and sources always) ----------------

_FILLER = [
    (re.compile(rx, re.I), to)
    for rx, to in (
        (
            r"\b(just|really|very|basically|actually|quite|pretty much|kind "
            r"of|sort of|definitely)\s+",
            "",
        ),
        (r"\bin order to\b", "to"),
        (r"\s{2,}", " "),
    )
]  # only removes words, so it never brings in a new one


def tighten(text: str) -> str:
    out: list[str] = []
    for s in sentences(text):
        for rx, to in _FILLER:
            s = rx.sub(to, s)
        s = cap(s.strip())
        if s and s.lower() not in (o.lower() for o in out):
            out.append(s)
    bulleted = any(BULLET.match(line) for line in text.splitlines())
    return "\n".join(f"- {s}" for s in out) if bulleted else " ".join(out)


def reorder(text: str, first: str) -> str:
    """Put the sentences that mention `first` at the top, in their order, keeping the
    rest as they were."""
    parts = sentences(text)
    words = [
        w for w in re.findall(r"[a-z]+", first.lower()) if w not in _STOP and len(w) > 2
    ]
    hit = [s for s in parts if any(w in s.lower() for w in words)]
    rest = [s for s in parts if s not in hit]
    joined = hit + rest
    bulleted = any(BULLET.match(line) for line in text.splitlines())
    return "\n".join(f"- {s}" for s in joined) if bulleted else " ".join(joined)


def mock_custom(text: str, instruction: str) -> tuple[str, str]:
    low = instruction.lower()
    if (
        m := re.search(
            r"\b(?:put|move|lead with|start "
            r"with)\s+(?:the\s+)?(.+?)\s*(?:first|at the top|on top)?$",
            low,
        )
    ) and ("first" in low or "top" in low or "lead with" in low or "start with" in low):
        return reorder(text, m.group(1)), ""
    if "bullet" in low or "list" in low:
        return bullets(text), ""
    if "prose" in low or "paragraph" in low or "sentences" in low:
        return prose(text), ""
    if any(w in low for w in ("short", "tight", "concise", "trim", "brief")):
        return tighten(text), ""
    return (
        "",
        "Mock AI can reorder, tighten, or switch bullets and prose. Add a "
        "model key for other edits.",
    )


# The demo summary's sentences, then common phrases. Anything else stays in English,
# flagged mock.
_ES_SENTENCES = [
    (re.compile(rx, re.I), to)
    for rx, to in (
        (r"^Thanks for bringing (.+?) in today\.$", r"Gracias por traer a \1 hoy."),
        (
            r"^We'd like to see them again for a recheck\.$",
            "Nos gustaría verle de nuevo para un control.",
        ),
        (
            r"^Call us if anything changes or you have questions\.$",
            "Llámenos si algo cambia o si tiene preguntas.",
        ),
    )
]
_ES_PHRASES = [
    (re.compile(rf"\b{rx}\b", re.I), to)
    for rx, to in (
        ("twice a day", "dos veces al día"),
        ("once a day", "una vez al día"),
        ("three times a day", "tres veces al día"),
        ("ear drops", "gotas para el oído"),
        ("eye drops", "gotas para los ojos"),
        ("for (\\w+) days", r"durante \1 días"),
        ("call us", "llámenos"),
        ("recheck", "control"),
        ("in two weeks", "en dos semanas"),
        ("today", "hoy"),
        ("with food", "con comida"),
        ("ten", "diez"),
        ("five", "cinco"),
        ("two", "dos"),
        ("three", "tres"),
    )
]


def mock_spanish(text: str) -> str:
    out = []
    for s in sentences(text):
        done = next((rx.sub(to, s) for rx, to in _ES_SENTENCES if rx.match(s)), None)
        if done is None:
            done = s
            for rx, to in _ES_PHRASES:
                done = rx.sub(to, done)
        out.append(done)
    return " ".join(out)


def link_sources(text: str, transcript: str) -> tuple[list[SourceLink], list[str]]:
    """Each sentence with the transcript lines behind it (by shared words and numbers).
    No match is flagged."""
    lines = transcript.splitlines()

    def words(s: str) -> set[str]:
        return {
            w
            for w in re.findall(r"[a-z]+|\d+(?:\.\d+)?", s.lower())
            if w not in _STOP and (len(w) > 2 or w.isdigit())
        }

    line_words = [words(split_label(ln)[1]) for ln in lines]
    found, unsourced = [], []
    for s in sentences(text):
        want = words(s)
        if not want or "[confirm" in s.lower():
            unsourced.append(s)
            continue
        scored = sorted(
            (
                (len(want & lw) / len(want), i)
                for i, lw in enumerate(line_words)
                if len(want & lw) >= 2
            ),
            reverse=True,
        )
        best = (
            [i for score, i in scored[:3] if score >= max(0.3, scored[0][0] * 0.75)]
            if scored
            else []
        )
        if not best:
            unsourced.append(s)
            continue
        best.sort()
        found.append(
            SourceLink(
                sentence=s,
                lines=[i + 1 for i in best],
                text="\n".join(lines[i] for i in best),
            )
        )
    return found, unsourced


# ---------------- the tool ----------------


async def translate(muse: MuseClient, text: str) -> str:
    """Spanish for the owner, or "" when the translation broke the rules (the caller
    keeps the English).
    Spanish keeps every dose, date and time exactly: the same numbers and drug names,
    nothing more."""
    if muse.enabled:
        out = await muse.structured(
            TRANSLATE_SYSTEM, text, _Suggestion, max_tokens=SECTION_TOKENS
        )
        # A translation is checked below for the same numbers and drug names, which is
        # the guard. The model sometimes fills `refused` beside a good translation, so
        # a translation it gave is kept; only an empty one is a refusal.
        suggestion = out.suggestion
    else:
        suggestion = mock_spanish(text)
    if (
        not suggestion
        or adds_something(suggestion, text, words="none")
        or drops_something(suggestion, text, spelled=False)
    ):
        return ""
    return suggestion


async def assist(
    muse: MuseClient,
    enc: Encounter,
    appt: Appointment | None,
    pets: list[str],
    section: str,
    action: str,
    text: str,
    instruction: str,
) -> AssistOut:
    mock = not muse.enabled
    if action == "sources":
        found, unsourced = link_sources(text, enc.transcript)
        return AssistOut(
            suggestion=text, sources=found, unsourced=unsourced, mock=False
        )
    if action == "translate_es" and section != "client_summary":
        return AssistOut(refused="Spanish is only for the owner summary.", mock=mock)
    if action == "custom":
        if not instruction.strip():
            return AssistOut(
                refused="Say how you'd like this section changed.", mock=mock
            )
        if ASKS_FOR_NEW.search(instruction) or _DRUG.search(instruction):
            return AssistOut(refused=REWORD_ONLY, mock=mock)
    if not text.strip() and action != "repull":
        return AssistOut(
            refused="This section is empty, so there's nothing to change.", mock=mock
        )

    if action == "repull":
        assert appt is not None  # the route loads it for a re-pull
        if mock:
            suggestion = getattr(mock_draft(enc.transcript, appt, pets), section)
        else:
            sections = note_types.NOTE_TYPES.get(
                enc.note_type, note_types.NOTE_TYPES["sick"]
            )["sections"]
            label = next(s["label"] for s in sections if s["key"] == section)
            this_pet = (
                f" (visit with {', '.join(pets)}; this pet only)"
                if len(pets) > 1
                else ""
            )
            user = (
                "NOTE "
                f"TYPE\n{note_types.guidance(enc.note_type)}\n\nSECTION\n`{section}` "
                f"({label})\n\n"
                f"PATIENT\n{appt.patient.name}{this_pet}\n\nTRANSCRIPT\n{enc.transcript}"
            )
            suggestion = (
                await muse.structured(
                    REPULL_SYSTEM, user, _Suggestion, max_tokens=SECTION_TOKENS
                )
            ).suggestion
        if adds_something(
            suggestion, enc.transcript + "\n" + appt.patient.name, words="claims"
        ):
            return AssistOut(refused=ADDED_SOMETHING, mock=mock)
        return AssistOut(suggestion=suggestion, mock=mock)

    if action == "translate_es":
        suggestion = await translate(muse, text)
        return AssistOut(
            suggestion=suggestion,
            refused="" if suggestion else ADDED_SOMETHING,
            mock=mock,
        )

    if mock:
        if action == "custom":
            suggestion, refused = mock_custom(text, instruction)
            if refused:
                return AssistOut(refused=refused, mock=True)
        else:
            suggestion = {"tighten": tighten, "bullets": bullets, "prose": prose}[
                action
            ](text)
    else:
        ask = {
            "tighten": "Tighten: shorter, same facts.",
            "bullets": "Turn into short bullet points, one per line, each starting "
            "with "
            "'- '.",
            "prose": "Turn into plain sentences in one paragraph.",
            "custom": instruction.strip(),
        }[action]
        out = await muse.structured(
            EDIT_SYSTEM,
            f"INSTRUCTION\n{ask}\n\nSECTION ({section})\n{text}",
            _Suggestion,
            max_tokens=SECTION_TOKENS,
        )
        if out.refused:
            return AssistOut(refused=REWORD_ONLY, mock=False)
        suggestion = out.suggestion
    if adds_something(suggestion, text) or drops_something(suggestion, text):
        return AssistOut(refused=ADDED_SOMETHING, mock=mock)
    return AssistOut(suggestion=suggestion, mock=mock)
