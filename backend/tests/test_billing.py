from datetime import date, timedelta

import aiosqlite
import pytest

from app.routers import superadmin
from app.services import billing_service


async def billing_db(monkeypatch):
    db = await aiosqlite.connect(":memory:", isolation_level=None)
    await db.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE venues (
            id INTEGER PRIMARY KEY,
            paid_until TEXT,
            active BOOLEAN DEFAULT TRUE,
            payment_notes TEXT
        );
        CREATE TABLE venue_billing_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK (kind IN ('payment','trial','legacy')),
            source TEXT NOT NULL DEFAULT 'manual',
            created_by_id INTEGER,
            created_by_username TEXT,
            amount_cents INTEGER,
            days INTEGER,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved',
            provider_ref TEXT,
            raw_payload TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CHECK ((source = 'manual') = (created_by_id IS NOT NULL))
        );
        """
    )
    today = date.today()
    future = today + timedelta(days=10)
    expired = today - timedelta(days=2)
    await db.executemany(
        "INSERT INTO venues (id, paid_until) VALUES (?, ?)",
        ((1, future.isoformat()), (2, expired.isoformat())),
    )

    async def test_db():
        return db

    monkeypatch.setattr(billing_service, "get_db", test_db)
    return db


@pytest.mark.asyncio
async def test_billing_period_extension_and_manual_creator(monkeypatch):
    db = await billing_db(monkeypatch)
    creator = {"created_by_id": 1, "created_by_username": "root"}
    today = date.today()
    future = today + timedelta(days=10)

    assert await billing_service.record_event(1, "trial", 7, **creator) == (future + timedelta(days=7)).isoformat()
    assert await billing_service.record_event(2, "trial", 7, **creator) == (today + timedelta(days=7)).isoformat()
    with pytest.raises(ValueError, match="MANUAL_EVENT_REQUIRES_CREATOR"):
        await billing_service.record_event(1, "payment", 30, created_by_username="root")

    await db.close()


@pytest.mark.asyncio
async def test_void_last_event_restores_period_start(monkeypatch):
    db = await billing_db(monkeypatch)
    creator = {"created_by_id": 1, "created_by_username": "root"}
    period_start = (date.today() + timedelta(days=10)).isoformat()

    await billing_service.record_event(1, "trial", 7, **creator)
    event_id = (await db.execute_fetchall("SELECT id FROM venue_billing_events WHERE venue_id = 1"))[0][0]
    result = await billing_service.void_event(1, event_id)

    assert result["paid_until"] == period_start
    assert result["paid_until_reverted"] is True
    assert (await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = 1"))[0][0] == period_start
    await db.close()


@pytest.mark.asyncio
async def test_void_historical_event_does_not_change_paid_until(monkeypatch):
    db = await billing_db(monkeypatch)
    creator = {"created_by_id": 1, "created_by_username": "root"}

    await billing_service.record_event(1, "trial", 7, **creator)
    await billing_service.record_event(1, "payment", 30, **creator)
    events = await db.execute_fetchall(
        "SELECT id FROM venue_billing_events WHERE venue_id = 1 ORDER BY id"
    )
    paid_until = (await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = 1"))[0][0]
    result = await billing_service.void_event(1, events[0][0])

    assert result["paid_until_reverted"] is False
    assert (await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = 1"))[0][0] == paid_until
    assert (await db.execute_fetchall(
        "SELECT status FROM venue_billing_events WHERE id = ?", (events[0][0],)
    ))[0][0] == "voided"
    await db.close()


@pytest.mark.asyncio
async def test_patch_notes_keeps_billing_values(monkeypatch):
    db = await billing_db(monkeypatch)
    creator = {"created_by_id": 1, "created_by_username": "root"}

    await billing_service.record_event(1, "payment", 30, amount_cents=12345, notes="Antes", **creator)
    event_id = (await db.execute_fetchall("SELECT id FROM venue_billing_events WHERE venue_id = 1"))[0][0]
    response = await superadmin.update_billing_event(
        1, event_id, superadmin.UpdateBillingEventRequest(notes="Corregida"), {}
    )

    assert response["event"]["notes"] == "Corregida"
    assert (await db.execute_fetchall(
        "SELECT amount_cents, days FROM venue_billing_events WHERE id = ?", (event_id,)
    ))[0] == (12345, 30)
    await db.close()
