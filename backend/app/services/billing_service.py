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

        # Solo un evento aprobado mueve el vencimiento: un pago rechazado o
        # pendiente queda en el historial sin regalar días.
        if status == "approved":
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


async def adjust_expiry(
    venue_id: int,
    new_paid_until: str,
    *,
    created_by_id: int,
    created_by_username: str,
    notes: str,
) -> str:
    """Fija paid_until a una fecha exacta (corrección del superadmin).

    period_start guarda el paid_until anterior: anular el ajuste lo revierte,
    igual que cualquier otro movimiento.
    """
    target = date.fromisoformat(new_paid_until)  # ValueError si viene mal
    db = await get_db()
    await db.execute("BEGIN IMMEDIATE")
    try:
        rows = await db.execute_fetchall("SELECT paid_until FROM venues WHERE id = ?", (venue_id,))
        if not rows:
            raise ValueError("VENUE_NOT_FOUND")
        previous = rows[0][0] or date.today().isoformat()
        try:
            days_delta = (target - date.fromisoformat(previous)).days
        except (TypeError, ValueError):
            days_delta = None

        if target >= date.today():
            await db.execute(
                "UPDATE venues SET paid_until = ?, active = TRUE WHERE id = ?",
                (target.isoformat(), venue_id),
            )
        else:
            await db.execute(
                "UPDATE venues SET paid_until = ? WHERE id = ?",
                (target.isoformat(), venue_id),
            )
        await db.execute(
            "INSERT INTO venue_billing_events "
            "(venue_id, kind, source, created_by_id, created_by_username, days, "
            "period_start, period_end, status, notes) "
            "VALUES (?, 'adjustment', 'manual', ?, ?, ?, ?, ?, 'approved', ?)",
            (
                venue_id, created_by_id, created_by_username,
                days_delta, previous, target.isoformat(), notes,
            ),
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return target.isoformat()


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
        # Los movimientos de Wompi son el registro contra el que se concilia:
        # no se anulan ni editan a mano.
        if event["source"] == "wompi":
            raise ValueError("BILLING_EVENT_LOCKED")

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
            # La fecha revertida puede caer fuera del periodo de gracia: el bar
            # queda activo en la DB con un pago que ya no lo respalda (WIL-119).
            settings_rows = await db.execute_fetchall(
                "SELECT grace_period_days FROM platform_settings WHERE id = 1"
            )
            grace_period_days = settings_rows[0][0] if settings_rows else 5
            reverted_date = date.fromisoformat(event["period_start"])
            if reverted_date < date.today() - timedelta(days=grace_period_days):
                await db.execute(
                    "UPDATE venues SET active = FALSE WHERE id = ?", (venue_id,)
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


async def update_event(
    venue_id: int,
    event_id: int,
    *,
    notes: str | None = None,
    set_notes: bool = False,
    amount_cents: int | None = None,
    period_end: str | None = None,
) -> dict:
    """Edita un movimiento: nota siempre; monto solo en pagos manuales;
    fecha (period_end) en pagos manuales y pruebas. Wompi es intocable.

    Si el movimiento editado es el que define el vencimiento actual (el más
    reciente no anulado), cambiar su fecha mueve venues.paid_until.
    """
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
        if event["source"] == "wompi":
            raise ValueError("BILLING_EVENT_LOCKED")

        if amount_cents is not None and event["kind"] != "payment":
            raise ValueError("BILLING_EVENT_FIELD_NOT_EDITABLE")
        if period_end is not None:
            if event["kind"] not in ("payment", "trial"):
                raise ValueError("BILLING_EVENT_FIELD_NOT_EDITABLE")
            if event["status"] == "voided":
                raise ValueError("BILLING_EVENT_ALREADY_VOIDED")
            new_end = date.fromisoformat(period_end)  # ValueError si viene mal
            start = date.fromisoformat(event["period_start"])
            if new_end <= start:
                raise ValueError("BILLING_EVENT_BAD_PERIOD")

        if set_notes:
            await db.execute(
                "UPDATE venue_billing_events SET notes = ? WHERE id = ?",
                (notes, event_id),
            )
        if amount_cents is not None:
            await db.execute(
                "UPDATE venue_billing_events SET amount_cents = ? WHERE id = ?",
                (amount_cents, event_id),
            )
        if period_end is not None:
            await db.execute(
                "UPDATE venue_billing_events SET period_end = ?, days = ? WHERE id = ?",
                (new_end.isoformat(), (new_end - start).days, event_id),
            )
            latest = await db.execute_fetchall(
                "SELECT id FROM venue_billing_events "
                "WHERE venue_id = ? AND status != 'voided' "
                "ORDER BY created_at DESC, id DESC LIMIT 1",
                (venue_id,),
            )
            if latest and latest[0][0] == event_id:
                if new_end >= date.today():
                    await db.execute(
                        "UPDATE venues SET paid_until = ?, active = TRUE WHERE id = ?",
                        (new_end.isoformat(), venue_id),
                    )
                else:
                    await db.execute(
                        "UPDATE venues SET paid_until = ? WHERE id = ?",
                        (new_end.isoformat(), venue_id),
                    )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    event = await db.execute_fetchall(
        "SELECT id, kind, source, amount_cents, days, period_start, period_end, "
        "created_by_username, notes, created_at, provider_ref, status "
        "FROM venue_billing_events WHERE venue_id = ? AND id = ?",
        (venue_id, event_id),
    )
    return _event_dict(event[0])
