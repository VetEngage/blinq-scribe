"""Mutations. Each one calls the REST route handler of the same operation, under the
same per-visit lock where the REST route takes it.

File uploads (audio, photos, outside records) stay on REST: GraphQL takes JSON only,
so another website can't post a form to it."""

from __future__ import annotations

import strawberry

from .. import api, visit_routes
from ..schemas import AssistantRequest, AssistIn, PhotoEdit, SoapNote, TemplateIn
from .context import Context
from .types import (
    AssistantInput,
    AssistantReply,
    AssistInput,
    AssistResult,
    Encounter,
    FollowUpActionInput,
    Invite,
    NewEncounterInput,
    NewUserInput,
    OnboardReport,
    PhotoEditInput,
    RememberItem,
    ShareResult,
    SignResult,
    SoapNoteInput,
    Template,
    TemplateInput,
    User,
    UserUpdateInput,
    WaitingLink,
    WriteBackResult,
    many,
    shaped,
)

Info = strawberry.Info[Context, None]


async def start_encounter(info: Info, input: NewEncounterInput) -> Encounter:
    who = info.context.caller()
    body = api.NewEncounter.model_validate(strawberry.asdict(input))
    return shaped(Encounter, await info.context.ops.start(body, who))


async def add_pet_to_visit(info: Info, encounter_id: str, patient_id: str) -> Encounter:
    who = info.context.caller()
    body = api.AddPetIn(patient_id=patient_id)
    async with info.context.locked(encounter_id):
        enc = await info.context.ops.add_pet(encounter_id, body, who)
    return shaped(Encounter, enc)


async def add_transcript(
    info: Info, encounter_id: str, text: str, append: bool = True
) -> Encounter:
    who = info.context.caller()
    body = api.TranscriptIn(text=text, append=append)
    async with info.context.locked(encounter_id):
        enc = await info.context.ops.add_transcript(encounter_id, body, who)
    return shaped(Encounter, enc)


async def draft_note(info: Info, encounter_id: str) -> Encounter:
    who = info.context.caller()
    async with info.context.locked(encounter_id):
        enc = await info.context.ops.make_draft(encounter_id, who)
    return shaped(Encounter, enc)


async def save_note(info: Info, encounter_id: str, note: SoapNoteInput) -> Encounter:
    who = info.context.caller()
    body = SoapNote.model_validate(strawberry.asdict(note))
    async with info.context.locked(encounter_id):
        enc = info.context.ops.edit_note(encounter_id, body, who)
    return shaped(Encounter, enc)


async def set_note_type(info: Info, encounter_id: str, note_type: str) -> Encounter:
    who = info.context.caller()
    body = visit_routes.NoteTypeIn(note_type=note_type)
    async with info.context.locked(encounter_id):
        enc = info.context.ops.set_note_type(encounter_id, body, who)
    return shaped(Encounter, enc)


async def assist(info: Info, encounter_id: str, input: AssistInput) -> AssistResult:
    who = info.context.caller()
    body = AssistIn.model_validate(strawberry.asdict(input))
    return shaped(AssistResult, await info.context.ops.assist(encounter_id, body, who))


async def act_on_followup(
    info: Info,
    encounter_id: str,
    followup_id: str,
    input: FollowUpActionInput,
) -> Encounter:
    who = info.context.caller()
    body = api.FollowUpAction.model_validate(strawberry.asdict(input))
    async with info.context.locked(encounter_id):
        enc = await info.context.ops.act_on_followup(
            encounter_id, followup_id, body, who
        )
    return shaped(Encounter, enc)


async def sign_note(
    info: Info, encounter_id: str, signed_by: str = "", send: bool = True
) -> SignResult:
    who = info.context.caller()
    body = api.SignIn(signed_by=signed_by, send=send)
    async with info.context.locked(encounter_id):
        out = await info.context.ops.sign(encounter_id, body, who)
    return shaped(SignResult, out)


async def send_to_pims(info: Info, encounter_id: str) -> WriteBackResult:
    who = info.context.caller()
    async with info.context.locked(encounter_id):
        out = await info.context.ops.write_back(encounter_id, who)
    return shaped(WriteBackResult, out)


async def mark_prescription_entered(info: Info, encounter_id: str) -> Encounter:
    who = info.context.caller()
    async with info.context.locked(encounter_id):
        enc = info.context.ops.prescription_entered(encounter_id, who)
    return shaped(Encounter, enc)


