import re
import httpx
from app.config import settings
from app.database import get_db
from app.services.youtube_service import fetch_video_metadata, save_metadata


PLAYLIST_PATTERNS = [
    re.compile(r"[?&]list=([a-zA-Z0-9_-]+)"),
    re.compile(r"youtube\.com/playlist\?list=([a-zA-Z0-9_-]+)"),
]


def extract_playlist_id(url: str) -> str | None:
    for pattern in PLAYLIST_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


async def import_playlist(venue_id: int, playlist_url: str) -> list[dict]:
    """Import all videos from a YouTube playlist into fallback_songs."""
    playlist_id = extract_playlist_id(playlist_url)
    if not playlist_id:
        raise ValueError("URL de playlist invalida")

    video_ids = await _fetch_playlist_video_ids(playlist_id)
    if not video_ids:
        raise ValueError("No se encontraron videos en la playlist")

    db = await get_db()

    # Get current max position
    rows = await db.execute_fetchall(
        "SELECT COALESCE(MAX(position), 0) FROM fallback_songs WHERE venue_id = ?",
        (venue_id,),
    )
    position = rows[0][0]

    imported = []
    for vid in video_ids:
        # Skip if already exists for this venue
        existing = await db.execute_fetchall(
            "SELECT id FROM fallback_songs WHERE venue_id = ? AND youtube_id = ?",
            (venue_id, vid),
        )
        if existing:
            continue

        metadata = await fetch_video_metadata(vid)
        if not metadata:
            continue

        await save_metadata(vid, metadata)
        position += 1

        await db.execute(
            "INSERT INTO fallback_songs (venue_id, youtube_id, title, thumbnail_url, duration_sec, position) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (venue_id, vid, metadata["title"], metadata["thumbnail_url"],
             metadata.get("duration_sec", 0), position),
        )
        imported.append({"youtube_id": vid, "title": metadata["title"], "position": position})

    await db.commit()
    return imported


async def _fetch_playlist_video_ids(playlist_id: str) -> list[str]:
    """Fetch video IDs from a YouTube playlist."""
    if settings.youtube_api_key:
        return await _fetch_via_api(playlist_id)
    return await _fetch_via_scrape(playlist_id)


async def _fetch_via_api(playlist_id: str) -> list[str]:
    """Fetch playlist items using YouTube Data API."""
    video_ids = []
    next_page = None

    async with httpx.AsyncClient(timeout=15) as client:
        for _ in range(10):  # max 500 videos
            params = {
                "playlistId": playlist_id,
                "part": "contentDetails",
                "maxResults": 50,
                "key": settings.youtube_api_key,
            }
            if next_page:
                params["pageToken"] = next_page

            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/playlistItems",
                params=params,
            )
            if resp.status_code != 200:
                break

            data = resp.json()
            for item in data.get("items", []):
                vid = item.get("contentDetails", {}).get("videoId")
                if vid:
                    video_ids.append(vid)

            next_page = data.get("nextPageToken")
            if not next_page:
                break

    return video_ids


async def _fetch_via_scrape(playlist_id: str) -> list[str]:
    """Fetch playlist video IDs without API key using page scraping."""
    url = f"https://www.youtube.com/playlist?list={playlist_id}"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            })
            if resp.status_code != 200:
                return []

            # Extract video IDs from the page HTML
            text = resp.text
            video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', text)
            # Deduplicate while preserving order
            seen = set()
            unique = []
            for vid in video_ids:
                if vid not in seen:
                    seen.add(vid)
                    unique.append(vid)
            return unique
    except Exception:
        return []


async def get_fallback_songs(venue_id: int) -> list[dict]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id, youtube_id, title, thumbnail_url, duration_sec, position, active "
        "FROM fallback_songs WHERE venue_id = ? ORDER BY position ASC",
        (venue_id,),
    )
    return [
        {"id": r[0], "youtube_id": r[1], "title": r[2], "thumbnail_url": r[3],
         "duration_sec": r[4], "position": r[5], "active": bool(r[6])}
        for r in rows
    ]


async def get_active_fallback_songs(venue_id: int) -> list[dict]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT youtube_id, title, thumbnail_url, duration_sec "
        "FROM fallback_songs WHERE venue_id = ? AND active = TRUE ORDER BY position ASC",
        (venue_id,),
    )
    return [
        {"youtube_id": r[0], "title": r[1], "thumbnail_url": r[2], "duration_sec": r[3]}
        for r in rows
    ]
