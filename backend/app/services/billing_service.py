from datetime import date, timedelta

from app.database import get_db


def _event_dict(event) -> dict:
    return {
        "id": event[0], "kind": event[1], "source": event[2],
        "amount_cents": event[3], "days": event[4],
        "period_start": event[5], "period_end": event[6],
        "created_by_username": event[7], "notes": event[8],
        "created_at": event[9], "provider_ref": event[10], "status": event[11],
    }


async def record_event(
    venue_id: int,
    kind: str,
    days: int,
    *,
    amount_cents: int | None = None,
    source: str = "manual",
    created_by_id: int | None = None,
    created_by_username: str | None = None,
    provider_ref: str | None = None,
    notes: str | None = None,
    raw_payload: str | None = None,
    status: str = "approved",
) -> str:
    if source == "manual" and (created_by_id is None or not created_by_username):
        raise ValueError("MANUAL_EVENT_REQUIRES_CREATOR")

    db = await get_db()
    await db.execute("BEGIN IMMEDIATE")
    try:
        rows = await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = ?", (venue_id,))
        if not rows:
            raise ValueError("VENUE_NOT_FOUND")

        today = date.today()
        period_start = today
        if rows[0][0]:
            try:
                paid_until = date.fromisoformat(rows[0][0])
                if paid_until > today:
                    period_start = paid_until
            except (TypeError, ValueError):
                pass
        period_end = period_start + timedelta(days=days)

        if kind == "payment":
            await db.execute(
                "UPDATE venues SET paid_until = ?, active = TRUE, "
                "payment_notes = COALESCE(?, payment_notes) WHERE id = ?",
                (period_end.isoformat(), notes, venue_id),
            )
        else:
            await db.execute(
                "UPDATE venues SET paid_until = ? WHERE id = ?",
                (period_end.isoformat(), venue_id),
            )
        await db.execute(
            "INSERT INTO venue_billing_events "
            "(venue_id, kind, source, created_by_id, created_by_username, amount_cents, days, "
            "period_start, period_end, status, provider_ref, raw_payload, notes) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                venue_id, kind, source, created_by_id, created_by_username, amount_cents, days,
                period_start.isoformat(), period_end.isoformat(), status, provider_ref, raw_payload, notes,
            ),
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return period_end.isoformat()


async def void_event(venue_id: int, event_id: int) -> dict:
    db = await get_db()
    await db.execute("BEGIN IMMEDIATE")
    try:
        rows = await db.execute_fetchall(
            "SELECT id, kind, source, amount_cents, days, period_start, period_end, "
            "created_by_username, notes, created_at, provider_ref, status "
            "FROM venue_billing_events WHERE venue_id = ? AND id = ?",
            (venue_id, event_id),
        )
        if not rows:
            raise ValueError("BILLING_EVENT_NOT_FOUND")
        event = _event_dict(rows[0])
        if event["status"] == "voided":
            raise ValueError("BILLING_EVENT_ALREADY_VOIDED")

        latest = await db.execute_fetchall(
            "SELECT id FROM venue_billing_events "
            "WHERE venue_id = ? AND status != 'voided' "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (venue_id,),
        )
        paid_until_reverted = latest[0][0] == event_id

        await db.execute(
            "UPDATE venue_billing_events SET status = 'voided' WHERE id = ?",
            (event_id,),
        )
        if paid_until_reverted:
            await db.execute(
                "UPDATE venues SET paid_until = ? WHERE id = ?",
                (event["period_start"], venue_id),
            )
        paid_until = (await db.execute_fetchall(
            "SELECT paid_until FROM venues WHERE id = ?", (venue_id,)
        ))[0][0]
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    event["status"] = "voided"
    return {
        "event": event,
        "paid_until_reverted": paid_until_reverted,
        "paid_until": paid_until,
    }


async def update_event_notes(venue_id: int, event_id: int, notes: str | None) -> dict:
    db = await get_db()
    result = await db.execute(
        "UPDATE venue_billing_events SET notes = ? WHERE venue_id = ? AND id = ?",
        (notes, venue_id, event_id),
    )
    if result.rowcount != 1:
        raise ValueError("BILLING_EVENT_NOT_FOUND")
    await db.commit()
    event = await db.execute_fetchall(
        "SELECT id, kind, source, amount_cents, days, period_start, period_end, "
        "created_by_username, notes, created_at, provider_ref, status "
        "FROM venue_billing_events WHERE venue_id = ? AND id = ?",
        (venue_id, event_id),
    )
    return _event_dict(event[0])
