"""Vet accounts: invite, sign in, provider mapping, and who can do what."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from blinqscribe.accounts import AccountError, Accounts, check_password, hash_password
from blinqscribe.api import create_app
from blinqscribe.store import Store

PASSWORD = "correct horse battery"


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def _invite(client, username, name, provider_id="", role="vet", headers=None):
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
    assert (
        "#invite=" in r.json()["invite_url"]
    )  # in the fragment: never sent to the server, never logged
    return r.json()["invite_url"].split("#invite=")[1]


def _accept(client, invite):
    r = client.post(
        "/api/auth/invite/accept", json={"token": invite, "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def team(client):
    """An admin (made in the open demo) and two vets, each tied to a provider."""
    admin = _accept(client, _invite(client, "maya", "Maya Admin", role="admin"))
    rivera = _accept(
        client,
        _invite(client, "arivera", "Dr. Ana Rivera", "prov-1", headers=_bearer(admin)),
    )
    okafor = _accept(
        client,
        _invite(client, "sokafor", "Dr. Sam Okafor", "prov-2", headers=_bearer(admin)),
    )
    return {"admin": admin, "rivera": rivera, "okafor": okafor}


def test_passwords_are_hashed_and_checked():
    stored = hash_password(PASSWORD)
    assert (
        PASSWORD not in stored
        and check_password(PASSWORD, stored)
        and not check_password("wrong one!", stored)
    )
    assert not check_password(PASSWORD, "garbage")


def test_open_demo_until_the_first_account(client):
    assert client.get("/api/auth/status").json() == {"login_required": False}
    assert client.get("/api/schedule").status_code == 200
    _invite(client, "maya", "Maya Admin", role="admin")
    assert client.get("/api/auth/status").json() == {"login_required": True}
    assert client.get("/api/schedule").status_code == 401


def test_invite_is_one_time_and_signs_you_in(client):
    invite = _invite(client, "maya", "Maya Admin", role="admin")
    assert client.post("/api/auth/invite/info", json={"token": invite}).json() == {
        "name": "Maya Admin",
        "username": "maya",
    }
    short = client.post(
        "/api/auth/invite/accept", json={"token": invite, "password": "short"}
    )
    assert short.status_code == 400 and "10 characters" in short.json()["detail"]
    session = _accept(client, invite)
    me = client.get("/api/me", headers=_bearer(session)).json()
    assert (
        me["user"]["username"] == "maya"
        and me["admin"] is True
        and me["via"] == "session"
    )
    assert (
        client.post(
            "/api/auth/invite/accept", json={"token": invite, "password": PASSWORD}
        ).status_code
        == 400
    )
    assert (
        client.post("/api/auth/invite/info", json={"token": invite}).status_code == 404
    )


def test_login_logout_and_wrong_password(client, team):
    bad = client.post(
        "/api/auth/login", json={"username": "arivera", "password": "not the password"}
    )
    nobody = client.post(
        "/api/auth/login", json={"username": "ghost", "password": PASSWORD}
    )
    assert (
        bad.status_code == nobody.status_code == 401 and bad.json() == nobody.json()
    )  # no username probing
    token = client.post(
        "/api/auth/login", json={"username": "ARivera", "password": PASSWORD}
    ).json()["token"]
    assert client.get("/api/schedule", headers=_bearer(token)).status_code == 200
    client.post("/api/auth/logout", headers=_bearer(token))
    assert client.get("/api/schedule", headers=_bearer(token)).status_code == 401


def test_each_provider_links_to_one_login(client, team):
    r = client.post(
        "/api/admin/users",
        json={"username": "dup", "name": "Dup", "provider_id": "prov-1"},
        headers=_bearer(team["admin"]),
    )
    assert (
        r.status_code == 400
        and "already linked to Dr. Ana Rivera" in r.json()["detail"]
    )
    no_provider = client.post(
        "/api/admin/users",
        json={"username": "novet", "name": "No Provider"},
        headers=_bearer(team["admin"]),
    )
    assert no_provider.status_code == 400 and "provider" in no_provider.json()["detail"]
    providers = client.get(
        "/api/admin/providers", headers=_bearer(team["admin"])
    ).json()
    assert {p["id"]: p["linked_to"] for p in providers} == {
        "prov-1": "Dr. Ana Rivera",
        "prov-2": "Dr. Sam Okafor",
    }


def test_only_admins_manage_the_team(client, team):
    vet = _bearer(team["rivera"])
    assert client.get("/api/admin/users", headers=vet).status_code == 403
    assert (
        client.post(
            "/api/admin/users",
            json={"username": "x1", "name": "X", "provider_id": "p"},
            headers=vet,
        ).status_code
        == 403
    )
    assert client.post("/api/admin/onboard", json={}, headers=vet).status_code == 403
    assert (
        client.get("/api/admin/users", headers=_bearer(team["admin"])).status_code
        == 200
    )


def test_deactivating_signs_them_out(client, team):
    rivera = next(
        u
        for u in client.get("/api/admin/users", headers=_bearer(team["admin"])).json()
        if u["username"] == "arivera"
    )
    r = client.patch(
        f"/api/admin/users/{rivera['id']}",
        json={"active": False},
        headers=_bearer(team["admin"]),
    )
    assert r.json()["active"] is False
    assert (
        client.get("/api/schedule", headers=_bearer(team["rivera"])).status_code == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"username": "arivera", "password": PASSWORD}
        ).status_code
        == 401
    )
    # Their provider can now be linked to someone else
    _invite(client, "newvet", "Dr. New", "prov-1", headers=_bearer(team["admin"]))
    me = client.get("/api/me", headers=_bearer(team["admin"])).json()["user"]
    assert (
        client.patch(
            f"/api/admin/users/{me['id']}",
            json={"active": False},
            headers=_bearer(team["admin"]),
        ).status_code
        == 400
    )  # not yourself


def test_api_token_still_works_as_admin(settings):
    client = TestClient(
        create_app(
            replace(
                settings, api_token="s3cret", public_url="https://scribe.example.com/"
            )
        )
    )
    assert client.get("/api/auth/status").json() == {"login_required": True}
    assert client.get("/api/admin/users", headers=_bearer("s3cret")).status_code == 200
    r = client.post(
        "/api/admin/users",
        json={"username": "maya", "name": "Maya", "role": "admin"},
        headers=_bearer("s3cret"),
    )
    assert r.json()["invite_url"].startswith(
        "https://scribe.example.com/#invite="
    )  # not from the Host header
    assert (
        client.get(
            "/api/schedule",
            headers={"Authorization": "Bearer \u00e9t\u00e9".encode("latin-1")},
        ).status_code
        == 401
    )  # not a 500
    assert client.get("/api/schedule", headers=_bearer("wrong")).status_code == 401


def _visit(client, headers, appt="appt-1"):
    eid = client.post(
        "/api/encounters",
        json={"appointment_id": appt, "consent_recorded": True},
        headers=headers,
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        headers=headers,
        json={
            "text": client.get("/api/sample-transcript", headers=headers).json()["text"]
        },
    )
    client.post(f"/api/encounters/{eid}/draft", headers=headers)
    return eid


def test_signing_records_the_vet_and_their_provider(client, team):
    vet = _bearer(team["okafor"])  # appt-5 is booked with Okafor
    eid = _visit(client, vet, "appt-5")
    signed = client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Someone Else"}, headers=vet
    ).json()
    enc = signed["encounter"]
    assert enc["signed_by"] == "Dr. Sam Okafor" and enc["signed_by_user"] == "sokafor"
    assert enc["signed_by_provider_id"] == "prov-2" and enc["started_by"] == "sokafor"
    actors = {
        a["action"]: a["actor"]
        for a in client.get(f"/api/encounters/{eid}/audit", headers=vet).json()
    }
    assert actors["encounter_started"] == actors["note_signed"] == "sokafor"
    notes = client.get("/api/patients/pat-5/notes", headers=vet).json()
    assert notes[0]["provider_id"] == "prov-2"  # labeled as Okafor's, by id


def test_nobody_covers_another_doctors_visit(client, team):
    # Requirement 62: a visit is its doctor's. Okafor can't start Rivera's visit,
    # and can't sign one Rivera started.
    okafor, rivera = _bearer(team["okafor"]), _bearer(team["rivera"])
    refused = client.post(
        "/api/encounters",
        json={"appointment_id": "appt-1", "consent_recorded": True},
        headers=okafor,
    )
    assert refused.status_code == 403
    assert refused.json()["detail"].startswith("This is Dr. Ana Rivera's visit")
    eid = _visit(client, rivera, "appt-1")
    signed = client.post(f"/api/encounters/{eid}/sign", json={}, headers=okafor)
    assert signed.status_code == 403
    assert signed.json()["detail"] == "Only Dr. Ana Rivera can sign this note."


def test_sign_without_a_login_needs_a_name(client):
    eid = _visit(client, {})
    assert client.post(f"/api/encounters/{eid}/sign", json={}).status_code == 400
    assert (
        client.post(
            f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Demo"}
        ).status_code
        == 200
    )


def test_expired_invite(tmp_path):
    accounts = Accounts(Store(tmp_path))
    user, invite = accounts.create("vet1", "Dr. One", "prov-9")
    accounts.store.run(
        "UPDATE invites SET expires = ?",
        ((datetime.now(UTC) - timedelta(minutes=1)).isoformat(),),
    )
    with pytest.raises(AccountError, match="expired"):
        accounts.accept_invite(invite, PASSWORD)
    assert accounts.accept_invite(accounts.reinvite(user.id), PASSWORD)[0].has_password


def test_credentials_never_ride_in_the_url(client, team):
    assert (
        client.get("/api/schedule", params={"token": team["rivera"]}).status_code == 401
    )
    assert (
        client.get("/api/schedule", headers=_bearer(team["rivera"])).status_code == 200
    )


def test_only_this_machine_can_claim_an_open_server(settings):
    remote = TestClient(
        create_app(settings),
        base_url="http://scribe.example.com",
        client=("203.0.113.9", 4000),
    )
    r = remote.post(
        "/api/admin/users", json={"username": "evil", "name": "Evil", "role": "admin"}
    )
    assert r.status_code == 403 and remote.get("/api/auth/status").json() == {
        "login_required": False
    }
    # A web page rebinding its own name to 127.0.0.1 still carries its own Host
    rebound = TestClient(
        create_app(settings), base_url="http://evil.example", client=("127.0.0.1", 4000)
    )
    assert (
        rebound.post(
            "/api/admin/users",
            json={"username": "evil", "name": "Evil", "role": "admin"},
        ).status_code
        == 403
    )


def test_a_new_password_ends_old_sessions(client, team):
    users = client.get("/api/admin/users", headers=_bearer(team["admin"])).json()
    rivera = next(u for u in users if u["username"] == "arivera")
    invite = client.post(
        f"/api/admin/users/{rivera['id']}/invite", headers=_bearer(team["admin"])
    ).json()["invite_url"]
    fresh = _accept(client, invite.split("#invite=")[1])
    assert (
        client.get("/api/schedule", headers=_bearer(team["rivera"])).status_code == 401
    )  # the old session
    assert client.get("/api/schedule", headers=_bearer(fresh)).status_code == 200


def test_turning_back_on_respects_one_login_per_provider(client, team):
    admin = _bearer(team["admin"])
    rivera = next(
        u
        for u in client.get("/api/admin/users", headers=admin).json()
        if u["username"] == "arivera"
    )
    client.patch(
        f"/api/admin/users/{rivera['id']}", json={"active": False}, headers=admin
    )
    _invite(client, "rivera2", "Dr. A. Rivera", "prov-1", headers=admin)
    r = client.patch(
        f"/api/admin/users/{rivera['id']}", json={"active": True}, headers=admin
    )
    assert r.status_code == 400 and "linked to Dr. A. Rivera" in r.json()["detail"]
    assert (
        next(
            u
            for u in client.get("/api/admin/users", headers=admin).json()
            if u["id"] == rivera["id"]
        )["active"]
        is False
    )


def test_sign_in_is_throttled_and_failures_are_audited(client, team, settings):
    for _ in range(5):
        assert (
            client.post(
                "/api/auth/login",
                json={"username": "arivera", "password": "nope nope nope"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/auth/login", json={"username": "arivera", "password": PASSWORD}
        ).status_code
        == 429
    )
    rows = Store(settings.data_dir).run(
        "SELECT COUNT(*) FROM audit WHERE action = 'sign_in_failed'"
    )
    assert rows[0][0] == 5
