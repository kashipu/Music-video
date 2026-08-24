<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'

const router = useRouter()
const { currentMode, toggleMode } = useTheme()
const API = import.meta.env.VITE_API_URL || ''
const venues = ref([])
const filter = ref('all')
const showCreate = ref(false)
const loading = ref(false)
const createError = ref('')
const newVenue = ref({ name: '', slug: '', admin_username: '', admin_password: '', logo_url: '', qr_url: '', max_duration_sec: 600, max_songs_per_window: 5, window_minutes: 30 })

function headers() { return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` } }
function fullUrl(path) { return `${window.location.origin}${path}` }
function daysSince(lastUsedAt) {
  if (!lastUsedAt) return null
  const used = new Date(lastUsedAt.replace(' ', 'T'))
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.floor((today - new Date(used.getFullYear(), used.getMonth(), used.getDate())) / 86400000))
}
function usage(venue) {
  if (!venue.active) return { label: 'Apagado', tone: 'off' }
  const days = daysSince(venue.last_used_at)
  if (days === null) return { label: 'Nunca se usó', tone: 'never' }
  if (days <= 7) return { label: 'En uso', tone: 'recent' }
  return { label: 'Sin movimiento', tone: 'quiet' }
}
function lastUseLabel(venue) {
  const days = daysSince(venue.last_used_at)
  if (days === null) return 'Nunca'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `hace ${days} días`
}
const counts = computed(() => ({
  all: venues.value.length,
  recent: venues.value.filter(v => v.active && (daysSince(v.last_used_at) ?? Infinity) <= 7).length,
  inactive: venues.value.filter(v => v.active && (daysSince(v.last_used_at) ?? Infinity) > 15).length,
  off: venues.value.filter(v => !v.active).length,
}))
const filteredVenues = computed(() => venues.value.filter(venue => {
  const days = daysSince(venue.last_used_at)
  if (filter.value === 'recent') return venue.active && (days ?? Infinity) <= 7
  if (filter.value === 'inactive') return venue.active && (days ?? Infinity) > 15
  if (filter.value === 'off') return !venue.active
  return true
}))

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
async function toggleVenue(venue) {
  await fetch(`${API}/api/superadmin/venues/${venue.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ active: !venue.active }) })
  await fetchVenues()
}
async function deleteVenue(venueId) {
  if (!confirm('¿Estás seguro? Esto eliminará el bar y todos sus datos permanentemente.')) return
  await fetch(`${API}/api/superadmin/venues/${venueId}`, { method: 'DELETE', headers: headers() })
  await fetchVenues()
}
function autoSlug() { newVenue.value.slug = newVenue.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function forceLogout() { localStorage.removeItem('bq_super_token'); localStorage.removeItem('bq_super_admin'); router.push({ name: 'superadmin-login' }) }
</script>

<template>
  <div class="sa">
    <header class="sa-header"><div><h1>Repitela</h1><span class="sa-badge">Administración</span></div><div class="header-actions"><button class="theme-toggle" @click="toggleMode">{{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}</button><button class="btn-logout" @click="forceLogout">Salir</button></div></header>
    <main class="sa-content">
      <div class="list-header"><div><h2>Bares</h2><p class="summary"><button :class="{ selected: filter === 'all' }" @click="filter = 'all'">{{ counts.all }} bares</button> · <button :class="{ selected: filter === 'recent' }" @click="filter = 'recent'">{{ counts.recent }} en uso esta semana</button> · <button :class="{ selected: filter === 'inactive' }" @click="filter = 'inactive'">{{ counts.inactive }} sin uso hace más de 15 días</button> · <button :class="{ selected: filter === 'off' }" @click="filter = 'off'">{{ counts.off }} apagados</button></p></div><button class="btn btn-primary create-button" @click="showCreate = !showCreate">{{ showCreate ? 'Cancelar' : '+ Crear bar' }}</button></div>

      <section v-if="showCreate" class="card create-form"><p class="section-title">CREAR NUEVO BAR</p><div class="form-grid"><div class="form-group"><label>Nombre del bar</label><input v-model="newVenue.name" class="input-field" placeholder="Bar La Esquina" @input="autoSlug"></div><div class="form-group"><label>Identificador de la URL</label><input v-model="newVenue.slug" class="input-field" placeholder="bar-la-esquina"></div><div class="form-group"><label>Imagen del bar (URL)</label><input v-model="newVenue.logo_url" class="input-field" placeholder="https://ejemplo.com/logo.png"></div><div class="form-group"><label>URL del QR</label><input v-model="newVenue.qr_url" class="input-field" placeholder="Opcional"></div><div class="form-group"><label>Usuario administrador</label><input v-model="newVenue.admin_username" class="input-field" placeholder="admin_bar"></div><div class="form-group"><label>Contraseña del administrador</label><input v-model="newVenue.admin_password" type="password" class="input-field" placeholder="********"></div><div class="form-group"><label>Máx. duración (seg)</label><input v-model.number="newVenue.max_duration_sec" type="number" class="input-field"></div><div class="form-group"><label>Canciones por ventana</label><input v-model.number="newVenue.max_songs_per_window" type="number" class="input-field"></div><div class="form-group"><label>Ventana (min)</label><input v-model.number="newVenue.window_minutes" type="number" class="input-field"></div></div><p v-if="createError" class="error-msg">{{ createError }}</p><button class="btn btn-primary save-button" :disabled="loading" @click="createVenue">{{ loading ? 'Creando...' : 'Crear bar' }}</button></section>

      <div class="table-wrap"><table><thead><tr><th>Bar</th><th>Último uso</th><th>Últimos 14 días</th><th>Estado</th><th aria-label="Acciones"></th></tr></thead><tbody><tr v-for="venue in filteredVenues" :key="venue.id" :class="{ off: !venue.active }"><td class="bar"><img v-if="venue.logo_url" :src="venue.logo_url" alt="" class="venue-logo"><div><strong>{{ venue.name }}</strong><span>/{{ venue.slug }}</span></div></td><td><span class="last-use" :class="usage(venue).tone"><i></i>{{ lastUseLabel(venue) }}</span></td><td class="sparkline" title="No disponible en esta fase">—</td><td><span class="usage-state" :class="usage(venue).tone">{{ usage(venue).label }}</span></td><td class="row-actions"><details><summary aria-label="Acciones del bar">⋯</summary><div class="action-menu"><button @click="router.push({ name: 'superadmin-venue', params: { venueId: venue.id } })">Ver detalle</button><button @click="toggleVenue(venue)">{{ venue.active ? 'Apagar bar' : 'Encender bar' }}</button><a :href="fullUrl(`/${venue.slug}/registro`)" target="_blank">Registro</a><a :href="fullUrl(`/${venue.slug}/admin/login`)" target="_blank">Administración</a><a :href="fullUrl(`/${venue.slug}/video`)" target="_blank">Video</a><button class="delete" @click="deleteVenue(venue.id)">Eliminar bar</button></div></details></td></tr><tr v-if="!filteredVenues.length"><td colspan="5" class="empty">No hay bares en este filtro.</td></tr></tbody></table></div>
    </main>
  </div>
</template>

<style scoped>
.sa-header { display:flex; justify-content:space-between; align-items:center; padding:12px 24px; background:var(--bg-card); border-bottom:1px solid var(--border); }.sa-header h1 { display:inline; font-size:18px; }.sa-badge { margin-left:10px; padding:2px 10px; border-radius:12px; background:var(--warning); color:#000; font-size:11px; font-weight:700; }.header-actions { display:flex; gap:8px; align-items:center; }.btn-logout { padding:6px 14px; border-radius:6px; background:var(--danger); color:white; font-size:13px; font-weight:600; }
.sa-content { max-width:1100px; margin:auto; padding:24px; }.list-header { display:flex; justify-content:space-between; gap:16px; align-items:start; margin-bottom:20px; }.list-header h2 { margin:0 0 8px; }.summary { color:var(--text-muted); }.summary button { padding:0; border:0; background:none; color:inherit; font:inherit; cursor:pointer; }.summary button:hover,.summary button.selected { color:var(--primary); text-decoration:underline; }.create-button { width:auto; white-space:nowrap; }
.create-form { padding:20px; margin-bottom:20px; }.form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }.form-group { display:flex; flex-direction:column; gap:4px; }.form-group label { color:var(--text-muted); font-size:12px; font-weight:600; }.error-msg { margin-top:8px; color:var(--danger); font-size:13px; }.save-button { width:auto; margin-top:12px; }
.table-wrap { overflow-x:auto; border:1px solid var(--border-soft); border-radius:var(--radius); background:var(--bg-card); } table { width:100%; min-width:720px; border-collapse:collapse; } th,td { padding:14px 16px; border-bottom:1px solid var(--border-soft); text-align:left; } th { color:var(--text-muted); font-size:11px; letter-spacing:.04em; text-transform:uppercase; } tbody tr:last-child td { border-bottom:0; } tr.off { opacity:.48; }.bar { display:flex; align-items:center; gap:10px; }.bar strong,.bar span { display:block; }.bar span { margin-top:2px; color:var(--text-muted); font-size:12px; }.venue-logo { width:34px; height:34px; border-radius:7px; object-fit:cover; }.last-use { display:inline-flex; align-items:center; gap:7px; }.last-use i { width:8px; height:8px; border-radius:50%; background:var(--text-muted); }.last-use.recent i { background:var(--success); }.last-use.quiet i { background:var(--warning); }.last-use.never i { background:var(--text-muted); }.last-use.off i { display:none; }.usage-state { color:var(--text-muted); font-size:12px; }.usage-state.recent { color:var(--success); }.usage-state.quiet { color:var(--warning); }.sparkline { color:var(--text-muted); }.row-actions { width:44px; position:relative; } details { position:relative; } summary { width:28px; height:28px; list-style:none; border:1px solid var(--border); border-radius:6px; text-align:center; font-size:20px; line-height:22px; cursor:pointer; } summary::-webkit-details-marker { display:none; }.action-menu { position:absolute; z-index:1; right:0; top:34px; display:flex; flex-direction:column; min-width:150px; padding:6px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); box-shadow:0 8px 20px var(--shadow); }.action-menu button,.action-menu a { padding:8px; border:0; border-radius:4px; background:none; color:var(--text); text-align:left; font:inherit; font-size:13px; text-decoration:none; cursor:pointer; }.action-menu button:hover,.action-menu a:hover { background:var(--primary-soft); }.action-menu .delete { color:var(--danger); }.empty { padding:30px; color:var(--text-muted); text-align:center; }
@media (max-width:600px) { .sa-header { padding:10px 12px; }.sa-content { padding:16px 12px; }.list-header { align-items:stretch; flex-direction:column; }.create-button { align-self:start; }.form-grid { grid-template-columns:1fr; } }
</style>
