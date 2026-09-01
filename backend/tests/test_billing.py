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
        CREATE UNIQUE INDEX idx_billing_events_provider_ref
        ON venue_billing_events(source, provider_ref)
        WHERE provider_ref IS NOT NULL;
        CREATE TABLE platform_settings (
            id INTEGER PRIMARY KEY,
            trial_days INTEGER NOT NULL DEFAULT 15,
            grace_period_days INTEGER NOT NULL DEFAULT 5,
            monthly_price_cents INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO platform_settings (id, grace_period_days) VALUES (1, 5);
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
async def test_void_reverting_past_grace_period_suspends_venue(monkeypatch):
    db = await billing_db(monkeypatch)
    # El evento anulado revierte paid_until a una fecha ya fuera del periodo
    # de gracia (grace_period_days=5): el bar debe quedar active=FALSE. Se
    # inserta directo (no via record_event) porque period_start solo queda
    # en el pasado cuando el pago se concilia contra un vencimiento ya viejo
    # (ej. webhook de Wompi reconciliando tarde), no en el flujo normal.
    stale_period_start = (date.today() - timedelta(days=20)).isoformat()
    await db.execute(
        "INSERT INTO venue_billing_events "
        "(venue_id, kind, source, created_by_id, created_by_username, days, "
        "period_start, period_end, status) "
        "VALUES (1, 'payment', 'manual', 1, 'root', 30, ?, ?, 'approved')",
        (stale_period_start, (date.today() + timedelta(days=10)).isoformat()),
    )
    event_id = (await db.execute_fetchall(
        "SELECT id FROM venue_billing_events WHERE venue_id = 1 ORDER BY id DESC LIMIT 1"
    ))[0][0]

    result = await billing_service.void_event(1, event_id)

    assert result["paid_until_reverted"] is True
    assert result["paid_until"] == stale_period_start
    assert (await db.execute_fetchall(
        "SELECT active FROM venues WHERE id = 1"
    ))[0][0] == 0
    await db.close()


@pytest.mark.asyncio
async def test_void_reverting_within_grace_period_keeps_venue_active(monkeypatch):
    db = await billing_db(monkeypatch)
    creator = {"created_by_id": 1, "created_by_username": "root"}
    period_start = (date.today() + timedelta(days=10)).isoformat()

    await billing_service.record_event(1, "trial", 7, **creator)
    event_id = (await db.execute_fetchall("SELECT id FROM venue_billing_events WHERE venue_id = 1"))[0][0]

    result = await billing_service.void_event(1, event_id)

    assert result["paid_until"] == period_start
    assert (await db.execute_fetchall(
        "SELECT active FROM venues WHERE id = 1"
    ))[0][0] == 1
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
