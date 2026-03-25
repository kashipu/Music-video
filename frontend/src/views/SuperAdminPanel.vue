<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'

const router = useRouter()
const { currentMode, toggleMode } = useTheme()
const API = import.meta.env.VITE_API_URL || ''

const venues = ref([])
const showCreate = ref(false)
const loading = ref(false)

const newVenue = ref({ name: '', slug: '', admin_username: '', admin_password: '', logo_url: '', qr_url: '', max_duration_sec: 600, max_songs_per_window: 5, window_minutes: 30 })
const createError = ref('')

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` }
}

function fullUrl(path) {
  return `${window.location.origin}${path}`
}

onMounted(fetchVenues)

async function fetchVenues() {
  const res = await fetch(`${API}/api/superadmin/venues`, { headers: headers() })
  if (!res.ok) { forceLogout(); return }
  const data = await res.json()
  venues.value = data.venues
}

async function createVenue() {
  createError.value = ''
  if (!newVenue.value.name || !newVenue.value.slug || !newVenue.value.admin_username || !newVenue.value.admin_password) {
    createError.value = 'Todos los campos son requeridos'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/venues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(newVenue.value),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Error creando bar')
    }
    showCreate.value = false
    newVenue.value = { name: '', slug: '', admin_username: '', admin_password: '', logo_url: '', qr_url: '', max_duration_sec: 600, max_songs_per_window: 5, window_minutes: 30 }
    await fetchVenues()
  } catch (e) {
    createError.value = e.message
  } finally { loading.value = false }
}

async function toggleVenue(venue) {
  await fetch(`${API}/api/superadmin/venues/${venue.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ active: !venue.active }),
  })
  await fetchVenues()
}

async function deleteVenue(venueId) {
  if (!confirm('Estas seguro? Esto eliminara el bar y todos sus datos permanentemente.')) return
  await fetch(`${API}/api/superadmin/venues/${venueId}`, {
    method: 'DELETE', headers: headers(),
  })
  await fetchVenues()
}

