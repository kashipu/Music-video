import re

import httpx

from app.config import settings

YOUTUBE_URL_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:https?://)?youtu\.be/([a-zA-Z0-9_-]{11})"),
    re.compile(r"(?:https?://)?m\.youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})"),
]


def extract_video_id(url: str) -> str | None:
    for pattern in YOUTUBE_URL_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def format_duration(seconds: int) -> str:
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"


def parse_iso_duration(duration: str) -> int:
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


async def fetch_video_metadata(video_id: str) -> dict | None:
    if not settings.youtube_api_key:
        # Use oEmbed to get real title without API key
        return await _fetch_via_oembed(video_id)

    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "id": video_id,
        "part": "snippet,contentDetails,status",
        "key": settings.youtube_api_key,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return None

        data = resp.json()
        items = data.get("items", [])
        if not items:
            return None

        item = items[0]
        snippet = item["snippet"]
        content = item["contentDetails"]
        status = item["status"]

        duration_sec = parse_iso_duration(content["duration"])

        return {
            "youtube_id": video_id,
            "title": snippet["title"],
            "thumbnail_url": snippet["thumbnails"].get("medium", {}).get("url", ""),
            "duration_sec": duration_sec,
            "embeddable": status.get("embeddable", False),
            "artist": snippet.get("channelTitle", ""),
            "genre": snippet.get("categoryId", ""),
            "tags": snippet.get("tags", []),
        }


async def _fetch_via_oembed(video_id: str) -> dict | None:
    """Fetch video title using YouTube oEmbed (no API key needed)."""
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(oembed_url)
            if resp.status_code != 200:
                return None
            data = resp.json()
            return {
                "youtube_id": video_id,
                "title": data.get("title", f"Video {video_id}"),
                "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                "duration_sec": 210,  # oEmbed doesn't provide duration
                "embeddable": True,
                "artist": data.get("author_name", ""),
            }
    except Exception:
        return {
            "youtube_id": video_id,
            "title": f"Video {video_id}",
            "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
            "duration_sec": 210,
            "embeddable": True,
        }


async def save_metadata(video_id: str, metadata: dict) -> None:
    from app.database import get_db
    import json

    db = await get_db()
    await db.execute(
        "INSERT OR IGNORE INTO song_metadata (youtube_id, title, artist, genre, tags, duration_sec) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            video_id,
            metadata.get("title", ""),
            metadata.get("artist", ""),
            metadata.get("genre", ""),
            json.dumps(metadata.get("tags", [])),
            metadata.get("duration_sec", 0),
        ),
    )
    await db.commit()
