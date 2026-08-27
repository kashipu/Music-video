const API = import.meta.env.VITE_API_URL || ''

async function request(venueId, path, token, options) {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al guardar')
  }
  return res
}

export function postBillingAction(venueId, path, token, body) {
  return request(venueId, path, token, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

export function updateBillingEvent(venueId, eventId, token, body) {
  return request(venueId, `/billing/events/${eventId}`, token, { method: 'PATCH', body: JSON.stringify(body) })
}