async def set_plan_checks(
    info: Info, appointment_id: str, patient_id: str, lines: list[str]
) -> list[str]:
    who = info.context.caller()
    body = visit_routes.PlanChecksIn(patient_id=patient_id, lines=lines)
    kept: list[str] = await info.context.ops.set_plan_checks(appointment_id, body, who)
    return kept


async def act_on_plan_reminder(
    info: Info, encounter_id: str, reminder_id: str, action: str
) -> Encounter:
    who = info.context.caller()
    body = visit_routes.PlanReminderIn.model_validate({"action": action})
    async with info.context.locked(encounter_id):
        enc = info.context.ops.act_on_plan_reminder(
            encounter_id, reminder_id, body, who
        )
    return shaped(Encounter, enc)


async def resend_booking_link(info: Info, followup_id: str) -> WaitingLink:
    who = info.context.caller()
    return shaped(WaitingLink, await info.context.ops.resend(followup_id, who))


async def keep_remember(
    info: Info, encounter_id: str, keep: list[str]
) -> list[RememberItem]:
    who = info.context.caller()
    body = visit_routes.KeepIn(keep=keep)
    return many(
        RememberItem,
        await info.context.ops.keep_remember(encounter_id, body, who),
    )


def forget_remember(info: Info, client_id: str, item_id: str) -> bool:
    who = info.context.caller()
    info.context.ops.forget(client_id, item_id, who)
    return True


def add_template(info: Info, input: TemplateInput) -> Template:
    who = info.context.caller()
    body = TemplateIn.model_validate(strawberry.asdict(input))
    return shaped(Template, info.context.ops.add_template(body, who))


def update_template(info: Info, template_id: str, input: TemplateInput) -> Template:
    who = info.context.caller()
    body = TemplateIn.model_validate(strawberry.asdict(input))
    return shaped(Template, info.context.ops.update_template(template_id, body, who))


def delete_template(info: Info, template_id: str) -> bool:
    who = info.context.caller()
    info.context.ops.delete_template(template_id, who)
    return True


async def share_summary(
    info: Info, encounter_id: str, channel: str, language: str = "en"
) -> ShareResult:
    who = info.context.caller()
    body = visit_routes.ShareIn.model_validate(
        {"channel": channel, "language": language}
    )
    out = await info.context.ops.share_summary(
        encounter_id, body, info.context.http_request(), who
    )
    return shaped(ShareResult, out)


async def ask_assistant(info: Info, input: AssistantInput) -> AssistantReply:
    who = info.context.caller()
    req = AssistantRequest.model_validate(strawberry.asdict(input))
    return shaped(AssistantReply, await info.context.ops.ask(req, who))


async def onboard(info: Info, days: int = 90) -> OnboardReport:
    info.context.admin()
    out = await info.context.ops.onboard(api.OnboardIn(days=days))
    return shaped(OnboardReport, out)


def invite_user(info: Info, input: NewUserInput) -> Invite:
    who = info.context.admin()
    body = api.NewUserIn.model_validate(strawberry.asdict(input))
    out = info.context.ops.add_user(body, info.context.http_request(), who)
    return shaped(Invite, out)


def reinvite_user(info: Info, user_id: str) -> Invite:
    who = info.context.admin()
    out = info.context.ops.reinvite(user_id, info.context.http_request(), who)
    return shaped(Invite, out)


def update_user(info: Info, user_id: str, input: UserUpdateInput) -> User:
    who = info.context.admin()
    body = api.UserUpdateIn.model_validate(strawberry.asdict(input))
    return shaped(User, info.context.ops.update_user(user_id, body, who))


async def update_photo(
    info: Info, encounter_id: str, photo_id: str, input: PhotoEditInput
) -> Encounter:
    who = info.context.caller()
    sent = {
        k: v for k, v in strawberry.asdict(input).items() if v is not strawberry.UNSET
    }
    body = PhotoEdit.model_validate(sent)
    async with info.context.locked(encounter_id):
        enc = info.context.ops.edit_photo(encounter_id, photo_id, body, who)
    return shaped(Encounter, enc)


async def delete_photo(info: Info, encounter_id: str, photo_id: str) -> Encounter:
    who = info.context.caller()
    async with info.context.locked(encounter_id):
        enc = info.context.ops.delete_photo(encounter_id, photo_id, who)
    return shaped(Encounter, enc)


async def restore_photo(info: Info, encounter_id: str, photo_id: str) -> Encounter:
    who = info.context.caller()
    async with info.context.locked(encounter_id):
        enc = info.context.ops.restore_photo(encounter_id, photo_id, who)
    return shaped(Encounter, enc)


