"""Deleted exam photos. The PRD keeps the original image until the visit is signed,
so a delete only takes the photo out of the visit: it can be restored, and its file
is purged at signing, or after 30 days on a visit nobody signs.

Kept in store meta, out of the encounter, so no list, note or summary can show them.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .schemas import Encounter, Photo
from .store import Store

KEEP_DAYS = 30
INDEX = "removed_photos"  # meta: the ids of visits with deleted photos


def _key(encounter_id: str) -> str:
    return f"removed_photos:{encounter_id}"


def removed(store: Store, encounter_id: str) -> dict[str, Any]:
    """A visit's deleted photos by id: {at: position, deleted_at, photo}."""
    found: dict[str, Any] = json.loads(store.get_meta(_key(encounter_id)) or "{}")
    return found


def _write(store: Store, encounter_id: str, items: dict[str, Any]) -> None:
    store.set_meta(_key(encounter_id), json.dumps(items, default=str))
    visits = set(json.loads(store.get_meta(INDEX) or "[]"))
    visits = visits | {encounter_id} if items else visits - {encounter_id}
    store.set_meta(INDEX, json.dumps(sorted(visits)))


def remove(store: Store, enc: Encounter, photo: Photo) -> Encounter:
    """Take a photo out of the visit. The encounter is saved first, so a failure
    can never leave the photo both in the visit and restorable."""
    at = enc.photos.index(photo)
    enc.photos.remove(photo)
    store.save(enc)
    items = removed(store, enc.id)
    items[photo.id] = {
        "at": at,
        "deleted_at": datetime.now(UTC).isoformat(),
        "photo": photo.model_dump(),
    }
    _write(store, enc.id, items)
    return enc


def restore(store: Store, enc: Encounter, photo_id: str) -> Encounter | None:
    """Put a deleted photo back where it was; None if there is no such photo."""
    items = removed(store, enc.id)
    found = items.pop(photo_id, None)
    if not found:
        return None
    enc.photos.insert(found["at"], Photo.model_validate(found["photo"]))
    store.save(enc)
    _write(store, enc.id, items)
    return enc


def purge(
    store: Store, encounter_id: str, older_than: datetime | None = None
) -> list[str]:
    """Delete the files of a visit's deleted photos (those deleted before
    `older_than`, or all). Returns the photo ids purged."""
    items = removed(store, encounter_id)
    gone = [
        pid
        for pid, item in items.items()
        if older_than is None or datetime.fromisoformat(item["deleted_at"]) < older_than
    ]
    for pid in gone:
        Path(items.pop(pid)["photo"]["path"]).unlink(missing_ok=True)
    if gone:
        _write(store, encounter_id, items)
    return gone


def purge_stale(store: Store, days: int = KEEP_DAYS) -> int:
    """The daily cleanup: deleted photos of visits nobody signed, after `days`."""
    cutoff = datetime.now(UTC) - timedelta(days=days)
    count = 0
    for encounter_id in json.loads(store.get_meta(INDEX) or "[]"):
        gone = purge(store, encounter_id, older_than=cutoff)
        if gone:
            store.audit(
                "system", "deleted_photos_purged", encounter_id, {"photos": gone}
            )
        count += len(gone)
    return count
