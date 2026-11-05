"""Sign and send to the PIMS, or Sign only (requirement 65): the status of each
item, the confirm panel, and the retries of a save that failed."""

import json
from datetime import UTC, datetime, timedelta

import anyio
import pytest
from fastapi.testclient import TestClient

from blinqscribe import pims_sync
from blinqscribe.adapters.mock import MockAdapter
from blinqscribe.api import create_app
from blinqscribe.jobs import Activities, Services
from blinqscribe.sms import Texter
from blinqscribe.store import Store


class Flaky(MockAdapter):
    """A practice system that is down until told otherwise."""

    down = False

    async def write_back(self, encounter):
        if self.down:
            raise ConnectionError("practice system unreachable")
        return await super().write_back(encounter)


@pytest.fixture
def setup(settings):
    adapter = Flaky()
    client = TestClient(
        create_app(settings, adapter=adapter),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    return client, adapter


def _drafted(client, recheck="approve"):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    client.post(
        f"/api/encounters/{eid}/transcript",
        json={"text": client.get("/api/sample-transcript").json()["text"]},
    )
    enc = client.post(f"/api/encounters/{eid}/draft").json()
    if recheck:
        f = next(f for f in enc["followups"] if f["kind"] == "recheck")
        client.post(
            f"/api/encounters/{eid}/followups/{f['id']}", json={"action": recheck}
        )
    return eid


def _sign(client, eid, send=True):
    return client.post(
        f"/api/encounters/{eid}/sign",
        json={"signed_by": "Dr. Ana Rivera", "send": send},
    ).json()


def _items(client, eid):
    enc = client.get(f"/api/encounters/{eid}").json()
    return {i["kind"]: i for i in enc["pims_items"]}, enc


# ---------- Sign only, then send ----------


def test_sign_only_keeps_the_note_out_until_it_is_sent(setup):
    client, adapter = setup
    eid = _drafted(client)
    out = _sign(client, eid, send=False)
    assert out["encounter"]["status"] == "signed"
    assert out["write_back"]["status"] == "not_sent"
    assert out["write_back"]["detail"] == "Signed only. Not sent to the PIMS yet."
    assert eid not in adapter.written  # nothing went to the practice system
    items, _ = _items(client, eid)
    assert items["note"]["status"] == "not_sent"
    assert items["prescription"]["status"] == "not_sent"  # the note has medications

    eod = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    before = [i for i in eod["left_to_do"] if i["kind"] == "not_sent"]
    assert [i["title"] for i in before] == ["Send to the PIMS"]
    assert "signed but not sent to the PIMS yet: Biscuit" in eod["spoken"]

    sent = client.post(f"/api/encounters/{eid}/write-back").json()
    assert sent["status"] == "written" and eid in adapter.written
    items, _ = _items(client, eid)
    note = items["note"]
    assert note["status"] == "synced" and note["pims_id"] == f"mock-note-{eid}"
    assert (
        note["synced_at"] and note["detail"] == f"Saved to the PIMS as mock-note-{eid}"
    )
    assert items["prescription"]["status"] == "not_sent"  # not written to any PIMS yet
    assert "aren't sent to the PIMS yet" in items["prescription"]["detail"]
    eod = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    assert not [i for i in eod["left_to_do"] if i["kind"] == "not_sent"]


def test_sign_and_send_is_the_default_and_each_item_syncs(setup):
    client, _ = setup
    eid = _drafted(client)
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 200 + b"\xff\xd9"
    client.post(
        f"/api/encounters/{eid}/photos",
        files={"file": ("ear.jpg", jpeg, "image/jpeg")},
        data={"hint": "Right ear"},
    )
    out = client.post(
        f"/api/encounters/{eid}/sign", json={"signed_by": "Dr. Ana Rivera"}
    ).json()
    assert out["write_back"]["status"] == "written"
    _, enc = _items(client, eid)
    kinds = [(i["kind"], i["status"]) for i in enc["pims_items"]]
    assert kinds == [
        ("note", "synced"),
        ("photo", "synced"),
        ("prescription", "not_sent"),
    ]
    assert enc["pims_items"][1]["label"] == "Photo: Right ear"


def test_sign_only_over_graphql(setup):
    client, _ = setup
    eid = _drafted(client)
    out = client.post(
        "/graphql",
        json={
            "query": "mutation($id: String!) { sign_note(encounter_id: $id, "
            'signed_by: "Dr. Ana Rivera", send: false) { write_back { status } '
            "encounter { pims_items { kind status } } } }",
            "variables": {"id": eid},
        },
    ).json()["data"]["sign_note"]
    assert out["write_back"]["status"] == "not_sent"
    assert out["encounter"]["pims_items"][0] == {"kind": "note", "status": "not_sent"}


# ---------- the confirm panel ----------


def test_the_confirm_panel_says_where_and_what(setup, settings):
    client, _ = setup
    eid = _drafted(client)
    panel = client.get(f"/api/encounters/{eid}/sign-preview").json()
    assert panel["pims_name"] == "AVImark"
    assert panel["patient"] == {"name": "Biscuit", "pims_id": "pat-1"}
    assert panel["owner"] == {"name": "Jordan Lee", "pims_id": "cli-1"}
    assert panel["matches"] and panel["mismatch"] == ""
    assert panel["appointment"]["patient_name"] == "Biscuit"
    assert panel["note"] and panel["photos"] == 0 and panel["prescription"]
    [text] = panel["texts"]  # the approved recheck's link goes out at signing
    assert text["kind"] == "recheck" and text["message"]

    # Another owner's pet on this appointment is flagged.
    Store(settings.data_dir).update(
        eid,
        lambda e: e.__dict__.update(
            patient_id="pat-2", patient_name="Miso", client_id="cli-2"
        ),
    )
    panel = client.get(f"/api/encounters/{eid}/sign-preview").json()
    assert not panel["matches"]
    assert panel["mismatch"].startswith("The appointment is for Biscuit, not Miso.")

    gql = client.post(
        "/graphql",
        json={
            "query": "query($id: String!) { sign_preview(encounter_id: $id) "
            "{ pims_name matches photos texts { kind } } }",
            "variables": {"id": eid},
        },
    ).json()["data"]["sign_preview"]
    assert gql["pims_name"] == "AVImark" and gql["matches"] is False


def test_the_pims_name_falls_back_to_the_setting():
    class Unnamed(MockAdapter):
        async def get_clinic(self):
            clinic = await super().get_clinic()
            return clinic.model_copy(update={"pims_name": ""})

    assert anyio.run(pims_sync.pims_name, Unnamed(), "Cornerstone") == "Cornerstone"
    assert anyio.run(pims_sync.pims_name, Unnamed(), "") == ""


def test_no_vendor_name_in_sign_and_send_copy(setup, settings):
    """The clinic names its system (AVImark); nothing the vet or staff reads does."""
    client, _ = setup
    assert anyio.run(pims_sync.pims_name, MockAdapter(), "") == "AVImark"
    eid = _drafted(client)
    copy = [json.dumps(client.get(f"/api/encounters/{eid}/sign-preview").json())]
    copy[0] = copy[0].replace('"pims_name": "AVImark"', "")  # data, not copy
    out = _sign(client, eid, send=False)
    copy.append(json.dumps(out["write_back"]))
    sent = client.post(f"/api/encounters/{eid}/write-back").json()
    copy.append(json.dumps(sent))
    copy.append(json.dumps(client.get(f"/api/encounters/{eid}").json()["pims_items"]))
    copy.append(
        json.dumps(
            client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
        )
    )
    assert "AVImark" not in " ".join(copy)


# ---------- retries, on a fake clock ----------


def _pims_rows(eod):
    kinds = ("not_sent", "pims_failed", "queued")
    return [i["kind"] for i in eod["left_to_do"] if i["kind"] in kinds]


def _services(settings, adapter):
    return Services(Store(settings.data_dir), adapter, Texter(settings))


def test_a_failed_save_retries_every_5_minutes_then_goes_to_the_front_desk(
    setup, settings
):
    client, adapter = setup
    eid = _drafted(client, recheck="")
    adapter.down = True
    out = _sign(client, eid)
    assert out["write_back"]["status"] == "failed"
    _, enc = _items(client, eid)
    assert enc["pims_items"][0]["status"] == "failed"
    t0 = datetime.fromisoformat(enc["pims_failing_since"])
    assert datetime.fromisoformat(enc["pims_next_try_at"]) == t0 + timedelta(minutes=5)

    retry = Activities(_services(settings, adapter)).retry_pims_writes_at
    assert anyio.run(retry, t0 + timedelta(minutes=3)) == []  # not yet
    assert anyio.run(retry, t0 + timedelta(minutes=5)) == [eid]  # tried, still down
    assert anyio.run(retry, t0 + timedelta(minutes=7)) == []  # next one at 10
    eod = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    assert _pims_rows(eod) == ["pims_failed"]

    # Down for the whole hour: the front desk files it, and retries stop.
    for minutes in range(10, 61, 5):
        anyio.run(retry, t0 + timedelta(minutes=minutes))
    _, enc = _items(client, eid)
    assert enc["write_back"]["status"] == "queued_for_staff"
    assert (
        "for an hour, so the front desk will add the note"
        in (enc["write_back"]["detail"])
    )
    assert enc["pims_next_try_at"] is None
    assert anyio.run(retry, t0 + timedelta(minutes=90)) == []
    eod = client.get("/api/end-of-day", params={"provider_id": "prov-1"}).json()
    assert _pims_rows(eod) == ["queued"]  # on the front desk's list
    audit = client.get(f"/api/encounters/{eid}/audit").json()
    retries = [a for a in audit if a["detail"].get("retry")]
    assert len(retries) == 12


def test_a_retry_that_works_syncs_the_note(setup, settings):
    client, adapter = setup
    eid = _drafted(client, recheck="")
    adapter.down = True
    _sign(client, eid)
    _, enc = _items(client, eid)
    t0 = datetime.fromisoformat(enc["pims_failing_since"])
    adapter.down = False
    store = Store(settings.data_dir)
    assert [e.id for e in store.pims_retries()] == [eid]  # the only one read
    retry = Activities(_services(settings, adapter)).retry_pims_writes_at
    assert anyio.run(retry, t0 + timedelta(minutes=5)) == [eid]
    items, enc = _items(client, eid)
    assert enc["write_back"]["status"] == "written"
    assert items["note"]["status"] == "synced" and enc["pims_failing_since"] is None
    assert anyio.run(retry, t0 + timedelta(minutes=10)) == []  # nothing left to do
    assert store.pims_retries() == []


def test_the_server_retries_without_temporal(settings, monkeypatch):
    """Demo mode with no Docker: the server itself runs the 5 minute retries."""
    monkeypatch.setattr(pims_sync, "RETRY_EVERY", timedelta(milliseconds=50))
    adapter = Flaky()
    client = TestClient(
        create_app(settings, adapter=adapter),
        base_url="http://localhost",
        client=("127.0.0.1", 50000),
    )
    with client:
        eid = _drafted(client, recheck="")
        adapter.down = True
        _sign(client, eid)
        adapter.down = False
        Store(settings.data_dir).update(
            eid, lambda e: setattr(e, "pims_next_try_at", datetime.now(UTC))
        )
        for _ in range(100):
            if client.get(f"/api/encounters/{eid}").json()["write_back"]["status"] == (
                "written"
            ):
                break
            anyio.run(anyio.sleep, 0.05)
        assert client.get(f"/api/encounters/{eid}").json()["write_back"]["status"] == (
            "written"
        )


# ---------- A visit summary follow up carries the summary's link ----------


def test_a_visit_summary_follow_up_waits_for_signing_and_goes_with_the_link(
    setup, settings
):
    from blinqscribe.schemas import FollowUp, FollowUpKind

    client, _ = setup
    eid = _drafted(client)
    store = Store(settings.data_dir, settings.database_url)

    def add(enc):
        enc.followups.append(
            FollowUp(
                id="fsum",
                kind=FollowUpKind.client_update,
                reason="Send Biscuit's visit summary to the owner",
                message_draft="Hi Jordan, here is Biscuit's visit summary. Thanks!",
            )
        )

    store.update(eid, add)
    url = f"/api/encounters/{eid}/followups/fsum"
    enc = client.post(url, json={"action": "approve"}).json()
    f = next(x for x in enc["followups"] if x["id"] == "fsum")
    # Approved on the draft: nothing goes yet, there is no signed summary to link.
    assert f["status"] == "approved" and not f["sms"]
    assert "/s/" not in f["message_draft"]

    enc = _sign(client, eid)["encounter"]
    f = next(x for x in enc["followups"] if x["id"] == "fsum")
    assert f["sms"], "sent with the signature"
    assert "Read it here: http" in f["message_draft"]
    token = f["message_draft"].rsplit("/s/", 1)[1].split()[0]
    assert client.get(f"/s/{token}").status_code == 200

    # Sent once: signing's texts again (the hourly check) never add a second link.
    anyio.run(
        Activities(Services(store, MockAdapter(), Texter(settings))).send_signing_texts,
        eid,
    )
    again = next(x for x in store.get(eid).followups if x.id == "fsum")
    assert again.message_draft.count("/s/") == 1