@strawberry.type
class Mutation:
    # ---------- a visit ----------
    start_encounter: Encounter = strawberry.mutation(
        resolver=start_encounter,
        description="Start a visit. Nothing records until the owner agreed",
    )
    add_pet_to_visit: Encounter = strawberry.mutation(
        resolver=add_pet_to_visit,
        description="Add another of the owner's pets to a visit already started. "
        "Drafted already, its note waits (Not started) until the draft is redone",
    )
    add_transcript: Encounter = strawberry.mutation(
        resolver=add_transcript, description="Add to or replace the transcript"
    )
    update_photo: Encounter = strawberry.mutation(
        resolver=update_photo,
        description="Edit a photo: label, caption, outline, crop, rotation, in_note, "
        "show_owner. Refused once the visit is signed. Upload photos with POST "
        "/api/encounters/{id}/photos (REST)",
    )
    delete_photo: Encounter = strawberry.mutation(
        resolver=delete_photo,
        description="Delete a photo: it leaves the note, the summary and every list. "
        "Its file is kept until the visit is signed (restore_photo undoes it), then "
        "purged. To retake, upload the new photo (REST) then delete the old one. "
        "Refused once the visit is signed",
    )
    restore_photo: Encounter = strawberry.mutation(
        resolver=restore_photo,
        description="Undo delete_photo, back in its place. Refused once signed",
    )
    draft_note: Encounter = strawberry.mutation(
        resolver=draft_note,
        description="Write the note and plan follow ups. Steps go to draft_progress",
    )
    save_note: Encounter = strawberry.mutation(
        resolver=save_note, description="Save the vet's edits. Refused once signed"
    )
    set_note_type: Encounter = strawberry.mutation(
        resolver=set_note_type, description="Change the note type. Refused once signed"
    )
    assist: AssistResult = strawberry.mutation(
        resolver=assist, description="Edit tool on one section. Saves nothing"
    )
    act_on_followup: Encounter = strawberry.mutation(
        resolver=act_on_followup,
        description="Approve, dismiss, retry the text, or book",
    )
    sign_note: SignResult = strawberry.mutation(
        resolver=sign_note,
        description="Sign and lock the note. send: true writes it to the PIMS now "
        "(Sign and send); false keeps it out until send_to_pims (Sign only)",
    )
    send_to_pims: WriteBackResult = strawberry.mutation(
        resolver=send_to_pims,
        description="Send a signed note to the PIMS again, when saving it failed or "
        "it is waiting for staff. Only the vet who signed it. A note already written "
        "comes back as it is",
    )
    mark_prescription_entered: Encounter = strawberry.mutation(
        resolver=mark_prescription_entered,
        description="The front desk entered the prescription in the PIMS: records "
        "who and when (audited). Marking it again keeps the first",
    )
    set_plan_checks: list[str] = strawberry.mutation(
        resolver=set_plan_checks,
        description="Keep the last plan's lines the provider ticked for this pet "
        "before the visit (asked to cover today). Returns the lines kept",
    )
    act_on_plan_reminder: Encounter = strawberry.mutation(
        resolver=act_on_plan_reminder,
        description='A last plan line the visit didn\'t cover: "added" (the provider '
        'put it in the Plan) or "dismissed". Never blocks signing',
    )
    resend_booking_link: WaitingLink = strawberry.mutation(
        resolver=resend_booking_link, description="Send a booking link again"
    )
    keep_remember: list[RememberItem] = strawberry.mutation(
        resolver=keep_remember,
        description="Keep exactly these suggestions for the household",
    )
    forget_remember: bool = strawberry.mutation(
        resolver=forget_remember, description="Delete a kept Remember item"
    )
    add_template: Template = strawberry.mutation(resolver=add_template)
    update_template: Template = strawberry.mutation(resolver=update_template)
    delete_template: bool = strawberry.mutation(resolver=delete_template)
    share_summary: ShareResult = strawberry.mutation(
        resolver=share_summary,
        description="Share the owner summary. Only after signing",
    )
    ask_assistant: AssistantReply = strawberry.mutation(
        resolver=ask_assistant,
        description="Ask the day assistant. Follow assistant_turn",
    )
    onboard: OnboardReport = strawberry.mutation(
        resolver=onboard, description="Sync the last N days of notes (default 90)"
    )
    invite_user: Invite = strawberry.mutation(
        resolver=invite_user, description="Invite someone; returns their invite link"
    )
    reinvite_user: Invite = strawberry.mutation(
        resolver=reinvite_user, description="A new invite link for someone"
    )
    update_user: User = strawberry.mutation(
        resolver=update_user, description="Rename, relink, change role, or turn off"
    )
