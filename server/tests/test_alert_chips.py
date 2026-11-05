"""Short alert chips for the visit sidebar: the practice system's label when it has
one, else a plain rule (no model call); the full text stays for the header."""

from blinqscribe.schemas import SHORT_ALERT, Patient, short_alert

DEMO = {
    "Miso": [
        ("Fractious, use towel wrap", "Towel wrap"),
        ("Kidney values trending up", "Kidney values"),
    ],
    "Luna": [("Brachycephalic, watch airway under sedation", "Watch airway")],
    "Waffles": [("Back problems, lift with support", "Back care")],
}


def test_the_rule_for_alerts_without_a_label():
    assert short_alert("Kidney values trending up") == "Kidney values"
    assert short_alert("Use muzzle for nails") == "Muzzle for nails"
    assert short_alert("diabetic; insulin twice daily") == "Diabetic"
    assert short_alert("Supercalifragilisticexpialidocious") == "Supercalifragilist"
    assert all(
        len(short_alert(t)) <= SHORT_ALERT
        for t in ("Brachycephalic, watch airway", "A very long alert about many things")
    )
    pet = Patient(id="p", name="Rex", alerts=["Bites, muzzle first"])
    assert pet.alert_chips == [{"text": "Bites, muzzle first", "short": "Bites"}]
    labelled = Patient(
        id="p",
        name="Rex",
        alerts=["Bites, muzzle first"],
        alert_shorts={"Bites, muzzle first": "Muzzle"},
    )
    assert labelled.alert_chips[0]["short"] == "Muzzle"


def test_demo_appointments_carry_their_chips(client):
    rows = client.get("/api/schedule").json()
    chips = {
        a["patient"]["name"]: [
            (c["text"], c["short"]) for c in a["patient"]["alert_chips"]
        ]
        for a in rows
    }
    for pet, expected in DEMO.items():
        assert chips[pet] == expected, pet
    assert chips["Biscuit"] == []
    data = client.post(
        "/graphql",
        json={
            "query": "{ schedule { patient { name alerts "
            "alert_chips { text short } } } }"
        },
    ).json()["data"]["schedule"]
    luna = next(a["patient"] for a in data if a["patient"]["name"] == "Luna")
    assert luna["alert_chips"] == [
        {"text": "Brachycephalic, watch airway under sedation", "short": "Watch airway"}
    ]
    assert luna["alerts"] == ["Brachycephalic, watch airway under sedation"]
