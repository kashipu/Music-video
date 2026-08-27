const API = import.meta.env.VITE_API_URL || ''

async function request(path, { adminToken, json, headers, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(json ? { body: JSON.stringify(json) } : {}),
  })
  if (!response.ok) {
    await response.json().catch(() => null)
    return null
  }
  return response.json()
}

export function getNowPlaying(venueSlug) {
  return request(`/api/playback/now-playing?venue=${venueSlug}`)
}

export function getDailyPin(adminToken) {
  return request('/api/admin/daily-pin', { adminToken })
}

export function reportFallbackPlaying(venueSlug, song) {
  return request(`/api/playback/fallback-playing?venue=${encodeURIComponent(venueSlug)}&youtube_id=${encodeURIComponent(song.youtube_id)}&title=${encodeURIComponent(song.title)}`, { method: 'POST' })
}

export function startPlaying(venueSlug, songId, adminToken) {
  return request(`/api/queue/start-playing/${songId}?venue=${encodeURIComponent(venueSlug)}`, { method: 'POST', adminToken })
}

export function getQueue(venueSlug) {
  return request(`/api/queue?venue=${venueSlug}`)
}

export function reportPlaybackError(songId, venueSlug, errorCode, adminToken) {
  return request('/api/playback/error', {
    method: 'POST',
    adminToken,
    json: { song_id: songId, venue_slug: venueSlug, error_code: errorCode },
  })
}

export function reportPlaybackFinished(songId, venueSlug, adminToken) {
  return request('/api/playback/finished', {
    method: 'POST',
    adminToken,
    json: { song_id: songId, venue_slug: venueSlug },
  })
}

export function pausePlayback(adminToken) {
  return request('/api/admin/playback/pause', { method: 'POST', adminToken })
}

export function resumePlayback(adminToken) {
  return request('/api/admin/playback/resume', { method: 'POST', adminToken })
}
