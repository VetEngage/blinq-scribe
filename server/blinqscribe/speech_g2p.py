"""English text to Kokoro phonemes, without espeak.

Words come from misaki's pronunciation dictionaries (Apache-2.0; only its data
files are read, none of its code). Numbers and units are spelled out first. A word
the dictionaries don't have is built from known parts (plurals, -ed, -ing,
compounds), then from simple spelling rules as a last resort.
"""

from __future__ import annotations

import importlib.resources
import json
import re
from functools import cache
from pathlib import Path
from typing import Literal

from .plain import plain_words

Accent = Literal["us", "gb"]

# Short words that are weak in running speech (the dictionaries give the strong,
# spelled-out form: "a" as the letter A).
_WEAK = {"a": "ɐ", "an": "ən", "to": "tə", "of": "əv", "the": "ðə"}
_VOWEL_SOUNDS = set("AIOWYaeiouæɐɑɒɔəɚɛɜɪʊʌᵊ")

_UNITS = {
    "mg/kg": "milligrams per kilogram",
    "mg/ml": "milligrams per milliliter",
    "mg": "milligrams",
    "mcg": "micrograms",
    "kg": "kilograms",
    "g": "grams",
    "lb": "pounds",
    "lbs": "pounds",
    "oz": "ounces",
    "ml": "milliliters",
    "mL": "milliliters",
    "cc": "cc",
    "bpm": "beats per minute",
    "°F": "degrees",
    "°C": "degrees celsius",
    "cm": "centimeters",
    "mm": "millimeters",
    "mmHg": "millimeters of mercury",
    "dL": "deciliter",
    "%": "percent",
}
_ABBREVIATIONS = {
    "Dr.": "doctor",
    "Mr.": "mister",
    "Mrs.": "missus",
    "Ms.": "miz",
    "vs.": "versus",
    "e.g.": "for example",
    "i.e.": "that is",
    "SID": "once a day",
    "BID": "twice a day",
    "TID": "three times a day",
    "q12h": "every twelve hours",
    "q8h": "every eight hours",
    "q24h": "every twenty four hours",
    "QID": "four times a day",
    "PRN": "as needed",
    "PO": "by mouth",
    "SQ": "under the skin",
    "SC": "under the skin",
    "BCS": "body condition score",
    "CRT": "capillary refill time",
    "HR": "heart rate",
    "RR": "respiratory rate",
    "Hx": "history",
    "Rx": "prescription",
    "Dx": "diagnosis",
    "Tx": "treatment",
    "wk": "week",
    "wks": "weeks",
    "qty": "quantity",
}

# Our own readings, ahead of the dictionaries: the demo clinic's people and pets,
# vet drugs, words and shorthand that no general dictionary has (or has right).
_OWN: dict[str, str] = {
    word: said
    for group, words in json.loads(
        (Path(__file__).parent / "pronunciations.json").read_text()
    ).items()
    if isinstance(words, dict)
    for word, said in words.items()
}
_OWN_LOWER = {word.lower(): said for word, said in _OWN.items()}

