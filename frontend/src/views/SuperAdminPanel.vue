<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'

const router = useRouter()
const { currentMode, toggleMode } = useTheme()
const API = import.meta.env.VITE_API_URL || ''
const venues = ref([])
const filter = ref('all')
const search = ref('')
const showCreate = ref(false)
const loading = ref(false)
const createError = ref('')
const newVenue = ref({ name: '', slug: '', admin_username: '', admin_password: '', logo_url: '', qr_url: '', max_duration_sec: 600, max_songs_per_window: 5, window_minutes: 30 })

function headers() { return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` } }
function daysSince(date) {
  if (!date) return null
  const value = new Date(date.replace(' ', 'T'))
  const today = new Date()
  return Math.max(0, Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(value.getFullYear(), value.getMonth(), value.getDate())) / 86400000))
}
function relativeDate(date) {
  const days = daysSince(date)
  if (days === null) return 'Nunca'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `hace ${days} días`
}
const counts = computed(() => ({
  active: venues.value.filter(v => v.active).length,
  trial: venues.value.filter(v => v.paid_until == null).length,
  overdue: venues.value.filter(v => v.payment_status === 'overdue').length,
  paid: venues.value.filter(v => v.payment_status === 'active' && v.paid_until != null).length,
}))

// ponytail: client-side venue name search combined with status indicator filter
// Ceiling: in-memory list filtering; if venue list grows to 1000+, switch to debounced backend search endpoint
const filteredVenues = computed(() => {
  const query = search.value.trim().toLowerCase()
  return venues.value.filter(v => {
    let matchesIndicator = true
    if (filter.value === 'active') matchesIndicator = v.active
    else if (filter.value === 'trial') matchesIndicator = v.paid_until == null
    else if (filter.value === 'overdue') matchesIndicator = v.payment_status === 'overdue'
    else if (filter.value === 'paid') matchesIndicator = v.payment_status === 'active' && v.paid_until != null

    if (!matchesIndicator) return false
    if (!query) return true
    return (v.name || '').toLowerCase().includes(query)
  })
})

onMounted(fetchVenues)
async function fetchVenues() {
  const res = await fetch(`${API}/api/superadmin/venues`, { headers: headers() })
  if (!res.ok) return forceLogout()
  const data = await res.json()
  venues.value = data.venues.sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || ''))
}
async function createVenue() {
  createError.value = ''
  if (!newVenue.value.name || !newVenue.value.slug || !newVenue.value.admin_username || !newVenue.value.admin_password) {
    createError.value = 'Todos los campos son requeridos'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/venues`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify(newVenue.value) })
    if (!res.ok) throw new Error((await res.json()).detail || 'Error creando bar')
    showCreate.value = false
    newVenue.value = { name: '', slug: '', admin_username: '', admin_password: '', logo_url: '', qr_url: '', max_duration_sec: 600, max_songs_per_window: 5, window_minutes: 30 }
    await fetchVenues()
  } catch (e) { createError.value = e.message } finally { loading.value = false }
}
function autoSlug() { newVenue.value.slug = newVenue.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function forceLogout() { localStorage.removeItem('bq_super_token'); localStorage.removeItem('bq_super_admin'); router.push({ name: 'superadmin-login' }) }
</script>

<template>
  <div class="sa">
    <header class="sa-header"><div><h1>Repitela</h1><span class="sa-badge">Administración</span></div><div class="header-actions"><RouterLink class="btn-admins" :to="{ name: 'superadmin-admins' }">Administradores</RouterLink><button class="theme-toggle" @click="toggleMode">{{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}</button><button class="btn-logout" @click="forceLogout">Salir</button></div></header>
    <main class="sa-content">
      <section class="indicators" aria-label="Indicadores de bares">
        <h2>Bares</h2>
        <div class="indicator-list">
          <button :class="{ selected: filter === 'active' }" @click="filter = filter === 'active' ? 'all' : 'active'">{{ counts.active }} activos</button>
          <button :class="{ selected: filter === 'trial' }" @click="filter = filter === 'trial' ? 'all' : 'trial'">{{ counts.trial }} en prueba</button>
          <button :class="{ selected: filter === 'overdue' }" @click="filter = filter === 'overdue' ? 'all' : 'overdue'">{{ counts.overdue }} en mora</button>
          <button :class="{ selected: filter === 'paid' }" @click="filter = filter === 'paid' ? 'all' : 'paid'">{{ counts.paid }} pagados</button>
        </div>
      </section>

      <div class="search-box">
        <input
          v-model="search"
          type="search"
          class="input-field"
          placeholder="Buscar bar por nombre..."
          aria-label="Buscar bar por nombre"
        >
      </div>

      <div class="list-header"><h2>Listado</h2><button class="btn btn-primary create-button" @click="showCreate = !showCreate">{{ showCreate ? 'Cancelar' : '+ Crear bar' }}</button></div>
      <section v-if="showCreate" class="card create-form"><p class="section-title">CREAR NUEVO BAR</p><div class="form-grid"><div class="form-group"><label>Nombre del bar</label><input v-model="newVenue.name" class="input-field" placeholder="Bar La Esquina" @input="autoSlug"></div><div class="form-group"><label>Identificador de la URL</label><input v-model="newVenue.slug" class="input-field" placeholder="bar-la-esquina"></div><div class="form-group"><label>Imagen del bar (URL)</label><input v-model="newVenue.logo_url" class="input-field" placeholder="https://ejemplo.com/logo.png"></div><div class="form-group"><label>URL del QR</label><input v-model="newVenue.qr_url" class="input-field" placeholder="Opcional"></div><div class="form-group"><label>Usuario administrador</label><input v-model="newVenue.admin_username" class="input-field" placeholder="admin_bar"></div><div class="form-group"><label>Contraseña del administrador</label><input v-model="newVenue.admin_password" type="password" class="input-field" placeholder="********"></div><div class="form-group"><label>Máx. duración (seg)</label><input v-model.number="newVenue.max_duration_sec" type="number" class="input-field"></div><div class="form-group"><label>Canciones por ventana</label><input v-model.number="newVenue.max_songs_per_window" type="number" class="input-field"></div><div class="form-group"><label>Ventana (min)</label><input v-model.number="newVenue.window_minutes" type="number" class="input-field"></div></div><p v-if="createError" class="error-msg">{{ createError }}</p><button class="btn btn-primary save-button" :disabled="loading" @click="createVenue">{{ loading ? 'Creando...' : 'Crear bar' }}</button></section>

      <section class="venue-grid">
        <article v-for="venue in filteredVenues" :key="venue.id" class="venue-card" :class="{ inactive: !venue.active }">
          <RouterLink class="venue-name" :to="{ name: 'superadmin-venue', params: { venueId: venue.id } }">{{ venue.name }}</RouterLink>
          <span class="venue-slug">/{{ venue.slug }}</span>
          <p><span>Último uso</span>{{ relativeDate(venue.last_used_at) }}</p>
          <p><span>Última conexión del admin</span>{{ relativeDate(venue.last_admin_login) }}</p>
          <span v-if="venue.active_sessions > 0 || venue.queue_count > 0" class="activity">🟢 Con gente en cola</span>
          <button class="btn btn-primary detail-button" @click="router.push({ name: 'superadmin-venue', params: { venueId: venue.id } })">Ver detalle</button>
        </article>
        <p v-if="!filteredVenues.length" class="empty">No hay bares en este filtro.</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.sa-header { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-card); border-bottom:1px solid var(--border); }.sa-header h1 { display:inline; font-size:18px; }.sa-badge { margin-left:10px; padding:2px 10px; border-radius:12px; background:var(--warning); color:#000; font-size:11px; font-weight:700; }.header-actions { display:flex; gap:8px; align-items:center; }.btn-logout { padding:6px 14px; border-radius:6px; background:var(--danger); color:white; font-size:13px; font-weight:600; }.btn-admins { padding:6px 14px; border-radius:6px; background:var(--bg-elevated); border:1px solid var(--border); color:var(--text); font-size:13px; font-weight:600; text-decoration:none; }
.sa-content { max-width:1100px; margin:auto; padding:16px 12px; }.indicators { position:sticky; top:0; z-index:1; margin:-16px -12px 20px; padding:14px 12px; background:var(--bg-card); border-bottom:1px solid var(--border); }.indicators h2,.list-header h2 { margin:0; font-size:18px; }.indicator-list { display:flex; gap:12px; margin-top:8px; overflow-x:auto; white-space:nowrap; }.indicator-list button { padding:0; border:0; background:none; color:var(--text-muted); font:inherit; font-size:13px; cursor:pointer; }.indicator-list button.selected,.indicator-list button:hover { color:var(--primary); text-decoration:underline; }
.search-box { margin-bottom:16px; }
.list-header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }.create-button,.save-button,.detail-button { width:auto; white-space:nowrap; }.create-form { padding:20px; margin-bottom:20px; }.form-grid { display:grid; grid-template-columns:1fr; gap:12px; }.form-group { display:flex; flex-direction:column; gap:4px; }.form-group label { color:var(--text-muted); font-size:12px; font-weight:600; }.error-msg { margin-top:8px; color:var(--danger); font-size:13px; }.save-button { margin-top:12px; }
.venue-grid { display:grid; grid-template-columns:1fr; gap:12px; }.venue-card { display:flex; flex-direction:column; gap:8px; padding:16px; border:1px solid var(--border-soft); border-radius:var(--radius); background:var(--bg-card); min-width:0; }.venue-card.inactive { opacity:.6; }.venue-name { color:var(--text); font-size:17px; font-weight:700; overflow-wrap:anywhere; }.venue-name:hover { color:var(--primary); }.venue-slug { color:var(--text-muted); font-size:12px; margin-top:-6px; overflow-wrap:anywhere; }.venue-card p { display:flex; justify-content:space-between; gap:12px; margin:0; font-size:14px; }.venue-card p span { color:var(--text-muted); }.activity { color:var(--success); font-size:13px; font-weight:600; }.detail-button { align-self:flex-start; margin-top:4px; }.empty { color:var(--text-muted); text-align:center; }

/* =========================================
   BREAKPOINT 640px
   ========================================= */
@media (min-width:640px) { .sa-header { padding:12px 24px; }.sa-content { padding:24px; }.indicators { margin:-24px -24px 24px; padding:16px 24px; }.form-grid { grid-template-columns:repeat(2, 1fr); }.venue-grid { grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); } }
</style>
