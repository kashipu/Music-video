import re
import time
import httpx

# TTL cache: the endpoint is public and scrapes youtube.com on every call —
# without this, repeated queries cost ~0.5-1s each, risk an IP ban, and the
# endpoint is usable as a free search proxy by third parties.
# ponytail: in-memory per-process cache; move to Redis when workers > 1
_search_cache: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 300  # 5 min
_CACHE_MAX = 500


def _cache_get(query: str) -> list | None:
    hit = _search_cache.get(query)
    if hit and time.monotonic() - hit[0] < _CACHE_TTL:
        return hit[1]
    return None


def _cache_put(query: str, results: list) -> None:
    if len(_search_cache) >= _CACHE_MAX:
        # Drop the oldest half — simpler than LRU and rare enough not to matter
        for k in sorted(_search_cache, key=lambda k: _search_cache[k][0])[:_CACHE_MAX // 2]:
            _search_cache.pop(k, None)
    _search_cache[query] = (time.monotonic(), results)


async def search_youtube(query: str, max_results: int = 8) -> list[dict]:
    """Search YouTube without API key using page scraping."""
    from app.config import settings
    if settings.app_env == "test":
        # Return mock results for deterministic E2E testing
        # We use the query as part of the ID but ensure it's 11 chars
        mock_id = (query + "_vid_id11")[:11]
        return [{
            "youtube_id": mock_id,
            "title": f"Mock Result for {query}",
            "thumbnail_url": f"https://i.ytimg.com/vi/{mock_id}/mqdefault.jpg",
            "duration": "3:45",
            "url": f"https://www.youtube.com/watch?v={mock_id}",
        }]

    cached = _cache_get(query)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(
                "https://www.youtube.com/results",
                params={"search_query": query},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
                },
            )
            if resp.status_code != 200:
                return []

            text = resp.text

            # Extract video data from the page's JSON
            results = []
            seen = set()

            # Find videoRenderer objects in the page data
            video_pattern = re.findall(
                r'"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}\].*?"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"(.*?)"\}\},"simpleText":"(.*?)"\}',
                text
            )

            for vid, title, _, duration in video_pattern:
                if vid in seen:
                    continue
                seen.add(vid)
                results.append({
                    "youtube_id": vid,
                    "title": _clean_text(title),
                    "thumbnail_url": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
                    "duration": duration,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                })
                if len(results) >= max_results:
                    break

            # Fallback: simpler regex if the above didn't match
            if not results:
                video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', text)
                titles = re.findall(r'"title":\{"runs":\[\{"text":"(.*?)"\}\]', text)

                for i, vid in enumerate(video_ids):
                    if vid in seen:
                        continue
                    seen.add(vid)
                    title = _clean_text(titles[i]) if i < len(titles) else f"Video {vid}"
                    results.append({
                        "youtube_id": vid,
                        "title": title,
                        "thumbnail_url": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
                        "duration": "",
                        "url": f"https://www.youtube.com/watch?v={vid}",
                    })
                    if len(results) >= max_results:
                        break

            if results:  # never cache empty/failed scrapes
                _cache_put(query, results)
            return results
    except Exception:
        return []


def _clean_text(text: str) -> str:
    """Clean escaped characters from YouTube JSON."""
    return (text
            .replace("\\u0026", "&")
            .replace("\\u0027", "'")
            .replace("\\\"", '"')
            .replace("\\\\", "\\"))
