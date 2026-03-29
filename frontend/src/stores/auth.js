import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API = import.meta.env.VITE_API_URL || ''

function safeGetItem(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private browsing */ }
}

function safeRemoveItem(key) {
  try { localStorage.removeItem(key) } catch { /* private browsing */ }
}

function safeParseJSON(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(safeGetItem('bq_token') || '')
  const adminToken = ref(safeGetItem('bq_admin_token') || '')
  const user = ref(safeParseJSON('bq_user'))
  const session = ref(safeParseJSON('bq_session'))
  const adminInfo = ref(safeParseJSON('bq_admin'))

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => !!adminToken.value)

  async function register(phone, tableNumber, venueSlug, dataConsent, displayName) {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        table_number: tableNumber || null,
        venue_slug: venueSlug,
        data_consent: dataConsent,
        display_name: displayName || null,
      }),
    })
    if (!res.ok) {
      let msg = 'Registration failed'
      try {
        const err = await res.json()
        msg = typeof err.detail === 'string' ? err.detail
            : Array.isArray(err.detail) ? err.detail.map(e => e.msg || e).join(', ')
            : JSON.stringify(err.detail)
      } catch { /* non-JSON response */ }
      throw new Error(msg)
    }
    const data = await res.json()
    token.value = data.token
    user.value = data.user
    session.value = data.session
    safeSetItem('bq_token', data.token)
    safeSetItem('bq_user', JSON.stringify(data.user))
    safeSetItem('bq_session', JSON.stringify(data.session))
    return data
  }

  async function adminLogin(username, password, venueSlug = null) {
    const body = { username, password }
    if (venueSlug) body.venue_slug = venueSlug
    const res = await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let msg = 'Login failed'
      try {
        const err = await res.json()
        msg = typeof err.detail === 'string' ? err.detail
            : Array.isArray(err.detail) ? err.detail.map(e => e.msg || e).join(', ')
            : JSON.stringify(err.detail)
      } catch { /* non-JSON response */ }
      throw new Error(msg)
    }
    const data = await res.json()
    adminToken.value = data.token
    adminInfo.value = data.admin
    safeSetItem('bq_admin_token', data.token)
    safeSetItem('bq_admin', JSON.stringify(data.admin))
    return data
  }

  function logout() {
    token.value = ''
    user.value = null
    session.value = null
    safeRemoveItem('bq_token')
    safeRemoveItem('bq_user')
    safeRemoveItem('bq_session')
  }

  function adminLogout() {
    adminToken.value = ''
    adminInfo.value = null
    safeRemoveItem('bq_admin_token')
    safeRemoveItem('bq_admin')
  }

  function authHeaders() {
    return { Authorization: `Bearer ${token.value}` }
  }

  function adminHeaders() {
    return { Authorization: `Bearer ${adminToken.value}` }
  }

  return {
    token, adminToken, user, session, adminInfo,
    isAuthenticated, isAdmin,
    register, adminLogin, logout, adminLogout,
    authHeaders, adminHeaders,
  }
})