_ONES = [
    "zero",
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
_TENS = [
    "_",
    "_",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
]
_ORDINAL = {
    "one": "first",
    "two": "second",
    "three": "third",
    "five": "fifth",
    "eight": "eighth",
    "nine": "ninth",
    "twelve": "twelfth",
}


def number_words(n: int) -> str:
    if n < 0:
        return "minus " + number_words(-n)
    if n < 20:
        return _ONES[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        return _TENS[tens] + (f" {_ONES[ones]}" if ones else "")
    for size, name in ((10**9, "billion"), (10**6, "million"), (1000, "thousand")):
        if n >= size:
            big, rest = divmod(n, size)
            return f"{number_words(big)} {name}" + (
                f" {number_words(rest)}" if rest else ""
            )
    hundreds, rest = divmod(n, 100)
    return f"{_ONES[hundreds]} hundred" + (f" {number_words(rest)}" if rest else "")


def ordinal_words(n: int) -> str:
    words = number_words(n).split()
    last = words[-1]
    if last in _ORDINAL:
        words[-1] = _ORDINAL[last]
    elif last.endswith("y"):
        words[-1] = last[:-1] + "ieth"
    else:
        words[-1] = last + "th"
    return " ".join(words)


def _say_number(match: re.Match[str]) -> str:
    whole, frac, suffix = match.group(1), match.group(2), match.group(3) or ""
    n = int(whole.replace(",", ""))
    if suffix.lower() in ("st", "nd", "rd", "th"):
        return ordinal_words(n)
    words = number_words(n)
    if frac:
        words += " point " + " ".join(_ONES[int(d)] for d in frac)
    return words


def _say_time(match: re.Match[str]) -> str:
    hour, minute = int(match.group(1)), int(match.group(2))
    if minute == 0:
        return f"{number_words(hour)} o'clock"
    return f"{number_words(hour)} {'oh ' if minute < 10 else ''}{number_words(minute)}"


def normalize(text: str) -> str:
    """Spell out what is read differently from how it is written. Vet shorthand
    first ("6yo", "SID x10d"), the same way the screen and the browser's voice say
    it."""
    text = plain_words(text)
    text = text.replace("’", "'").replace("–", " to ").replace("&", " and ")
    for short, said in _ABBREVIATIONS.items():
        text = re.sub(rf"(?<!\w){re.escape(short)}(?!\w)", said, text)
    text = re.sub(
        r"(\d)\s*(" + "|".join(re.escape(u) for u in _UNITS) + r")(?![A-Za-z])",
        lambda m: f"{m.group(1)} {_UNITS[m.group(2)]}",
        text,
    )
    text = re.sub(r"(\d)\s?(am|AM|a\.m\.)(?!\w)", r"\1 ay em", text)
    text = re.sub(r"(\d)\s?(pm|PM|p\.m\.)(?!\w)", r"\1 pee em", text)
    text = re.sub(r"\b(\d{1,2}):(\d{2})\b", _say_time, text)
    text = re.sub(r"\bx\s?(\d+)\b", r"times \1", text)  # x2: times two
    return re.sub(r"(\d[\d,]*)(?:\.(\d+))?(st|nd|rd|th)?\b", _say_number, text)


@cache
def _lexicon(accent: Accent) -> dict[str, str]:
    """Word to phonemes. Words said differently by part of speech take their usual
    reading."""
    data = importlib.resources.files("misaki.data")
    out: dict[str, str] = {}
    for kind in ("silver", "gold"):  # gold wins
        raw = json.loads((data / f"{accent}_{kind}.json").read_text())
        for word, said in raw.items():
            if isinstance(said, dict):
                said = said.get("DEFAULT") or next(iter(said.values()), None)
            if isinstance(said, str):
                out[word] = said
    return out


def _known(word: str, accent: Accent) -> str | None:
    if word.lower() in _OWN_LOWER:
        return _OWN_LOWER[word.lower()]
    lex = _lexicon(accent)
    for form in (word, word.lower(), word.capitalize()):
        if form in lex:
            return lex[form]
    return None


def _ends_voiceless(ps: str) -> bool:
    return ps[-1:] in set("ptkfθsʃʧ")


def _with_suffix(word: str, accent: Accent) -> str | None:
    """A plural, possessive, past or -ing form of a known word."""
    w = word.lower()
    base: str | None
    if w.endswith("'s"):
        owner = _phonemes(w[:-2], accent)
        if owner[-1:] in set("szʃʒʧʤ"):
            return owner + "ɪz"
        return owner + ("s" if _ends_voiceless(owner) else "z")
    if w.endswith("s") and len(w) > 3:
        for cut in (1, 2):
            base = _known(w[:-cut], accent)
            if base:
                if cut == 2:
                    return base + "ɪz"
                return base + ("s" if _ends_voiceless(base) else "z")
    if w.endswith("ed") and len(w) > 4:
        for stem in (w[:-2], w[:-1]):
            base = _known(stem, accent)
            if base:
                if base[-1:] in ("t", "d"):
                    return base + "ɪd"
                return base + ("t" if _ends_voiceless(base) else "d")
    if w.endswith("ing") and len(w) > 5:
        for stem in (w[:-3], w[:-3] + "e"):
            base = _known(stem, accent)
            if base:
                return base + "ɪŋ"
    return None


def _compound(word: str, accent: Accent) -> str | None:
    """Two known words run together, like recheck or earflap."""
    w = word.lower()
    for cut in range(len(w) - 3, 2, -1):
        head, tail = _known(w[:cut], accent), _known(w[cut:], accent)
        if head and tail:
            return head + tail.replace("ˈ", "ˌ")
    return None


# Spelling to sound, longest pattern first. Good enough for a rare name.
_SPELLING = [
    ("tion", "ʃən"),
    ("sion", "ʒən"),
    ("ough", "ʌf"),
    ("eigh", "A"),
    ("igh", "I"),
    ("tch", "ʧ"),
    ("dge", "ʤ"),
    ("sch", "sk"),
    ("ch", "ʧ"),
    ("sh", "ʃ"),
    ("th", "θ"),
    ("ph", "f"),
    ("ck", "k"),
    ("ng", "ŋ"),
    ("qu", "kw"),
    ("wh", "w"),
    ("kn", "n"),
    ("wr", "ɹ"),
    ("ee", "i"),
    ("ea", "i"),
    ("ie", "i"),
    ("oo", "u"),
    ("ai", "A"),
    ("ay", "A"),
    ("ei", "A"),
    ("ey", "A"),
    ("oa", "O"),
    ("oe", "O"),
    ("ou", "W"),
    ("ow", "O"),
    ("oi", "Y"),
    ("oy", "Y"),
    ("au", "ɔ"),
    ("aw", "ɔ"),
    ("ew", "u"),
    ("ar", "ɑɹ"),
    ("er", "əɹ"),
    ("ir", "ɜɹ"),
    ("ur", "ɜɹ"),
    ("or", "ɔɹ"),
    ("a", "æ"),
    ("e", "ɛ"),
    ("i", "ɪ"),
    ("o", "ɑ"),
    ("u", "ʌ"),
    ("y", "i"),
    ("b", "b"),
    ("c", "k"),
    ("d", "d"),
    ("f", "f"),
    ("g", "ɡ"),
    ("h", "h"),
    ("j", "ʤ"),
    ("k", "k"),
    ("l", "l"),
    ("m", "m"),
    ("n", "n"),
    ("p", "p"),
    ("r", "ɹ"),
    ("s", "s"),
    ("t", "t"),
    ("v", "v"),
    ("w", "w"),
    ("x", "ks"),
    ("z", "z"),
]


def spelled(word: str) -> str:
    """Rule-of-thumb reading of a word no dictionary has, stressed on its first
    vowel."""
    w = re.sub(r"(.)\1", r"\1", word.lower())  # doubled letters sound once
    out, i = "", 0
    while i < len(w):
        rest = w[i:]
        if rest[0] == "c" and rest[1:2] in ("e", "i", "y"):
            out, i = out + "s", i + 1
            continue
        if rest == "e" and i > 1:  # a silent final e
            break
        if rest[0] == "y" and i == 0:
            out, i = out + "j", i + 1
            continue
        if rest == "a" and i > 0:  # a final a, as in Rivera
            out, i = out + "ə", i + 1
            continue
        for pattern, sound in _SPELLING:
            if rest.startswith(pattern):
                out, i = out + sound, i + len(pattern)
                break
        else:
            i += 1
    first_vowel = next((n for n, c in enumerate(out) if c in _VOWEL_SOUNDS), 0)
    return out[:first_vowel] + "ˈ" + out[first_vowel:] if out else ""


def _phonemes(word: str, accent: Accent) -> str:
    if (
        len(word) > 1
        and word.isupper()
        and word not in _lexicon(accent)
        and word.lower() not in _OWN_LOWER
    ):
        # An abbreviation said letter by letter: AM, ICU.
        return "".join(_known(letter, accent) or "" for letter in word)
    return (
        _known(word, accent)
        or _with_suffix(word, accent)
        or _compound(word, accent)
        or spelled(word)
    )


_TOKEN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[.,!?;:—…]")


def phonemize(text: str, accent: Accent = "us") -> str:
    """Kokoro phonemes for English text, punctuation kept for the pauses."""
    words = _TOKEN.findall(normalize(text))
    out: list[str] = []
    for n, word in enumerate(words):
        if not word[0].isalpha():
            if out:
                out[-1] += word
            continue
        weak = _WEAK.get(word.lower())
        if weak:
            following = next((w for w in words[n + 1 :] if w[0].isalpha()), "")
            if (
                word.lower() == "the"
                and _phonemes(following, accent)[:2].lstrip("ˈˌ")[:1] in _VOWEL_SOUNDS
            ):
                weak = "ði"
            out.append(weak)
        else:
            out.append(_phonemes(word, accent))
    return " ".join(p for p in out if p)
