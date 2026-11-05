"""The schedule says "Recording" only while audio is arriving: a part from the
glasses or a console in the last 30 seconds, not just a started visit."""

from datetime import UTC, datetime, timedelta

from blinqscribe.store import Store


def live(client):
    rows = client.get("/api/schedule").json()
    return next(a for a in rows if a["id"] == "appt-1")["audio_live"]


def test_audio_live_follows_the_parts_arriving(client, settings):
    eid = client.post(
        "/api/encounters", json={"appointment_id": "appt-1", "consent_recorded": True}
    ).json()["id"]
    assert live(client) is False  # started, nothing heard yet
    enc = client.post(
        f"/api/encounters/{eid}/audio",
        files={"file": ("c.wav", b"RIFF0000WAVEfmt ", "audio/wav")},
        data={"chunk_index": "0"},
    ).json()
    assert enc["last_part_at"] and live(client) is True

    def quiet(e):
        e.last_part_at = datetime.now(UTC) - timedelta(seconds=31)

    Store(settings.data_dir, settings.database_url).update(eid, quiet)
    assert live(client) is False  # the glasses stopped sending
    data = client.post(
        "/graphql",
        json={"query": "{ schedule { id audio_live } }"},
    ).json()["data"]["schedule"]
    assert {a["id"]: a["audio_live"] for a in data}["appt-1"] is False
