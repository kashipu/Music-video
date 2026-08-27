const API = import.meta.env.VITE_API_URL || ''

async function request(path, { headers, json, ...options } = {}) {
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(json ? { body: JSON.stringify(json) } : {}),
    })
    if (!response.ok) return null
    return await response.json().catch(() => ({ ok: true }))
  } catch {
    return null
  }
}

export const getNowPlaying = venueSlug => request(`/api/playback/now-playing?venue=${venueSlug}`)
export const getQueue = headers => request('/api/admin/queue', { headers })
export const getPlayed = headers => request('/api/admin/played', { headers })
export const getTables = headers => request('/api/admin/tables', { headers })
export const getPlaylist = headers => request('/api/admin/playlist', { headers })
export const getAnalytics = (period, headers) => request(`/api/admin/analytics?period=${period}`, { headers })
export const getLibrary = (search, headers) => request(`/api/admin/library?${search ? `search=${encodeURIComponent(search)}` : ''}`, { headers })
export const searchSongs = query => request(`/api/queue/search?q=${encodeURIComponent(query)}`)

export const startPlayback = headers => request('/api/admin/playback/start', { method: 'POST', headers })
export const skipQueueSong = headers => request('/api/admin/queue/skip', { method: 'POST', headers })
export const pausePlayback = headers => request('/api/admin/playback/pause', { method: 'POST', headers })
export const resumePlayback = headers => request('/api/admin/playback/resume', { method: 'POST', headers })

export const setFallbackStatus = (paused, headers) => request(`/api/admin/fallback-status?paused=${paused}`, { method: 'POST', headers })
export const playFallback = headers => request('/api/admin/fallback-play', { method: 'POST', headers })
export const skipFallback = headers => request('/api/admin/fallback-skip', { method: 'POST', headers })

export const setVolume = (volume, headers) => request(`/api/admin/volume?volume=${volume}`, { method: 'POST', headers })
export const setBanner = (text, showBrand, headers) => request(`/api/admin/banner?text=${encodeURIComponent(text)}${showBrand === undefined ? '' : `&show_brand=${showBrand}`}`, { method: 'POST', headers })
export const setQr = (query, headers) => request(`/api/admin/show-qr?${query}`, { method: 'POST', headers })

export const playSongNow = (songId, headers) => request(`/api/admin/queue/songs/${songId}/play-now`, { method: 'POST', headers })
export const removeQueueSong = (songId, headers) => request(`/api/admin/queue/songs/${songId}`, { method: 'DELETE', headers })
export const reorderQueueSong = (songId, position, headers) => request(`/api/admin/queue/songs/${songId}`, { method: 'PATCH', headers, json: { position } })
export const addQueueSong = (youtubeId, headers) => request('/api/admin/queue/songs', { method: 'POST', headers, json: { youtube_url: `https://www.youtube.com/watch?v=${youtubeId}` } })

export const kickTable = (tableNumber, headers) => request(`/api/admin/tables/${tableNumber}/kick`, { method: 'POST', headers })
export const resetTableLimit = (tableNumber, headers) => request(`/api/admin/tables/${tableNumber}/reset-limit`, { method: 'POST', headers })

export const addFallbackSong = (youtubeId, headers) => request(`/api/admin/fallback/add?youtube_id=${youtubeId}`, { method: 'POST', headers })
export const removeFallbackSong = (songId, headers) => request(`/api/admin/fallback/${songId}`, { method: 'DELETE', headers })
