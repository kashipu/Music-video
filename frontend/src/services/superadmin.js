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
  })
}
