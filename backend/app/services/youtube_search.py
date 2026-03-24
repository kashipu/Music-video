import re
import httpx


async def search_youtube(query: str, max_results: int = 8) -> list[dict]:
    """Search YouTube without API key using page scraping."""
    url = f"https://www.youtube.com/results?search_query={query}"
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
            })
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
