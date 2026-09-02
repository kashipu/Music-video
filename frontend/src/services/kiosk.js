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

// El token de admin caduca a las 8h y nadie lo renueva; la pantalla del bar
// queda encendida toda la noche. Al abrir el Kiosk, el admin autenticado emite
// esta credencial de larga duracion y con ella se reportan play/fin/error.
export function getKioskToken(adminToken) {
  return request('/api/admin/kiosk-token', { method: 'POST', adminToken })
}

export function reportFallbackPlaying(song, kioskToken) {
  return request(`/api/playback/fallback-playing?youtube_id=${encodeURIComponent(song.youtube_id)}&title=${encodeURIComponent(song.title)}`, { method: 'POST', adminToken: kioskToken })
}

export function startPlaying(songId, kioskToken) {
  return request(`/api/queue/start-playing/${songId}`, { method: 'POST', adminToken: kioskToken })
}

export function getQueue(venueSlug) {
  return request(`/api/queue?venue=${venueSlug}`)
}

export function reportPlaybackError(songId, venueSlug, errorCode, kioskToken) {
  return request('/api/playback/error', {
    method: 'POST',
    adminToken: kioskToken,
    json: { song_id: songId, venue_slug: venueSlug, error_code: errorCode },
  })
}

export function reportPlaybackFinished(songId, venueSlug, kioskToken) {
  return request('/api/playback/finished', {
    method: 'POST',
    adminToken: kioskToken,
    json: { song_id: songId, venue_slug: venueSlug },
  })
}

export function pausePlayback(adminToken) {
  return request('/api/admin/playback/pause', { method: 'POST', adminToken })
}

export function resumePlayback(adminToken) {
  return request('/api/admin/playback/resume', { method: 'POST', adminToken })
}
