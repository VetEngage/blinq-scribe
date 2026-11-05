"""Plain words for what Blinq says: vet shorthand spelled out ("6yo" is "6 year old",
"SID x10d" is "once a day for 10 days"), and Ask Blinq answers as a few spoken
sentences with no markdown, bullets or "[confirm ...]" markers.

`plain_words` is shared with read aloud (speech_g2p.normalize runs it first) and the
web's browser voice mirrors it (web/src/lib/plainWords.ts); both are checked against
the same cases in web/src/lib/plainWords.cases.json.
"""

from __future__ import annotations

import re

# Said the same whether the screen shows it or a voice reads it.
_FREQUENCY = {
    "SID": "once a day",
    "BID": "twice a day",
    "TID": "three times a day",
    "QID": "four times a day",
    "q24h": "every 24 hours",
    "q12h": "every 12 hours",
    "q8h": "every 8 hours",
    "PRN": "as needed",
    "PO": "by mouth",
}
_SPAN = {
    "d": "day",
    "day": "day",
    "days": "day",
    "w": "week",
    "wk": "week",
    "wks": "week",
    "week": "week",
    "weeks": "week",
    "mo": "month",
    "mos": "month",
    "month": "month",
    "months": "month",
}
# Words before "d/c" that make it a discharge (an exam finding), not "discontinue".
_DISCHARGE = (
    "ear|ears|nasal|ocular|eye|eyes|vaginal|vulvar|preputial|wound|brown|yellow|"
    "green|white|clear|bloody|purulent|serous|mucoid|mucopurulent|waxy|ceruminous|"
    "some|mild|moderate|marked|scant|copious|thick|thin|malodorous"
)

_AGE_YEARS = re.compile(
    r"\b(\d+)[\s-]*(?:y\.o\.?|yo|y/o|yrs?\.?[\s-]*old)(?![A-Za-z])",
    re.I,
)
_AGE_MONTHS = re.compile(
    r"\b(\d+)[\s-]*(?:m\.o\.?|mo|m/o|mos?\.?[\s-]*old)(?![A-Za-z])",
    re.I,
)
_FOR_SPAN = re.compile(r"(?<![A-Za-z])x\s*(\d+)\s*(" + "|".join(_SPAN) + r")\b", re.I)
_FREQ = re.compile(r"(?<![\w/])(" + "|".join(_FREQUENCY) + r")(?![\w/])")


def _span(m: re.Match[str]) -> str:
    n, unit = int(m.group(1)), _SPAN[m.group(2).lower()]
    return f"for {n} {unit}{'' if n == 1 else 's'}"


# "Rx Apoquel" is the drug; "Recheck 4 wk" is "Recheck in 4 weeks".
_RX = re.compile(r"(?<![A-Za-z])Rx:?\s+(?=[A-Za-z])")
_RECHECK = re.compile(
    r"\b(recheck)\s+(?:in\s+)?(\d+)\s*(" + "|".join(_SPAN) + r")\b", re.I
)


def _recheck(m: re.Match[str]) -> str:
    n, unit = int(m.group(2)), _SPAN[m.group(3).lower()]
    return f"{m.group(1)} in {n} {unit}{'' if n == 1 else 's'}"


# "Bland diet 4d" is "for 4 days", "in 48h" is "in 48 hours". "3D" stays.
_BARE_SPAN = re.compile(
    r"(?:\b(in|within|after|over|for|every)\s+)?(?<![\w.])(\d+)(d|h)(?![\w/])"
)


def _bare_span(m: re.Match[str]) -> str:
    n = int(m.group(2))
    unit = ("day" if m.group(3) == "d" else "hour") + ("" if n == 1 else "s")
    return f"{m.group(1) or 'for'} {n} {unit}"


def plain_words(text: str) -> str:
    """Vet shorthand in plain words. Numbers stay digits."""
    text = _RX.sub("", text)
    text = _RECHECK.sub(_recheck, text)
    text = _AGE_YEARS.sub(r"\1 year old", text)
    text = _AGE_MONTHS.sub(r"\1 month old", text)
    text = _FOR_SPAN.sub(_span, text)
    text = _BARE_SPAN.sub(_bare_span, text)
    text = _FREQ.sub(lambda m: _FREQUENCY[m.group(1)], text)
    text = re.sub(r"(?<![A-Za-z])w/o(?![A-Za-z])", "without", text, flags=re.I)
    text = re.sub(r"(?<![A-Za-z])w/(?=\s|[A-Za-z])\s*", "with ", text, flags=re.I)
    text = re.sub(rf"\b({_DISCHARGE})\s+d/c\b", r"\1 discharge", text, flags=re.I)
    text = re.sub(r"(?<=[A-Za-z])\s*\+\s*(?=[A-Za-z])", " and ", text)
    return text


def _confirm(m: re.Match[str]) -> str:
    """ "[confirm product/dose/duration]" in words: "(product, dose and duration not
    confirmed yet)"."""
    items = [w.strip() for w in re.split(r"[/,]| and ", m.group(1)) if w.strip()]
    if not items:
        return " (not confirmed yet)"
    said = items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]
    return f" ({said} not confirmed yet)"


_MARKER = re.compile(r"\[(\s*confirm\s*:?)([^\]]*)\]", re.I)


def plain_markers(text: str) -> str:
    """Plain words inside "[confirm: ...]": "name/dose" is "name and dose",
    "product/dose/duration" is "product, dose and duration"."""

    def said(m: re.Match[str]) -> str:
        items = [w.strip() for w in m.group(2).split("/") if w.strip()]
        if len(items) < 2:
            return m.group(0)
        words = ", ".join(items[:-1]) + " and " + items[-1]
        return f"[confirm: {words}]"

    return _MARKER.sub(said, text)


def plain_answer(text: str) -> str:
    """An answer as a few spoken sentences: no markdown, no bullet list, no
    "[confirm ...]" marker, no shorthand."""
    text = re.sub(r"\s*\[\s*confirm\s*:?\s*([^\]]*)\]", _confirm, text, flags=re.I)
    text = re.sub(r"\*\*|__|`", "", text)
    text = re.sub(r"(?<![\w*])\*(?!\s)([^*\n]+?)\*(?!\w)", r"\1", text)  # *italic*
    sentences = []
    for line in text.splitlines():
        line = re.sub(r"^\s*(?:#+\s*|[-*•]\s+|\d+[.)]\s+)", "", line).strip()
        if not line:
            continue
        if line[-1] in ":;,":
            line = line[:-1] + "."
        elif not re.search(r"[.!?][\"')]*$", line):
            line += "."
        sentences.append(line)
    out = " ".join(sentences)
    out = re.sub(r"(?<=\d)\s*[–—]\s*(?=\d)", " to ", out)  # 9–10: 9 to 10
    out = re.sub(r"\s*[—–]\s*|\s+-\s+", ", ", out)  # dashes between words: commas
    return re.sub(r"\s{2,}", " ", plain_words(out)).strip()
