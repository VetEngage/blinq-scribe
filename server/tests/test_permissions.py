"""Roles and permissions (requirement 62): every role against every action, on the
doctor's own visit and on a colleague's, over REST and GraphQL."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from blinqscribe.api import create_app

PASSWORD = "correct horse battery staple"
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200 + b"\xff\xd9"
CLINICAL = [
    "start",
    "transcript",
    "photo",
    "draft",
    "edit_note",
    "note_type",
    "assist",
    "followup",
    "edit_photo",
    "remember",
]
# What each role may do on Dr. Rivera's (prov-1) visit (the PRD's Roles and
# permissions table). Reads are everyone's, redacted by role.
MAY = {
    "rivera": {*CLINICAL, "template", "resend", "upload", "share"},
    "okafor": {"template", "upload"},  # another vet: view only
    "front": {"resend", "upload", "share"},  # resends what a vet approved
    "admin": {"template", "resend", "upload", "share", "team"},  # not a vet
}


def h(token):
    return {"Authorization": f"Bearer {token}"}


def invite(client, username, name, provider_id="", role="vet", headers=None):
    r = client.post(
        "/api/admin/users",
        json={
            "username": username,
            "name": name,
            "provider_id": provider_id,
            "role": role,
        },
        headers=headers or {},
    )
    assert r.status_code == 200, r.text
    token = r.json()["invite_url"].split("#invite=")[1]
    r = client.post(
        "/api/auth/invite/accept", json={"token": token, "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def client(settings):
    with TestClient(
        create_app(replace(settings, sms_mode="preview")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    ) as c:
        yield c


@pytest.fixture
def team(client):
    admin = invite(client, "maya", "Maya Admin", role="admin")
    by_admin = h(admin)
    return {
        "admin": admin,
        "rivera": invite(
            client, "arivera", "Dr. Ana Rivera", "prov-1", headers=by_admin
        ),
        "okafor": invite(
            client, "sokafor", "Dr. Sam Okafor", "prov-2", headers=by_admin
        ),
        "front": invite(
            client, "desk", "Pat Desk", role="front_office", headers=by_admin
        ),
    }


def drafted(client, token, appt="appt-1"):
    eid = client.post(
        "/api/encounters",
        json={"appointment_id": appt, "consent_recorded": True},
        headers=h(token),
    ).json()["id"]
    sample = client.get("/api/sample-transcript", headers=h(token)).json()["text"]
    client.post(
        f"/api/encounters/{eid}/transcript", json={"text": sample}, headers=h(token)
    )
    client.post(
        f"/api/encounters/{eid}/photos",
        files={"file": ("a.jpg", JPEG)},
        headers=h(token),
    )
    return client.post(f"/api/encounters/{eid}/draft", headers=h(token)).json()


def attempt(client, who, action, enc, signed):
    """Try one action as `who`; returns the HTTP status."""
    eid, auth = enc["id"], h(who)
    fid = enc["followups"][0]["id"]
    pid = enc["photos"][0]["id"]
    calls = {
        "start": lambda: client.post(
            "/api/encounters",
            json={"appointment_id": "appt-1", "consent_recorded": True},
            headers=auth,
        ),
        "transcript": lambda: client.post(
            f"/api/encounters/{eid}/transcript", json={"text": "More."}, headers=auth
        ),
        "photo": lambda: client.post(
            f"/api/encounters/{eid}/photos",
            files={"file": ("b.jpg", JPEG)},
            headers=auth,
        ),
        "draft": lambda: client.post(f"/api/encounters/{eid}/draft", headers=auth),
        "edit_note": lambda: client.put(
            f"/api/encounters/{eid}/note", json=enc["note"], headers=auth
        ),
        "note_type": lambda: client.put(
            f"/api/encounters/{eid}/note-type",
            json={"note_type": "sick"},
            headers=auth,
        ),
        "assist": lambda: client.post(
            f"/api/encounters/{eid}/assist",
            json={"section": "plan", "action": "tighten"},
            headers=auth,
        ),
        "followup": lambda: client.post(
            f"/api/encounters/{eid}/followups/{fid}",
            json={"action": "dismiss"},
            headers=auth,
        ),
        "edit_photo": lambda: client.patch(
            f"/api/encounters/{eid}/photos/{pid}", json={"label": "Ear"}, headers=auth
        ),
        "remember": lambda: client.post(
            f"/api/encounters/{eid}/remember", json={"keep": []}, headers=auth
        ),
        "template": lambda: client.post(
            "/api/templates",
            json={
                "name": "Ears",
                "shortcut": f"ears{abs(hash(who)) % 10_000}",
                "text": "Ears clean.",
            },
            headers=auth,
        ),
        "resend": lambda: client.post(f"/api/followups/{fid}/resend", headers=auth),
        "upload": lambda: client.post(
            "/api/patients/pat-1/documents",
            files={"file": ("r.jpg", JPEG, "image/jpeg")},
            headers=auth,
        ),
        "share": lambda: client.post(
            f"/api/encounters/{signed['id']}/share",
            json={"channel": "print"},
            headers=auth,
        ),
        "team": lambda: client.get("/api/admin/users", headers=auth),
    }
    return calls[action]().status_code


def test_every_role_against_every_action_on_rivera_s_visit(client, team):
    enc = drafted(client, team["rivera"])
    signed = drafted(client, team["rivera"])
    client.post(
        f"/api/encounters/{signed['id']}/sign", json={}, headers=h(team["rivera"])
    )
    for role in (
        "okafor",
        "front",
        "admin",
        "rivera",
    ):  # the owner last: it changes things
        for action in [*CLINICAL, "template", "resend", "upload", "share", "team"]:
            status = attempt(client, team[role], action, enc, signed)
            if action in MAY[role]:
                assert status != 403, (role, action)
            else:
                assert status == 403, (role, action, status)

    # Everyone signed in reads everything: schedules, records, households, notes.
    for role in ("okafor", "front", "admin", "rivera"):
        auth = h(team[role])
        for path in (
            "/api/schedule?provider_id=prov-1",
            f"/api/encounters/{enc['id']}",
            "/api/patients/pat-1/visits",
            "/api/patients/pat-1/profile",
            "/api/patients/pat-1/notes",
            "/api/clients/cli-1/household",
            "/api/brief?provider_id=prov-1",
            "/api/end-of-day?provider_id=prov-1",
        ):
            assert client.get(path, headers=auth).status_code == 200, (role, path)


def test_signing_is_the_doctor_s_own(client, team):
    enc = drafted(client, team["rivera"])
    for role, reason in (
        ("okafor", "Only Dr. Ana Rivera can sign this note."),
        ("front", "Front office can't sign notes."),
        ("admin", "Link your login to a provider in Team to do clinical work."),
    ):
        r = client.post(
            f"/api/encounters/{enc['id']}/sign",
            json={"signed_by": "Dr. Ana Rivera"},
            headers=h(team[role]),
        )
        assert (r.status_code, r.json()["detail"]) == (403, reason)
    r = client.post(
        f"/api/encounters/{enc['id']}/sign",
        json={"signed_by": "Someone Else"},  # ignored: you sign as yourself
        headers=h(team["rivera"]),
    )
    assert r.json()["encounter"]["signed_by"] == "Dr. Ana Rivera"
    audit = client.get(f"/api/encounters/{enc['id']}/audit", headers=h(team["front"]))
    refused = [a for a in audit.json() if a["action"] == "refused"]
    assert [(a["actor"], a["detail"]["action"]) for a in refused] == [
        ("sokafor", "note.sign"),
        ("desk", "note.sign"),
        ("maya", "note.sign"),
    ]


def test_an_admin_linked_to_a_provider_works_their_own_visits(client):
    admin = invite(client, "sam", "Dr. Sam Okafor", "prov-2", role="admin")
    mine = drafted(client, admin, "appt-5")  # booked with prov-2
    r = client.post(f"/api/encounters/{mine['id']}/sign", json={}, headers=h(admin))
    assert r.status_code == 200
    assert r.json()["encounter"]["signed_by_provider_id"] == "prov-2"
    theirs = client.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=h(admin),
    )
    assert theirs.status_code == 403


def test_each_role_opens_on_the_right_schedule(client, team):
    def doctors(role, **params):
        rows = client.get("/api/schedule", params=params, headers=h(team[role])).json()
        return {a["provider_id"] for a in rows}

    assert doctors("rivera") == {"prov-1"}  # a vet opens on their own
    assert doctors("okafor") == {"prov-2"}
    assert doctors("rivera", provider_id="prov-2") == {"prov-2"}  # a colleague's
    assert doctors("front") == doctors("admin") == {"prov-1", "prov-2"}


def test_the_open_demo_and_the_api_token_may_do_everything(client, settings):
    enc = drafted(client, "")  # nobody invited: the open demo
    r = client.post(f"/api/encounters/{enc['id']}/sign", json={"signed_by": "Dr. Demo"})
    assert r.status_code == 200 and r.json()["encounter"]["signed_by"] == "Dr. Demo"
    token = TestClient(create_app(replace(settings, api_token="s3cret")))
    started = token.post(
        "/api/encounters",
        json={"appointment_id": "appt-5", "consent_recorded": True},
        headers=h("s3cret"),
    )
    assert started.status_code == 200


# ---------- GraphQL: the same rules, FORBIDDEN, and can flags ----------


def gql(client, token, query, **variables):
    return client.post(
        "/graphql", json={"query": query, "variables": variables}, headers=h(token)
    ).json()


def test_graphql_refuses_the_same_way(client, team):
    enc = drafted(client, team["rivera"])
    fid = enc["followups"][0]["id"]
    eid = enc["id"]
    mutations = {
        "start_encounter": "mutation { start_encounter(input: "
        '{appointment_id: "appt-1", consent_recorded: true}) { id } }',
        "draft_note": f'mutation {{ draft_note(encounter_id: "{eid}") {{ id }} }}',
        "act_on_followup": "mutation { act_on_followup("
        f'encounter_id: "{eid}", followup_id: "{fid}", '
        'input: {action: "dismiss"}) { id } }',
        "sign_note": f'mutation {{ sign_note(encounter_id: "{eid}") '
        "{ encounter { id } } }",
    }
    for role in ("okafor", "front", "admin"):
        for name, query in mutations.items():
            body = gql(client, team[role], query)
            assert body["errors"][0]["extensions"] == {
                "code": "FORBIDDEN",
                "status": 403,
            }, (role, name)
    resend = gql(
        client,
        team["front"],
        f'mutation {{ resend_booking_link(followup_id: "{fid}") {{ status }} }}',
    )
    assert resend["errors"][0]["extensions"]["code"] != "FORBIDDEN"
    signed = gql(client, team["rivera"], mutations["sign_note"])
    assert signed["data"]["sign_note"]["encounter"]["id"] == enc["id"]


CAN = (
    "can { start record draft edit approve sign edit_photos remember "
    "write_letter share resend }"
)


def test_can_flags_match_the_rules(client, team):
    enc = drafted(client, team["rivera"])
    query = (
        "query ($id: String!) { encounter(encounter_id: $id) { "
        + CAN
        + ' } schedule(provider_id: "prov-1") { id '
        + CAN
        + " } }"
    )
    seen = {
        role: gql(client, team[role], query, id=enc["id"])["data"]
        for role in ("rivera", "okafor", "front", "admin")
    }
    assert all(seen["rivera"]["encounter"]["can"].values())
    assert not any(seen["okafor"]["encounter"]["can"].values())  # view only
    for role in ("front", "admin"):
        can = seen[role]["encounter"]["can"]
        assert {k for k, v in can.items() if v} == {"share", "resend"}, role
    assert seen["rivera"]["schedule"][0]["can"]["start"] is True
    assert seen["front"]["schedule"][0]["can"]["start"] is False


def test_the_open_demo_can_do_everything(client):
    enc = drafted(client, "")
    data = gql(
        client,
        "",
        "query ($id: String!) { encounter(encounter_id: $id) { " + CAN + " } }",
        id=enc["id"],
    )["data"]
    assert all(data["encounter"]["can"].values())


# ---------- referral letters: in the Letters service, so REST and GraphQL agree ----


def test_referral_letters_follow_the_same_rules(client, team):
    rivera = team["rivera"]
    enc = drafted(client, rivera)
    client.post(f"/api/encounters/{enc['id']}/sign", json={}, headers=h(rivera))
    create = (
        f'mutation {{ create_letter(encounter_id: "{enc["id"]}", input: {{reason: '
        '"Refer to dermatology", recipient: {name: "Dr. Derm"}, owner_consent: true})'
        " { id status } }"
    )

    def on(letter_id):
        return {
            "update": f'mutation {{ update_letter(id: "{letter_id}", '
            'input: {reason: "Ears"}) { id } }',
            "draft": f'mutation {{ draft_letter(id: "{letter_id}") {{ id }} }}',
            # The first send signs the letter: the owning vet's alone.
            "sign": f'mutation {{ send_letter(id: "{letter_id}", channels: ["print"])'
            " { letter { status } } }",
            "delete": f'mutation {{ delete_letter(id: "{letter_id}") }}',
        }

    def code(body):
        return body["errors"][0]["extensions"]["code"] if body.get("errors") else ""

    letter = gql(client, rivera, create)["data"]["create_letter"]["id"]
    for role in ("okafor", "front", "admin"):
        assert code(gql(client, team[role], create)) == "FORBIDDEN", role
        for name, query in on(letter).items():
            assert code(gql(client, team[role], query)) == "FORBIDDEN", (role, name)
        # A draft is the owning vet's alone: missing to anyone else, PDF included.
        read = gql(client, team[role], f'{{ letter(id: "{letter}") {{ status }} }}')
        assert code(read) == "NOT_FOUND", role
        listed = gql(client, team[role], '{ letters(patient_id: "pat-1") { id } }')
        assert letter not in {x["id"] for x in listed["data"]["letters"]}, role
        pdf = client.get(f"/api/letters/{letter}.pdf", headers=h(team[role]))
        assert pdf.status_code == 404, role

    # The visit's doctor writes and signs it, as themselves.
    for name in ("update", "draft"):
        assert code(gql(client, rivera, on(letter)[name])) == "", name
    signed = gql(client, rivera, on(letter)["sign"])
    assert signed["data"]["send_letter"]["letter"]["status"] != "draft"

    # Sent: another vet reads it all (view only); front office and an admin who
    # isn't a vet see who it went to and its status, never the body or the PDF.
    read = '{ letter(id: "%s") { view status body reason recipient { name } } }'
    seen = {
        role: gql(client, team[role], read % letter)["data"]["letter"]
        for role in ("okafor", "front", "admin")
    }
    assert seen["okafor"]["view"] == "full" and seen["okafor"]["body"]
    for role in ("front", "admin"):
        assert seen[role]["view"] == "summary" and seen[role]["body"] == "", role
        assert seen[role]["reason"] == "" and seen[role]["recipient"]["name"], role
    pdf = {
        role: client.get(f"/api/letters/{letter}.pdf", headers=h(team[role]))
        for role in ("okafor", "front", "admin")
    }
    assert pdf["okafor"].status_code == 200
    assert pdf["front"].status_code == pdf["admin"].status_code == 403
    opened = [
        a["actor"]
        for a in client.get(
            f"/api/encounters/{enc['id']}/audit", headers=h(rivera)
        ).json()
        if a["action"] == "letter_read"
    ]
    assert opened and set(opened) == {"sokafor"}  # another vet opening it is logged

    # Sending it again: its vet, front office or an admin; never a colleague.
    for role in ("front", "okafor", "admin", "rivera"):
        sent = gql(client, team[role], on(letter)["sign"])
        assert (code(sent) == "FORBIDDEN") == (role == "okafor"), (role, sent)

    spare = gql(client, rivera, create)["data"]["create_letter"]["id"]
    assert gql(client, rivera, on(spare)["delete"])["data"]["delete_letter"] is True
    audit = client.get(f"/api/encounters/{enc['id']}/audit", headers=h(rivera)).json()
    refused = {a["detail"]["action"] for a in audit if a["action"] == "refused"}
    assert {"letter.write", "letter.sign"} <= refused


def test_a_letter_from_the_record_belongs_to_the_vet_who_started_it(client, team):
    create = (
        'mutation { create_letter(patient_id: "pat-1", input: {reason: '
        '"Refer to cardiology", recipient: {name: "Dr. Heart"}, owner_consent: true})'
        " { id } }"
    )

    def code(body):
        return body["errors"][0]["extensions"]["code"] if body.get("errors") else ""

    # Any vet may start one; front office and an admin who isn't a doctor can't.
    for role in ("front", "admin"):
        assert code(gql(client, team[role], create)) == "FORBIDDEN", role
    letter = gql(client, team["okafor"], create)["data"]["create_letter"]["id"]
    on = {
        "draft": f'mutation {{ draft_letter(id: "{letter}") {{ id }} }}',
        # The vet's own words replace the draft's [confirm: ...] gaps, then sign.
        "update": f'mutation {{ update_letter(id: "{letter}", input: '
        '{reason: "Murmur", body: "Dear Dr. Heart,\\n\\nPlease see Biscuit."}) '
        "{ id } }",
        "sign": f'mutation {{ send_letter(id: "{letter}", channels: ["print"]) '
        "{ letter { status } } }",
    }
    # It's Okafor's: Rivera (the pet's usual doctor), front office and admin can't.
    for role in ("rivera", "front", "admin"):
        for name, query in on.items():
            assert code(gql(client, team[role], query)) == "FORBIDDEN", (role, name)
    for name, query in on.items():
        body = gql(client, team["okafor"], query)
        assert code(body) == "", (name, body)
    assert code(gql(client, team["front"], on["sign"])) == ""  # a resend


def test_a_letter_with_no_owning_vet_is_nobody_s_to_change(client):
    # Made in the open demo, before anyone was invited: no vet owns it.
    made = gql(
        client,
        "",
        'mutation { create_letter(patient_id: "pat-1", input: {reason: '
        '"Refer to cardiology", recipient: {name: "Dr. Heart"}, owner_consent: true})'
        " { id } }",
    )
    letter = made["data"]["create_letter"]["id"]
    admin = invite(client, "maya", "Maya Admin", role="admin")
    rivera = invite(client, "arivera", "Dr. Ana Rivera", "prov-1", headers=h(admin))
    for query in (
        f'mutation {{ update_letter(id: "{letter}", input: {{reason: "x"}}) '
        "{ id } }",
        f'mutation {{ draft_letter(id: "{letter}") {{ id }} }}',
        f'mutation {{ send_letter(id: "{letter}", channels: ["print"]) '
        "{ letter { status } } }",
    ):
        err = gql(client, rivera, query)["errors"][0]
        assert err["extensions"]["code"] == "FORBIDDEN", query
        assert err["message"] == (
            "This letter has no provider it belongs to, so it can't be changed."
        )
    # A signed-in person with no provider can't start one either.
    refused = gql(
        client,
        admin,
        'mutation { create_letter(patient_id: "pat-1", input: {reason: "x", '
        'recipient: {name: "Dr. Heart"}}) { id } }',
    )["errors"][0]
    assert refused["extensions"]["code"] == "FORBIDDEN"


@pytest.fixture
def booked_by_room(monkeypatch):
    """appt-3 booked with no provider, as some practice systems book by room."""
    from blinqscribe.adapters.mock import MockAdapter

    def blank(a):
        if a.id == "appt-3":
            return a.model_copy(update={"provider_id": "", "provider_name": ""})
        return a

    get_appt, get_day = MockAdapter.get_appointment, MockAdapter.get_schedule

    async def appointment(self, appointment_id):
        found = await get_appt(self, appointment_id)
        return blank(found) if found else None

    async def schedule(self, day, provider_id=None):
        return [blank(a) for a in await get_day(self, day, provider_id)]

    monkeypatch.setattr(MockAdapter, "get_appointment", appointment)
    monkeypatch.setattr(MockAdapter, "get_schedule", schedule)


def test_a_visit_booked_with_no_doctor_becomes_the_starting_vet_s(
    client, team, booked_by_room
):
    rivera, okafor = team["rivera"], team["okafor"]
    rows = gql(
        client, okafor, '{ schedule(provider_id: "prov-1") { id can { start } } }'
    )
    assert {r["id"]: r["can"]["start"] for r in rows["data"]["schedule"]}["appt-3"]
    refused = client.post(
        "/api/encounters",
        json={"appointment_id": "appt-3", "consent_recorded": True},
        headers=h(team["admin"]),  # not a doctor
    )
    assert refused.status_code == 403
    enc = drafted(client, rivera, "appt-3")
    assert (enc["provider_id"], enc["provider_name"]) == ("prov-1", "Dr. Ana Rivera")
    # From now on it's Rivera's, like any visit booked with her.
    edit = client.post(
        f"/api/encounters/{enc['id']}/transcript", json={"text": "x"}, headers=h(okafor)
    )
    assert edit.status_code == 403
    assert edit.json()["detail"].startswith("This is Dr. Ana Rivera's visit")
    sign = client.post(f"/api/encounters/{enc['id']}/sign", json={}, headers=h(okafor))
    assert sign.json()["detail"] == "Only Dr. Ana Rivera can sign this note."
    signed = client.post(
        f"/api/encounters/{enc['id']}/sign", json={}, headers=h(rivera)
    )
    assert signed.json()["encounter"]["signed_by"] == "Dr. Ana Rivera"


def test_a_visit_nobody_owns_is_nobody_s_to_change(client, booked_by_room):
    enc = drafted(client, "", "appt-3")  # the open demo: no vet to own it
    assert enc["provider_id"] == ""
    admin = invite(client, "maya", "Maya Admin", role="admin")
    rivera = invite(client, "arivera", "Dr. Ana Rivera", "prov-1", headers=h(admin))
    r = client.post(
        f"/api/encounters/{enc['id']}/transcript", json={"text": "x"}, headers=h(rivera)
    )
    assert (r.status_code, r.json()["detail"]) == (
        403,
        "This visit has no provider it belongs to, so it can't be changed.",
    )
    can = gql(
        client,
        rivera,
        "query ($id: String!) { encounter(encounter_id: $id) { " + CAN + " } }",
        id=enc["id"],
    )["data"]["encounter"]["can"]
    assert {k for k, v in can.items() if v} == {"start"}


def test_send_to_pims_is_the_signing_vet_s_alone(client, team, settings):
    rivera = team["rivera"]
    enc = drafted(client, rivera)
    eid = enc["id"]
    client.post(f"/api/encounters/{eid}/sign", json={}, headers=h(rivera))
    path = f"/api/encounters/{eid}/write-back"
    mutation = f'mutation {{ send_to_pims(encounter_id: "{eid}") {{ status }} }}'
    for role, reason in (
        ("okafor", "Only Dr. Ana Rivera can sign this note."),
        ("front", "Front office can't sign notes."),
        ("admin", "Link your login to a provider in Team to do clinical work."),
    ):
        r = client.post(path, headers=h(team[role]))
        assert (r.status_code, r.json()["detail"]) == (403, reason), role
        err = gql(client, team[role], mutation)["errors"][0]
        assert err["extensions"]["code"] == "FORBIDDEN", role
    assert client.post(path, headers=h(rivera)).json()["status"] == "written"
    assert gql(client, rivera, mutation)["data"]["send_to_pims"]["status"] == "written"
    refused = [
        a["actor"]
        for a in client.get(f"/api/encounters/{eid}/audit", headers=h(rivera)).json()
        if a["action"] == "refused" and a["detail"]["action"] == "note.sign"
    ]
    assert sorted(set(refused)) == ["desk", "maya", "sokafor"]

    token = TestClient(create_app(replace(settings, api_token="s3cret")))
    r = token.post(path, headers=h("s3cret"))
    assert r.status_code == 403
    assert r.json()["detail"].startswith("The API token is for scripts and setup")


def test_sign_only_send_and_status_follow_the_roles(client, team, settings):
    rivera = team["rivera"]
    eid = drafted(client, rivera)["id"]
    preview = f"/api/encounters/{eid}/sign-preview"
    sign_only = (
        f'mutation {{ sign_note(encounter_id: "{eid}", send: false) '
        "{ encounter { status } } }"
    )
    # The confirm panel and Sign only are the visit's vet's, like signing.
    for role in ("okafor", "front", "admin"):
        assert client.get(preview, headers=h(team[role])).status_code == 403, role
        err = gql(client, team[role], sign_only)["errors"][0]
        assert err["extensions"]["code"] == "FORBIDDEN", role
    assert client.get(preview, headers=h(rivera)).json()["patient"]
    signed = gql(client, rivera, sign_only)["data"]["sign_note"]["encounter"]
    assert signed["status"] == "signed"

    # Front office sees where it stands (the hand-off), but can't send it.
    desk = client.get(f"/api/encounters/{eid}", headers=h(team["front"])).json()
    assert desk["view"] == "status" and desk["note"] is None
    assert {i["kind"]: i["status"] for i in desk["pims_items"]}["note"] == "not_sent"
    send = f"/api/encounters/{eid}/write-back"
    for role in ("front", "okafor", "admin"):
        assert client.post(send, headers=h(team[role])).status_code == 403, role
    assert client.post(send, headers=h(rivera)).json()["status"] == "written"

    token = TestClient(create_app(replace(settings, api_token="s3cret")))
    assert token.get(preview, headers=h("s3cret")).status_code == 403


SOMEONE = "Speaker 2: He's been eating grass in the yard too."


def test_naming_a_speaker_is_the_visit_s_vet_s(client, team):
    rivera = team["rivera"]
    eid = drafted(client, rivera)["id"]
    client.post(
        f"/api/encounters/{eid}/transcript", json={"text": SOMEONE}, headers=h(rivera)
    )
    mine = client.get(f"/api/encounters/{eid}", headers=h(rivera)).json()
    assert "speaker-2" in {s["speaker_id"] for s in mine["segments"]}
    path = f"/api/encounters/{eid}/speakers/speaker-2"
    body = {"role": "family", "name": "Sam Lee"}
    mutation = (
        f'mutation {{ name_speaker(encounter_id: "{eid}", speaker_id: "speaker-2", '
        'role: "family", name: "Sam Lee") { id } }'
    )
    for role in ("okafor", "front", "admin"):
        assert client.post(path, json=body, headers=h(team[role])).status_code == 403
        err = gql(client, team[role], mutation)["errors"][0]
        assert err["extensions"]["code"] == "FORBIDDEN", role
        # Who said what is part of the transcript: hidden from anyone else.
        seen = client.get(f"/api/encounters/{eid}", headers=h(team[role])).json()
        assert seen["segments"] == [], role
    named = client.post(path, json=body, headers=h(rivera)).json()
    assert {s["speaker_name"] for s in named["segments"]} >= {"Sam Lee"}
    assert "errors" not in gql(client, rivera, mutation)


def test_the_open_demo_and_the_token_on_speakers(settings):
    demo = TestClient(
        create_app(replace(settings, data_dir=settings.data_dir / "demo")),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    eid = drafted(demo, "")["id"]
    demo.post(f"/api/encounters/{eid}/transcript", json={"text": SOMEONE})
    path = f"/api/encounters/{eid}/speakers/speaker-2"
    assert demo.post(path, json={"role": "tech", "name": ""}).status_code == 200

    tok = TestClient(
        create_app(
            replace(settings, api_token="s3cret", data_dir=settings.data_dir / "tok")
        )
    )
    token = h("s3cret")
    eid = tok.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=token,
    ).json()["id"]
    tok.post(f"/api/encounters/{eid}/transcript", json={"text": SOMEONE}, headers=token)
    r = tok.post(
        f"/api/encounters/{eid}/speakers/speaker-2",
        json={"role": "tech", "name": ""},
        headers=token,
    )
    assert r.status_code == 403
    assert r.json()["detail"].startswith("The API token is for scripts and setup")
