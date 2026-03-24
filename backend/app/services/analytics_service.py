from app.database import get_db


async def get_analytics(venue_id: int, period: str = "week") -> dict:
    db = await get_db()

    period_filter = {
        "day": "-1 day",
        "week": "-7 days",
        "month": "-30 days",
        "all": "-100 years",
    }.get(period, "-7 days")

    # Summary
    summary_rows = await db.execute_fetchall(
        "SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as users, "
        "COUNT(DISTINCT youtube_id) as songs "
        "FROM play_history WHERE venue_id = ? AND played_at > datetime('now', ?)",
        (venue_id, period_filter),
    )
    s = summary_rows[0]

    # Average queue length
    avg_rows = await db.execute_fetchall(
        "SELECT AVG(cnt) FROM ("
        "  SELECT COUNT(*) as cnt FROM queue_songs "
        "  WHERE venue_id = ? AND added_at > datetime('now', ?) "
        "  GROUP BY strftime('%Y-%m-%d %H', added_at)"
        ")",
        (venue_id, period_filter),
    )
    avg_queue = round(avg_rows[0][0] or 0, 1)

    summary = {
        "total_songs_played": s[0],
        "unique_users": s[1],
        "unique_songs": s[2],
        "avg_queue_length": avg_queue,
        "avg_wait_time_sec": 0,
    }

    # Top songs
    top_rows = await db.execute_fetchall(
        "SELECT youtube_id, title, COUNT(*) as times_played "
        "FROM play_history WHERE venue_id = ? AND played_at > datetime('now', ?) "
        "GROUP BY youtube_id ORDER BY times_played DESC LIMIT 10",
        (venue_id, period_filter),
    )
    top_songs = [{"youtube_id": r[0], "title": r[1], "times_played": r[2]} for r in top_rows]

    # Peak hours
    peak_rows = await db.execute_fetchall(
        "SELECT strftime('%H', added_at) as hour, COUNT(*) as requests "
        "FROM queue_songs WHERE venue_id = ? AND added_at > datetime('now', ?) "
        "GROUP BY hour ORDER BY requests DESC",
        (venue_id, period_filter),
    )
    from app.utils import to_colombia_hour
    peak_hours = [{"hour": to_colombia_hour(r[0]), "requests": r[1]} for r in peak_rows]

    # Top tables
    table_rows = await db.execute_fetchall(
        "SELECT us.table_number, COUNT(*) as total_songs "
        "FROM queue_songs qs JOIN user_sessions us ON qs.session_id = us.id "
        "WHERE qs.venue_id = ? AND qs.added_at > datetime('now', ?) "
        "GROUP BY us.table_number ORDER BY total_songs DESC LIMIT 10",
        (venue_id, period_filter),
    )
    top_tables = [{"table_number": r[0], "total_songs": r[1]} for r in table_rows]

    return {
        "period": period,
        "summary": summary,
        "top_songs": top_songs,
        "peak_hours": peak_hours,
        "top_tables": top_tables,
    }


async def get_history(venue_id: int, page: int = 1, per_page: int = 50,
                      date_from: str | None = None, date_to: str | None = None) -> dict:
    db = await get_db()

    conditions = ["ph.venue_id = ?"]
    params: list = [venue_id]

    if date_from:
        conditions.append("ph.played_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("ph.played_at <= ?")
        params.append(date_to)

    where = " AND ".join(conditions)

    count_rows = await db.execute_fetchall(
        f"SELECT COUNT(*) FROM play_history ph WHERE {where}", params
    )
    total = count_rows[0][0]

    offset = (page - 1) * per_page
    params.extend([per_page, offset])

    rows = await db.execute_fetchall(
        f"SELECT ph.id, ph.youtube_id, ph.title, u.display_name, u.phone, "
        f"ph.played_at, ph.duration_sec "
        f"FROM play_history ph JOIN users u ON ph.user_id = u.id "
        f"WHERE {where} "
        f"ORDER BY ph.played_at DESC LIMIT ? OFFSET ?",
        params,
    )

    # Fetch table numbers via a subquery approach
    history = []
    for r in rows:
        history.append({
            "id": r[0], "youtube_id": r[1], "title": r[2],
            "user_name": r[3] or "Anonymous", "user_phone": r[4],
            "played_at": r[5], "duration_sec": r[6],
        })

    return {
        "history": history,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": max(1, (total + per_page - 1) // per_page),
        },
    }
