<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDuration } from '../utils/youtube.js'

const route = useRoute()
const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''
const venueId = route.params.venueId

const detail = ref(null)
const editName = ref('')
const editLogoUrl = ref('')
const editQrUrl = ref('')
const editConfig = ref({ max_duration_sec: 600, max_songs_per_window: 5, window_minutes: 30 })

const newAdmin = ref({ username: '', password: '' })
const showPass = ref(false)

const users = ref([])
const playlist = ref([])
const playlistUrl = ref('')
const addSongUrl = ref('')
const playlistLoading = ref(false)
const playlistMsg = ref('')

const saving = ref(false)
const saveMsg = ref('')

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` }
}

function fullUrl(path) {
  return `${window.location.origin}${path}`
}

onMounted(async () => {
  await Promise.all([fetchDetail(), fetchPlaylist(), fetchUsers()])
})

async function fetchDetail() {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}/stats`, { headers: headers() })
  if (!res.ok) { router.push({ name: 'superadmin' }); return }
  detail.value = await res.json()
  editName.value = detail.value.venue.name
  editLogoUrl.value = detail.value.venue.logo_url || ''
  editQrUrl.value = detail.value.venue.qr_url || ''
}

async function saveVenue() {
  saving.value = true
  saveMsg.value = ''
  try {
    const body = {
      name: editName.value,
      logo_url: editLogoUrl.value || null,
      qr_url: editQrUrl.value || null,
    }
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      saveMsg.value = 'Guardado'
      await fetchDetail()
      setTimeout(() => { saveMsg.value = '' }, 2000)
    }
  } finally { saving.value = false }
}

// Users
async function fetchUsers() {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}/users`, { headers: headers() })
  if (res.ok) { const data = await res.json(); users.value = data.users }
}

// Admins
async function addAdmin() {
  if (!newAdmin.value.username || !newAdmin.value.password) return
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}/admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify(newAdmin.value),
  })
  if (!res.ok) {
    const err = await res.json()
    alert(err.detail)
    return
  }
  newAdmin.value = { username: '', password: '' }
  await fetchDetail()
}

async function removeAdmin(adminId) {
  await fetch(`${API}/api/superadmin/venues/${venueId}/admins/${adminId}`, {
    method: 'DELETE', headers: headers(),
  })
  await fetchDetail()
}

// Playlist
async function fetchPlaylist() {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}/playlist`, { headers: headers() })
  if (res.ok) { const data = await res.json(); playlist.value = data.songs }
}

async function importPlaylist() {
  if (!playlistUrl.value.trim()) return
  playlistLoading.value = true
  playlistMsg.value = 'Importando playlist...'
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/playlist/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ playlist_url: playlistUrl.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail)
    playlistMsg.value = data.message
    playlistUrl.value = ''
    await fetchPlaylist()
  } catch (e) { playlistMsg.value = e.message }
  finally { playlistLoading.value = false }
}

async function addFallbackSong() {
  if (!addSongUrl.value.trim()) return
  playlistLoading.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/playlist/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ youtube_url: addSongUrl.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail)
    addSongUrl.value = ''
    await fetchPlaylist()
  } catch (e) { playlistMsg.value = e.message }
  finally { playlistLoading.value = false }
}

async function removeFallbackSong(songId) {
  await fetch(`${API}/api/superadmin/venues/${venueId}/playlist/${songId}`, { method: 'DELETE', headers: headers() })
  await fetchPlaylist()
}

async function toggleFallbackSong(songId) {
  await fetch(`${API}/api/superadmin/venues/${venueId}/playlist/${songId}/toggle`, { method: 'PATCH', headers: headers() })
  await fetchPlaylist()
}

async function clearPlaylist() {
  if (!confirm('Eliminar toda la playlist de este bar?')) return
  await fetch(`${API}/api/superadmin/venues/${venueId}/playlist`, { method: 'DELETE', headers: headers() })
  playlist.value = []
}

