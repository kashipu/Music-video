from datetime import datetime, timedelta


# Colombia is UTC-5
COL_OFFSET = timedelta(hours=-5)


def to_colombia_12h(dt_str: str | None) -> str:
    """Convert a SQLite datetime string (UTC) to Colombia time in 12h format."""
    if not dt_str:
        return ""
    try:
        dt = datetime.fromisoformat(dt_str)
        dt_col = dt + COL_OFFSET
        return dt_col.strftime("%I:%M %p").lstrip("0")
    except (ValueError, TypeError):
        return ""


def to_colombia_hour(hour_str: str) -> str:
    """Convert a UTC hour string (e.g. '22') to Colombia 12h format."""
    try:
        h = int(hour_str)
        h_col = (h - 5) % 24
        period = "AM" if h_col < 12 else "PM"
        h12 = h_col % 12
        if h12 == 0:
            h12 = 12
        return f"{h12} {period}"
    except (ValueError, TypeError):
        return hour_str
