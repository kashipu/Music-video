const API = import.meta.env.VITE_API_URL || ''

async function request(path, { headers, json, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(json ? { body: JSON.stringify(json) } : {}),
  })
  if (!response.ok) return null
  return response.json()
}

export const getAnalytics = (period, headers) => request(`/api/admin/analytics?period=${period}`, { headers })
export const setBanner = (text, showBrand, headers) => request(`/api/admin/banner?text=${encodeURIComponent(text)}${showBrand === undefined ? '' : `&show_brand=${showBrand}`}`, { method: 'POST', headers })
export const setQr = (query, headers) => request(`/api/admin/show-qr?${query}`, { method: 'POST', headers })
export const searchSongs = query => request(`/api/queue/search?q=${encodeURIComponent(query)}`)
export const getLibrary = (search, headers) => request(`/api/admin/library?${search ? `&search=${encodeURIComponent(search)}` : ''}`, { headers })
export const addQueueSong = (youtubeId, headers) => request('/api/admin/queue/songs', { method: 'POST', headers, json: { youtube_url: `https://www.youtube.com/watch?v=${youtubeId}` } })
export const addFallbackSong = (youtubeId, headers) => request(`/api/admin/fallback/add?youtube_id=${youtubeId}`, { method: 'POST', headers })