async function deleteVenue() {
  if (!confirm('ELIMINAR PERMANENTEMENTE este bar y todos sus datos?')) return
  await fetch(`${API}/api/superadmin/venues/${venueId}`, { method: 'DELETE', headers: headers() })
  router.push({ name: 'superadmin' })
}
</script>

<template>
  <div class="vd" v-if="detail">
    <!-- Header -->
    <header class="vd-header">
      <div class="vd-header-left">
        <button class="back-btn" @click="router.push({ name: 'superadmin' })">&#8592; Bares</button>
        <img v-if="detail.venue.logo_url" :src="detail.venue.logo_url" class="header-logo" />
        <h1>{{ detail.venue.name }}</h1>
        <span class="status-badge" :class="detail.venue.active ? 'active' : 'inactive'">
          {{ detail.venue.active ? 'Activo' : 'Inactivo' }}
        </span>
      </div>
    </header>

    <div class="vd-layout">
      <!-- LEFT: Config -->
      <div class="vd-col">

        <!-- Stats -->
        <div class="card">
          <p class="section-title">ESTADISTICAS</p>
          <div class="stat-grid">
            <div class="sg"><strong>{{ detail.stats.total_songs_played }}</strong><span>Reproducidas</span></div>
            <div class="sg"><strong>{{ detail.stats.total_users }}</strong><span>Usuarios</span></div>
            <div class="sg"><strong>{{ detail.stats.active_sessions }}</strong><span>Sesiones</span></div>
            <div class="sg"><strong>{{ detail.stats.songs_in_queue }}</strong><span>En cola</span></div>
          </div>
        </div>

        <!-- Venue Config -->
        <div class="card">
          <p class="section-title">CONFIGURACION DEL BAR</p>
          <div class="form-stack">
            <div class="form-group">
              <label>Nombre</label>
              <input v-model="editName" class="input-field" />
            </div>
            <div class="form-group">
              <label>Logo URL</label>
              <input v-model="editLogoUrl" class="input-field" placeholder="https://..." />
              <img v-if="editLogoUrl" :src="editLogoUrl" class="logo-preview" />
            </div>
            <div class="form-group">
              <label>URL del QR (dejar vacio para automatica)</label>
              <input v-model="editQrUrl" class="input-field" :placeholder="fullUrl(`/${detail.venue.slug}/registro`)" />
            </div>
            <div class="form-row">
              <button class="btn btn-primary" style="width:auto;" :disabled="saving" @click="saveVenue">
                {{ saving ? 'Guardando...' : 'Guardar cambios' }}
              </button>
              <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
            </div>
          </div>
        </div>

        <!-- URLs -->
        <div class="card">
          <p class="section-title">ENLACES</p>
          <div class="url-list">
            <div v-for="u in [
              { label: 'Registro (QR)', path: `/${detail.venue.slug}/registro`, icon: '&#128221;' },
              { label: 'Admin', path: `/${detail.venue.slug}/admin/login`, icon: '&#9881;' },
              { label: 'Video', path: `/${detail.venue.slug}/video`, icon: '&#127909;' },
              { label: 'Usuario', path: `/${detail.venue.slug}/usuario`, icon: '&#128241;' },
            ]" :key="u.label" class="url-item">
              <span class="url-icon" v-html="u.icon"></span>
              <div class="url-info">
                <span class="url-label">{{ u.label }}</span>
                <a :href="u.path" target="_blank" class="url-value">{{ fullUrl(u.path) }}</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="card danger-card">
          <p class="section-title">ZONA DE PELIGRO</p>
          <button class="btn-delete" @click="deleteVenue">Eliminar bar permanentemente</button>
        </div>
      </div>

      <!-- RIGHT: Admins + Users + Playlist -->
      <div class="vd-col">

        <!-- Admins -->
        <div class="card">
          <p class="section-title">ADMINISTRADORES</p>
          <div v-for="a in detail.admins" :key="a.id" class="admin-item">
            <span class="admin-name">{{ a.username }}</span>
            <button class="v-btn v-btn-danger" @click="removeAdmin(a.id)">Quitar</button>
          </div>
          <div class="add-row" style="margin-top:12px;">
            <input v-model="newAdmin.username" class="input-field" placeholder="Usuario" />
            <div class="pass-wrap">
              <input v-model="newAdmin.password" :type="showPass ? 'text' : 'password'" class="input-field" placeholder="Contrasena" />
              <button type="button" class="eye-btn" @click="showPass = !showPass">{{ showPass ? '&#128065;' : '&#128064;' }}</button>
            </div>
            <button class="btn btn-primary" style="width:auto;white-space:nowrap;" @click="addAdmin">Agregar</button>
          </div>
        </div>

        <!-- Users -->
        <div class="card">
          <p class="section-title">USUARIOS REGISTRADOS ({{ users.length }})</p>
          <div class="users-list" v-if="users.length">
            <div v-for="u in users" :key="u.id" class="user-item">
              <div class="user-info">
                <span class="user-name-detail">{{ u.display_name || 'Sin nombre' }}</span>
                <span class="user-phone">{{ u.phone }}</span>
              </div>
              <span class="user-meta">{{ u.songs_count }} canciones &middot; Mesa {{ u.table_number }}</span>
            </div>
          </div>
          <p v-else class="text-muted">Sin usuarios registrados</p>
        </div>
        <div class="card">
          <div class="pl-header">
            <p class="section-title">PLAYLIST DE RESPALDO ({{ playlist.length }})</p>
            <button v-if="playlist.length" class="v-btn v-btn-danger" style="font-size:11px;padding:3px 10px;" @click="clearPlaylist">Limpiar todo</button>
          </div>
          <p class="hint">Estas canciones suenan cuando no hay pedidos de las mesas</p>

          <!-- Import -->
          <div class="pl-input-row">
            <input v-model="playlistUrl" class="input-field" placeholder="URL de playlist de YouTube..." />
            <button class="btn btn-primary" style="width:auto;white-space:nowrap;" :disabled="playlistLoading" @click="importPlaylist">
              {{ playlistLoading ? 'Importando...' : 'Importar playlist' }}
            </button>
          </div>

          <!-- Add single -->
          <div class="pl-input-row">
            <input v-model="addSongUrl" class="input-field" placeholder="URL de cancion individual..." />
            <button class="btn btn-primary" style="width:auto;" :disabled="playlistLoading" @click="addFallbackSong">+</button>
          </div>

          <p v-if="playlistMsg" class="pl-msg">{{ playlistMsg }}</p>

          <!-- Songs -->
          <div class="pl-list">
            <div v-for="song in playlist" :key="song.id" class="pl-item" :class="{ 'pl-disabled': !song.active }">
              <img :src="song.thumbnail_url" class="pl-thumb" />
              <div class="pl-info">
                <p class="pl-title">{{ song.title }}</p>
                <p class="pl-meta">#{{ song.position }} &middot; {{ formatDuration(song.duration_sec) }}</p>
              </div>
              <button class="v-btn" :class="song.active ? 'v-btn-warn' : 'v-btn-success'" style="font-size:11px;padding:3px 8px;" @click="toggleFallbackSong(song.id)">
                {{ song.active ? 'Desactivar' : 'Activar' }}
              </button>
              <button class="v-btn v-btn-danger" style="font-size:11px;padding:3px 8px;" @click="removeFallbackSong(song.id)">Quitar</button>
            </div>
            <p v-if="!playlist.length" class="text-muted">Sin canciones. Importa una playlist o agrega canciones individuales.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Header */
