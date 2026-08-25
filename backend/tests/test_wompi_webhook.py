import hashlib
from datetime import date, timedelta

import httpx
import pytest

from app.config import settings
from app.main import app
from tests.test_billing import billing_db

EVENTS_SECRET = "test_events_secret"


async def post_webhook(payload):
    # Cliente ASGI asíncrono: TestClient síncrono se bloquea dentro de un test asyncio.
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/billing/wompi/webhook", json=payload)


def signed_payload(txn_id="01-TEST-1", reference="repitela-2-1724500000", status="APPROVED", amount=8000000):
    txn = {"id": txn_id, "reference": reference, "status": status, "amount_in_cents": amount}
    timestamp = 1724500000
    properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    concatenated = f"{txn_id}{status}{amount}"
    checksum = hashlib.sha256(f"{concatenated}{timestamp}{EVENTS_SECRET}".encode()).hexdigest()
    return {
        "event": "transaction.updated",
        "data": {"transaction": txn},
        "timestamp": timestamp,
        "signature": {"properties": properties, "checksum": checksum},
    }


@pytest.mark.asyncio
async def test_approved_extends_and_duplicate_ignored(monkeypatch):
    db = await billing_db(monkeypatch)
    monkeypatch.setattr(settings, "wompi_events_secret", EVENTS_SECRET)
    expected = (date.today() + timedelta(days=30)).isoformat()  # venue 2 está vencido

    res = await post_webhook(signed_payload())
    assert res.status_code == 200
    assert (await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = 2"))[0][0] == expected

    # Reintento de Wompi con el mismo transaction.id: no duplica ni re-extiende
    res = await post_webhook(signed_payload())
    assert res.status_code == 200
    assert res.json().get("ignored") == "duplicado"
    rows = await db.execute_fetchall("SELECT COUNT(*) FROM venue_billing_events WHERE source = 'wompi'")
    assert rows[0][0] == 1
    await db.close()


@pytest.mark.asyncio
async def test_declined_recorded_without_extending(monkeypatch):
    db = await billing_db(monkeypatch)
    monkeypatch.setattr(settings, "wompi_events_secret", EVENTS_SECRET)
    before = (await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = 2"))[0][0]

    res = await post_webhook(signed_payload(txn_id="01-TEST-2", status="DECLINED"))
    assert res.status_code == 200
    assert (await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = 2"))[0][0] == before
    rows = await db.execute_fetchall("SELECT status FROM venue_billing_events WHERE source = 'wompi'")
    assert rows[0][0] == "declined"
    await db.close()


@pytest.mark.asyncio
async def test_bad_signature_rejected(monkeypatch):
    db = await billing_db(monkeypatch)
    monkeypatch.setattr(settings, "wompi_events_secret", EVENTS_SECRET)
    payload = signed_payload()
    payload["signature"]["checksum"] = "0" * 64

    res = await post_webhook(payload)
    assert res.status_code == 403
    rows = await db.execute_fetchall("SELECT COUNT(*) FROM venue_billing_events")
    assert rows[0][0] == 0
    await db.close()


@pytest.mark.asyncio
async def test_foreign_reference_ignored(monkeypatch):
    db = await billing_db(monkeypatch)
    monkeypatch.setattr(settings, "wompi_events_secret", EVENTS_SECRET)
    res = await post_webhook(signed_payload(reference="otra-cosa"))
    assert res.status_code == 200
    rows = await db.execute_fetchall("SELECT COUNT(*) FROM venue_billing_events")
    assert rows[0][0] == 0
    await db.close()
