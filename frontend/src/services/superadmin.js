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
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || err.message || 'Error en la petición')
  }
  return response.json()
}

export function getVenueUsers(venueId, token) {
  return request(`/api/superadmin/venues/${venueId}/users`, {
    adminToken: token || localStorage.getItem('bq_super_token'),

function getAuthHeaders(headers = {}) {
  const token = localStorage.getItem('bq_super_token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
}

export function updateVenue(venueId, body, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(headers) },
    body: JSON.stringify(body),
  })
}

export function uploadVenueLogo(venueId, formData, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/logo`, {
    method: 'POST',
    headers: getAuthHeaders(headers),
    body: formData,
  })
}

export function addVenueAdmin(venueId, adminData, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(headers) },
    body: JSON.stringify(adminData),
  })
}

export function removeVenueAdmin(venueId, adminId, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/admins/${adminId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(headers),
  })
}

export function getVenuePlaylist(venueId, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/playlist`, {
    headers: getAuthHeaders(headers),
  })
}

export function importVenuePlaylist(venueId, playlistUrl, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/playlist/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(headers) },
    body: JSON.stringify({ playlist_url: playlistUrl }),
  })
}

export function addVenueFallbackSong(venueId, youtubeUrl, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/playlist/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(headers) },
    body: JSON.stringify({ youtube_url: youtubeUrl }),
  })
}

export function removeVenueFallbackSong(venueId, songId, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/playlist/${songId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(headers),
  })
}

export function toggleVenueFallbackSong(venueId, songId, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/playlist/${songId}/toggle`, {
    method: 'PATCH',
    headers: getAuthHeaders(headers),
  })
}

export function clearVenuePlaylist(venueId, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}/playlist`, {
    method: 'DELETE',
    headers: getAuthHeaders(headers),
  })
}

export function deleteVenue(venueId, headers) {
  return fetch(`${API}/api/superadmin/venues/${venueId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(headers),
  })
}