.vd-header {
  padding: 12px 24px; background: var(--bg-card); border-bottom: 1px solid var(--border);
}
.vd-header-left { display: flex; align-items: center; gap: 12px; }
.back-btn {
  padding: 6px 12px; border-radius: 6px; background: var(--bg-elevated);
  border: 1px solid var(--border); color: var(--text-muted); font-size: 13px;
  font-weight: 600; cursor: pointer;
}
.back-btn:hover { border-color: var(--primary); color: var(--primary); }
.header-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }
.vd-header h1 { font-size: 20px; text-transform: capitalize; }
.status-badge { font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 10px; }
.status-badge.active { background: rgba(85,239,196,0.15); color: var(--success); }
.status-badge.inactive { background: rgba(255,107,107,0.15); color: var(--danger); }

/* Layout */
.vd-layout {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 20px; max-width: 1200px; margin: 0 auto; padding: 20px;
}
.vd-col { display: flex; flex-direction: column; gap: 16px; }

/* Stats */
.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.sg {
  text-align: center; padding: 12px; background: var(--bg-elevated); border-radius: 8px;
}
.sg strong { font-size: 22px; display: block; }
.sg span { font-size: 11px; color: var(--text-muted); }

/* Form */
.form-stack { display: flex; flex-direction: column; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.logo-preview { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; margin-top: 4px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.save-msg { font-size: 13px; color: var(--success); font-weight: 600; }

/* URLs */
.url-list { display: flex; flex-direction: column; gap: 8px; }
.url-item { display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--bg-elevated); border-radius: 8px; }
.url-icon { font-size: 18px; flex-shrink: 0; }
.url-info { flex: 1; min-width: 0; }
.url-label { font-size: 12px; font-weight: 600; color: var(--text-muted); display: block; }
.url-value { font-size: 11px; color: var(--primary); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }

/* Admins */
.admin-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px;
}
.admin-name { font-weight: 600; }
.add-row { display: flex; gap: 8px; align-items: center; }
.add-row .input-field { flex: 1; }
.pass-wrap { position: relative; flex: 1; }
.pass-wrap .input-field { width: 100%; padding-right: 36px; }
.eye-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.6;
}
.eye-btn:hover { opacity: 1; }

