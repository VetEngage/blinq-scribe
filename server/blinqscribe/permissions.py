"""Who may do what (requirement 62), enforced here for REST and GraphQL alike.

Two checks. The role check is Casbin, with the rules in policy/policy.csv: a vet
does clinical work, front office resends links, uploads outside records and shares
what is signed, an admin also manages the Team. The ownership check is code: a
clinical action on a visit is only for the doctor the appointment is booked with
(an admin too, when their login is that doctor).

The API token (the glasses app, scripts) and the open demo (nobody invited) may do
everything, as before.
"""

from __future__ import annotations

from pathlib import Path

import casbin
from fastapi import HTTPException

from .accounts import Caller
from .schemas import Encounter, EncounterStatus
from .store import Store

POLICY = Path(__file__).resolve().parent / "policy"
_enforcer = casbin.Enforcer(str(POLICY / "model.conf"), str(POLICY / "policy.csv"))

# Actions on someone's visit: only for the doctor it belongs to.
CLINICAL = frozenset(
    {
        "visit.start",
        "visit.record",
        "visit.draft",
        "note.edit",
        "note.sign",
        "followup.act",
        "photo.edit",
        "remember.keep",
        "letter.write",
        "letter.sign",
    }
)
# Sharing on a visit: a vet only on their own, front office and admins on any.
OWN_FOR_VETS = frozenset(
    {"link.resend", "summary.share", "letter.send", "prescription.enter"}
)
# The shared API token is for scripts and setup: it never writes or signs a note.
NOT_FOR_TOKEN = frozenset(
    {"visit.draft", "note.edit", "note.sign", "letter.write", "letter.sign"}
)
ACTIONS = sorted(
    {*CLINICAL, "template.manage", "link.resend", "record.upload"}
    | {"summary.share", "letter.send", "team.manage", "prescription.enter"}
)
# What each action is, for refusals: "Front office can't sign notes."
DOING = {
    "visit.start": "start visits",
    "visit.record": "record visits",
    "visit.draft": "write notes",
    "note.edit": "edit notes",
    "note.sign": "sign notes",
    "followup.act": "approve follow ups",
    "photo.edit": "edit photos",
    "remember.keep": "change Remember",
    "letter.write": "write referral letters",
    "letter.sign": "sign referral letters",
    "template.manage": "change templates",
    "link.resend": "resend booking links",
    "record.upload": "upload outside records",
    "summary.share": "share summaries",
    "letter.send": "send referral letters",
    "prescription.enter": "mark prescriptions entered",
    "team.manage": "manage the team",
}
ROLE_NAMES = {"vet": "A provider", "front_office": "Front office", "admin": "An admin"}


def unrestricted(who: Caller) -> bool:
    """The API token and the open demo: every action, any visit. A session without
    a user is never treated as either."""
    return who.via in ("token", "open")


def role_allows(who: Caller, action: str) -> bool:
    if who.via == "token":
        return action not in NOT_FOR_TOKEN
    if unrestricted(who):
        return True
    if who.user is None:
        return False
    return bool(_enforcer.enforce(who.user.role, action))


def allowed(who: Caller) -> list[str]:
    """The actions this caller's role may take (clinical ones on their own visits)."""
    if unrestricted(who):
        return [a for a in ACTIONS if role_allows(who, a)]
    if who.user is None:
        return []
    return sorted(a for _, a in _enforcer.get_filtered_policy(0, who.user.role))


def owns(who: Caller, provider_id: str, ownerless_ok: bool = False) -> bool:
    """Whether the visit is this person's: its doctor is their provider. An
    appointment booked with no provider (some practice systems book by room) may be
    started by any vet (ownerless_ok), who then owns the visit; a visit that still
    has no doctor is nobody's to change."""
    if unrestricted(who):
        return True
    if who.user is None or not who.user.provider_id:
        # an admin not linked to a provider has no visits of their own
        return False
    return who.user.provider_id == provider_id if provider_id else ownerless_ok


def can(
    who: Caller, action: str, provider_id: str = "", ownerless_ok: bool = False
) -> bool:
    """The same answer as check(), without raising: for the console's `can` flags."""
    if not role_allows(who, action):
        return False
    if action in CLINICAL or (action in OWN_FOR_VETS and is_role(who, "vet")):
        return owns(who, provider_id, ownerless_ok)
    return True


def is_role(who: Caller, role: str) -> bool:
    return who.via == "session" and who.user is not None and who.user.role == role


def sees_notes(who: Caller) -> bool:
    """Whether this person reads clinical notes at all: vets (another vet's signed
    notes view only), admins who are also vets, the API token and the open demo.
    Front office and other admins see schedules, visit status and owner summaries."""
    if unrestricted(who):
        return True
    if who.user is None:
        return False
    return who.user.role == "vet" or bool(who.user.provider_id)


def check(
    who: Caller,
    action: str,
    provider_id: str = "",
    provider_name: str = "",
    store: Store | None = None,
    encounter_id: str | None = None,
    ownerless_ok: bool = False,
) -> None:
    """Raise 403 with a plain reason unless the caller may do this. Every refusal is
    audited (on the visit, when there is one)."""
    if can(who, action, provider_id, ownerless_ok):
        return
    doctor = provider_name or "the visit's provider"
    if who.via == "token":
        reason = (
            "The API token is for scripts and setup. Sign in as the provider to "
            "write or sign a note."
        )
    elif who.user is None:
        reason = "Please sign in"
    elif not role_allows(who, action):
        reason = f"{ROLE_NAMES.get(who.user.role, 'You')} can't {DOING[action]}."
    elif not who.user.provider_id:
        reason = "Link your login to a provider in Team to do clinical work."
    elif not provider_id:
        reason = "This visit has no provider it belongs to, so it can't be changed."
    elif action == "note.sign":
        reason = f"Only {doctor} can sign this note."
    elif action in OWN_FOR_VETS:
        reason = f"This is {doctor}'s visit, so only they or the front desk can "
        reason += f"{DOING[action]} here."
    else:
        reason = f"This is {doctor}'s visit, so only they can {DOING[action]} here."
    if store is not None:
        store.audit(
            who.actor, "refused", encounter_id, {"action": action, "reason": reason}
        )
    raise HTTPException(403, reason)


def default_provider(who: Caller, provider_id: str) -> str:
    """Whose schedule to show when none is asked for: a vet's own (an admin who is
    also a vet too), everyone's for front office, other admins, the API token and
    the open demo."""
    if provider_id or unrestricted(who) or who.user is None:
        return provider_id
    return who.user.provider_id


def visit_view(who: Caller, enc: Encounter) -> Encounter:
    """The visit as this reader may see it. Its own vet (and the open demo and the
    API token) see everything. Another vet sees a signed note view only, never the
    transcript; front office and admins who aren't vets see the visit's status.
    Nobody else ever sees a draft."""
    if owns(who, enc.provider_id):
        return enc
    if enc.status == EncounterStatus.signed and sees_notes(who):
        return enc.model_copy(
            update={
                "transcript": "",
                "segments": [],
                "photos": [p for p in enc.photos if p.in_note],
                "view": "view_only",
                "hidden": "View only: the transcript stays with the visit's provider.",
            }
        )
    return enc.model_copy(
        update={
            "transcript": "",
            "segments": [],
            "note": None,
            "followups": [],
            "photos": [],
            "view": "status",
            "hidden": "Draft in progress"
            if enc.status != EncounterStatus.signed
            else "Signed. The note is for providers; the owner summary is ready.",
        }
    )