function autoSlug() {
  newVenue.value.slug = newVenue.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function forceLogout() {
  localStorage.removeItem('bq_super_token')
  localStorage.removeItem('bq_super_admin')
  router.push({ name: 'superadmin-login' })
}
</script>

<template>
  <div class="sa">
    <header class="sa-header">
      <div>
        <h1>BarQueue</h1>
        <span class="sa-badge">Super Admin</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="theme-toggle" @click="toggleMode">{{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}</button>
        <button class="btn-logout" @click="forceLogout">Salir</button>
      </div>
    </header>

    <div class="sa-content">
      <!-- Stats -->
      <div class="overview">
        <div class="ov-card"><p class="ov-value">{{ venues.length }}</p><p class="ov-label">Bares</p></div>
        <div class="ov-card"><p class="ov-value">{{ venues.filter(v => v.active).length }}</p><p class="ov-label">Activos</p></div>
        <div class="ov-card"><p class="ov-value">{{ venues.reduce((s, v) => s + v.active_sessions, 0) }}</p><p class="ov-label">Sesiones</p></div>
        <div class="ov-card"><p class="ov-value">{{ venues.reduce((s, v) => s + v.queue_count, 0) }}</p><p class="ov-label">En cola</p></div>
      </div>

      <!-- Create -->
      <button class="btn btn-primary" style="width:auto;" @click="showCreate = !showCreate">
        {{ showCreate ? 'Cancelar' : '+ Nuevo Bar' }}
      </button>

      <div v-if="showCreate" class="card create-form">
        <p class="section-title">CREAR NUEVO BAR</p>
        <div class="form-grid">
          <div class="form-group">
            <label>Nombre del bar</label>
            <input v-model="newVenue.name" class="input-field" placeholder="Bar La Esquina" @input="autoSlug" />
          </div>
          <div class="form-group">
            <label>Slug (URL)</label>
            <input v-model="newVenue.slug" class="input-field" placeholder="bar-la-esquina" />
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>Logo URL (imagen del bar)</label>
            <input v-model="newVenue.logo_url" class="input-field" placeholder="https://ejemplo.com/logo.png" />
            <img v-if="newVenue.logo_url" :src="newVenue.logo_url" class="logo-preview" />
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>URL del QR (opcional)</label>
            <input v-model="newVenue.qr_url" class="input-field" placeholder="Dejar vacio para URL automatica" />
          </div>
          <div class="form-group">
            <label>Usuario admin</label>
            <input v-model="newVenue.admin_username" class="input-field" placeholder="admin_bar" />
          </div>
          <div class="form-group">
            <label>Contrasena admin</label>
            <input v-model="newVenue.admin_password" type="password" class="input-field" placeholder="********" />
          </div>
          <div class="form-group">
            <label>Max duracion (seg)</label>
            <input v-model.number="newVenue.max_duration_sec" type="number" class="input-field" />
          </div>
          <div class="form-group">
            <label>Canciones por ventana</label>
            <input v-model.number="newVenue.max_songs_per_window" type="number" class="input-field" />
          </div>
          <div class="form-group">
            <label>Ventana (min)</label>
            <input v-model.number="newVenue.window_minutes" type="number" class="input-field" />
          </div>
        </div>
        <p v-if="createError" class="error-msg">{{ createError }}</p>
        <button class="btn btn-primary" style="margin-top:12px;" :disabled="loading" @click="createVenue">
          {{ loading ? 'Creando...' : 'Crear Bar' }}
        </button>
      </div>

      <!-- Venues List -->
      <div class="card venue-card" v-for="venue in venues" :key="venue.id">
        <div class="venue-row">
          <img v-if="venue.logo_url" :src="venue.logo_url" class="venue-logo" />
          <div class="venue-info" @click="router.push({ name: 'superadmin-venue', params: { venueId: venue.id } })" style="cursor:pointer;">
            <div class="venue-name-row">
              <span class="venue-name">{{ venue.name }}</span>
              <span class="venue-status" :class="venue.active ? 'active' : 'inactive'">
                {{ venue.active ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <p class="venue-slug">/{{ venue.slug }}</p>
            <p class="venue-meta">
              {{ venue.admin_count }} admin(s) &middot;
              {{ venue.active_sessions }} sesiones &middot;
              {{ venue.queue_count }} en cola
            </p>
          </div>
          <div class="venue-actions">
            <button class="v-btn v-btn-primary" @click="router.push({ name: 'superadmin-venue', params: { venueId: venue.id } })">Detalle</button>
            <button class="v-btn" :class="venue.active ? 'v-btn-warn' : 'v-btn-success'" @click="toggleVenue(venue)">
              {{ venue.active ? 'Desactivar' : 'Activar' }}
            </button>
            <button class="v-btn v-btn-danger" @click="deleteVenue(venue.id)">Eliminar</button>
          </div>
        </div>

        <div class="venue-urls-section" v-if="venue.active">
          <div class="url-row" v-for="u in [
            { label: 'Registro', path: `/${venue.slug}/registro` },
            { label: 'Admin', path: `/${venue.slug}/admin/login` },
            { label: 'Video', path: `/${venue.slug}/video` },
          ]" :key="u.label">
            <span class="url-label">{{ u.label }}</span>
            <span class="url-value">{{ fullUrl(u.path) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sa-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: var(--bg-card); border-bottom: 1px solid var(--border); }
.sa-header h1 { font-size: 18px; display: inline; }
.sa-badge { background: var(--warning); color: #000; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 12px; margin-left: 10px; }
.btn-logout { padding: 6px 14px; border-radius: 6px; background: var(--danger); color: white; font-size: 13px; font-weight: 600; }

.sa-content { max-width: 900px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.ov-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; text-align: center; }
.ov-value { font-size: 28px; font-weight: 700; }
.ov-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.create-form { padding: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.error-msg { color: var(--danger); font-size: 13px; margin-top: 8px; }
.logo-preview { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; margin-top: 6px; }

.venue-card { transition: border-color 0.15s; }
.venue-card:hover { border-color: var(--primary); }
.venue-row { display: flex; align-items: flex-start; gap: 12px; }
.venue-logo { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
.venue-info { flex: 1; }
.venue-info:hover .venue-name { color: var(--primary); }
.venue-name-row { display: flex; align-items: center; gap: 8px; }
.venue-name { font-size: 16px; font-weight: 700; transition: color 0.15s; }
.venue-status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.venue-status.active { background: var(--success-soft); color: var(--success); }
.venue-status.inactive { background: var(--danger-soft); color: var(--danger); }
.venue-slug { font-size: 13px; color: var(--primary); margin-top: 2px; }
.venue-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.venue-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.v-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text); }
.v-btn:hover { border-color: var(--primary); }
.v-btn-primary { border-color: var(--primary); color: var(--primary); }
.v-btn-primary:hover { background: var(--primary); color: white; }
.v-btn-warn { border-color: var(--warning); color: var(--warning); }
.v-btn-warn:hover { background: var(--warning); color: #000; }
.v-btn-danger { border-color: var(--danger); color: var(--danger); }
.v-btn-danger:hover { background: var(--danger); color: white; }
.v-btn-success { border-color: var(--success); color: var(--success); }
.v-btn-success:hover { background: var(--success); color: #000; }

.venue-urls-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.url-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
.url-label { font-weight: 600; color: var(--text-muted); min-width: 60px; }
.url-value { flex: 1; color: var(--primary); font-family: monospace; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 600px) {
  .sa-content { padding: 12px; }
  .sa-header { padding: 10px 12px; }
  .overview { grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .ov-card { padding: 10px; }
  .ov-value { font-size: 22px; }
  .form-grid { grid-template-columns: 1fr; }
  .venue-row { flex-direction: column; }
  .venue-actions { flex-direction: row; flex-wrap: wrap; width: 100%; }
  .v-btn { flex: 1; text-align: center; }
  .url-row { flex-direction: column; gap: 4px; }
  .url-value { font-size: 10px; }
}
</style>
