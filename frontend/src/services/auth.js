const API = import.meta.env.VITE_API_URL || ''

async function request(path, { token, json, headers, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(json ? { body: JSON.stringify(json) } : {}),
  })
  return response
}

export function checkSession(token) {
  return request('/api/auth/session', { token })
}