/* Buttons */
.v-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text); cursor: pointer; }
.v-btn-warn { border-color: var(--warning); color: var(--warning); }
.v-btn-warn:hover { background: var(--warning); color: #000; }
.v-btn-danger { border-color: var(--danger); color: var(--danger); }
.v-btn-danger:hover { background: var(--danger); color: white; }
.v-btn-success { border-color: var(--success); color: var(--success); }
.v-btn-success:hover { background: var(--success); color: #000; }

/* Danger */
.danger-card { border-color: rgba(255,107,107,0.3); }
.btn-delete {
  width: 100%; padding: 10px; border-radius: 8px;
  background: rgba(255,107,107,0.1); border: 1px solid var(--danger);
  color: var(--danger); font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-delete:hover { background: var(--danger); color: white; }

/* Playlist */
.pl-header { display: flex; justify-content: space-between; align-items: center; }
.hint { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.pl-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
.pl-input-row .input-field { flex: 1; }
.pl-msg { font-size: 12px; color: var(--primary); margin-bottom: 8px; }
.pl-list { max-height: 500px; overflow-y: auto; }
.pl-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; margin-bottom: 6px; background: var(--bg-elevated);
  border-radius: 8px; transition: opacity 0.15s;
}
.pl-disabled { opacity: 0.4; }
.pl-thumb { width: 48px; height: 36px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.pl-info { flex: 1; min-width: 0; }
.pl-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl-meta { font-size: 11px; color: var(--text-muted); }

.users-list { max-height: 300px; overflow-y: auto; }
.user-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(45,45,74,0.4);
}
.user-item:last-child { border-bottom: none; }
.user-info { display: flex; flex-direction: column; }
.user-name-detail { font-size: 13px; font-weight: 600; }
.user-phone { font-size: 12px; color: var(--primary); font-family: monospace; }
.user-meta { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

.text-muted { color: var(--text-muted); font-size: 14px; }

@media (max-width: 900px) {
  .vd-layout { grid-template-columns: 1fr; }
}
</style>
