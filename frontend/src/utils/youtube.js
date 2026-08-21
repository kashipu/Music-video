const patterns = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
]

export function extractVideoId(url) {
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function getThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}

// BH-30: gray music-note placeholder shown when i.ytimg.com is blocked/unreachable
const THUMB_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#2a2a35"/><text x="60" y="53" font-size="28" text-anchor="middle" fill="#666">&#9834;</text></svg>'
)

export function thumbFallback(event) {
  event.target.onerror = null
  event.target.src = THUMB_PLACEHOLDER
}

export function formatDuration(seconds) {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
