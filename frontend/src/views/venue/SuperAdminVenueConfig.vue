<script setup>
import { inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConfirmModal } from '../../composables/useConfirmModal.js'
import VenueLimitsForm from '../../components/VenueLimitsForm.vue'
import { THEME_PRESETS } from '../../constants/themePresets.js'
import { formatDuration, thumbFallback } from '../../utils/youtube.js'

const route = useRoute()
const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''
const venueId = route.params.venueId
const venueDetail = inject('venueDetail')
if (!venueDetail) throw new Error('venueDetail no disponible')
const { detail, refresh } = venueDetail

const editName = ref('')
const editLogoUrl = ref('')
const uploadingLogo = ref(false)
const editQrUrl = ref('')
const editConfig = ref({ max_duration_sec: 600, max_songs_per_window: 3, window_minutes: 20 })
const savingConfig = ref(false)
const configSaveMsg = ref('')
const configError = ref('')
const selectedPreset = ref('purple-night')
const newAdmin = ref({ username: '', password: '' })
const showPass = ref(false)
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

onMounted(fetchPlaylist)

watch(detail, (currentDetail) => {
  if (!currentDetail) return
  editName.value = currentDetail.venue.name
  editLogoUrl.value = currentDetail.venue.logo_url || ''
  editQrUrl.value = currentDetail.venue.qr_url || ''
  try {
    const cfg = typeof currentDetail.venue.config === 'string'
      ? JSON.parse(currentDetail.venue.config || '{}')
      : (currentDetail.venue.config || {})
    selectedPreset.value = cfg.theme?.preset || 'purple-night'
    editConfig.value = {
      max_duration_sec: cfg.max_duration_sec != null ? Number(cfg.max_duration_sec) : 600,
      max_songs_per_window: cfg.max_songs_per_window != null ? Number(cfg.max_songs_per_window) : 3,
      window_minutes: cfg.window_minutes != null ? Number(cfg.window_minutes) : 20,
    }
  } catch { /* */ }
}, { immediate: true })

async function saveVenue() {
  saving.value = true
  saveMsg.value = ''
  try {
    const body = {
      name: editName.value,
      logo_url: editLogoUrl.value || null,
      qr_url: editQrUrl.value || null,
      theme: (() => {
        const p = THEME_PRESETS.find(t => t.id === selectedPreset.value) || THEME_PRESETS[0]
        return { preset: p.id, accent: p.accent, mode: p.mode, bg: p.colors.bg, text: p.colors.text }
      })(),
    }
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      saveMsg.value = 'Guardado'
      await refresh()
      setTimeout(() => { saveMsg.value = '' }, 2000)
    }
  } finally { saving.value = false }
}

async function saveConfig() {
  configError.value = ''
  configSaveMsg.value = ''

  const maxSongs = Number(editConfig.value.max_songs_per_window)
  const windowMins = Number(editConfig.value.window_minutes)
  const maxDuration = Number(editConfig.value.max_duration_sec)

  if (!Number.isInteger(maxSongs) || maxSongs < 1 || maxSongs > 50) {
    configError.value = 'Las canciones por ventana deben ser un número entero entre 1 y 50'
    return
  }
  if (!Number.isInteger(windowMins) || windowMins < 1 || windowMins > 720) {
    configError.value = 'Los minutos de ventana deben ser un número entero entre 1 y 720 (máx. 12 horas)'
    return
  }
  if (!Number.isInteger(maxDuration) || maxDuration < 30 || maxDuration > 7200) {
    configError.value = 'La duración máxima debe ser entre 30 y 7200 segundos (máx. 2 horas)'
    return
  }

  savingConfig.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        max_duration_sec: maxDuration,
        max_songs_per_window: maxSongs,
        window_minutes: windowMins,
      }),
    })
    if (res.ok) {
      configSaveMsg.value = 'Guardado'
      await refresh()
      setTimeout(() => { configSaveMsg.value = '' }, 2000)
    } else {
      const err = await res.json().catch(() => ({}))
      configError.value = err.detail || 'Error al guardar límites'
    }
  } catch (e) {
    configError.value = e.message || 'Error al guardar límites'
  } finally {
    savingConfig.value = false
  }
}

async function uploadLogo(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
  if (!allowed.includes(file.type)) {
    saveMsg.value = 'Solo PNG, JPG o SVG'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    saveMsg.value = 'Max 2MB'
    return
  }
  uploadingLogo.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/logo`, {
      method: 'POST',
      headers: headers(),
      body: formData,
    })
    if (res.ok) {
      const data = await res.json()
      editLogoUrl.value = data.logo_url
      await refresh()
      saveMsg.value = 'Logo actualizado'
      setTimeout(() => { saveMsg.value = '' }, 2000)
    } else {
      const err = await res.json().catch(() => ({}))
      saveMsg.value = err.detail || 'Error al subir logo'
    }
  } finally { uploadingLogo.value = false }
}

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
  await refresh()
}

async function removeAdmin(adminId) {
  await fetch(`${API}/api/superadmin/venues/${venueId}/admins/${adminId}`, {
    method: 'DELETE', headers: headers(),
  })
  await refresh()
}

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

const { confirm } = useConfirmModal()

async function clearPlaylist() {
  const ok = await confirm({
    title: 'Limpiar playlist',
    message: '¿Eliminar toda la playlist de respaldo de este bar? Esta acción no se puede deshacer.',
    danger: true,
    confirmText: 'Limpiar todo',
  })
  if (!ok) return
  await fetch(`${API}/api/superadmin/venues/${venueId}/playlist`, { method: 'DELETE', headers: headers() })
  playlist.value = []
}

async function deleteVenue() {
  const ok = await confirm({
    title: 'Eliminar bar',
    message: '¿ELIMINAR PERMANENTEMENTE este bar y todos sus datos? Esta acción es irreversible.',
    danger: true,
    confirmText: 'Eliminar bar',
  })
  if (!ok) return
  await fetch(`${API}/api/superadmin/venues/${venueId}`, { method: 'DELETE', headers: headers() })
  router.push({ name: 'superadmin' })
}

async function toggleVenue() {
  await fetch(`${API}/api/superadmin/venues/${venueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ active: !detail.value.venue.active }),
  })
  await refresh()
}
</script>

<template>
  <div v-if="detail" class="vd-layout">
    <div class="vd-col">
      <div class="card">
        <p class="section-title">CONFIGURACIÓN DEL BAR</p>
        <div class="form-stack">
          <div class="form-group">
            <label for="venue-name-input">Nombre</label>
            <input id="venue-name-input" v-model="editName" class="input-field" />
          </div>
          <div class="form-group">
            <label>Logo del bar</label>
            <div class="logo-upload">
              <img v-if="editLogoUrl" :src="editLogoUrl.startsWith('/') ? API + editLogoUrl : editLogoUrl" class="logo-preview" alt="Vista previa de logo" />
              <div class="logo-actions">
                <label class="btn btn-secondary logo-btn">
                  {{ uploadingLogo ? 'Subiendo...' : 'Subir logo' }}
                  <input type="file" accept=".png,.jpg,.jpeg,.svg" hidden :disabled="uploadingLogo" aria-label="Subir archivo de logo" @change="uploadLogo" />
                </label>
                <p class="logo-hint">PNG, JPG o SVG. Máx. 2MB.</p>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label for="venue-qr-input">URL del QR (dejar vacío para automática)</label>
            <input id="venue-qr-input" v-model="editQrUrl" class="input-field" :placeholder="fullUrl(`/${detail.venue.slug}/registro`)" />
          </div>
          <div class="form-group">
            <label>Tema del bar</label>
            <div class="preset-grid">
              <div
                v-for="preset in THEME_PRESETS"
                :key="preset.id"
                class="preset-card"
                :class="{ selected: selectedPreset === preset.id }"
                role="button"
                :aria-pressed="selectedPreset === preset.id"
                tabindex="0"
                @click="selectedPreset = preset.id"
                @keydown.enter="selectedPreset = preset.id"
                @keydown.space.prevent="selectedPreset = preset.id"
              >
                <div class="preset-swatches">
                  <div class="ps" :style="{ background: preset.colors.bg }" />
                  <div class="ps ps-accent" :style="{ background: preset.accent }" />
                  <div class="ps" :style="{ background: preset.colors.text }" />
                </div>
                <span class="preset-name">{{ preset.name }}</span>
                <span class="preset-mode">{{ preset.mode === 'dark' ? '&#9790;' : '&#9728;' }}</span>
              </div>
            </div>
          </div>
          <div class="form-row">
            <button class="btn btn-primary" :disabled="saving" @click="saveVenue">
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
            <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <p class="section-title">LÍMITES DE PEDIDOS</p>
        <VenueLimitsForm
          v-model:max-duration-sec="editConfig.max_duration_sec"
          v-model:max-songs="editConfig.max_songs_per_window"
          v-model:window-minutes="editConfig.window_minutes"
        />
        <p v-if="configError" class="config-error">{{ configError }}</p>
        <div class="form-row limits-actions">
          <button class="btn btn-primary" :disabled="savingConfig" @click="saveConfig">
            {{ savingConfig ? 'Guardando...' : 'Guardar límites' }}
          </button>
          <span v-if="configSaveMsg" class="save-msg">{{ configSaveMsg }}</span>
        </div>
      </div>

      <div class="card danger-card">
        <p class="section-title">ZONA DE PELIGRO</p>
        <div class="danger-actions">
          <button class="btn-venue-toggle" @click="toggleVenue">{{ detail.venue.active ? 'Desactivar bar' : 'Activar bar' }}</button>
          <button class="btn-delete" @click="deleteVenue">Eliminar bar permanentemente</button>
        </div>
      </div>
    </div>

    <div class="vd-col">
      <div class="card">
        <p class="section-title">ADMINISTRADORES DEL BAR</p>
        <div class="admin-list">
          <div v-for="a in detail.admins" :key="a.id" class="admin-item">
            <span class="admin-name">{{ a.username }}</span>
            <button class="v-btn v-btn-danger" :aria-label="`Quitar administrador ${a.username}`" @click="removeAdmin(a.id)">Quitar</button>
          </div>
          <p v-if="!detail.admins?.length" class="text-muted">Sin administradores asignados.</p>
        </div>
        <div class="add-row">
          <input v-model="newAdmin.username" class="input-field" placeholder="Usuario..." aria-label="Usuario nuevo administrador" />
          <div class="pass-wrap">
            <input v-model="newAdmin.password" :type="showPass ? 'text' : 'password'" class="input-field" placeholder="Contraseña..." aria-label="Contraseña nuevo administrador" />
            <button type="button" class="eye-btn" :aria-label="showPass ? 'Ocultar contraseña' : 'Ver contraseña'" @click="showPass = !showPass">{{ showPass ? '&#128065;' : '&#128064;' }}</button>
          </div>
          <button class="btn btn-primary add-btn" @click="addAdmin">Agregar</button>
        </div>
      </div>

      <div class="card">
        <div class="pl-header">
          <p class="section-title">PLAYLIST DE RESPALDO ({{ playlist.length }})</p>
          <button v-if="playlist.length" class="v-btn v-btn-danger" style="font-size:11px;padding:3px 10px;" @click="clearPlaylist">Limpiar todo</button>
        </div>
        <p class="hint">Estas canciones suenan automáticamente cuando no hay pedidos de las mesas.</p>
        <div class="pl-input-row">
          <input v-model="playlistUrl" class="input-field" placeholder="URL de playlist de YouTube..." aria-label="URL de playlist de YouTube" />
          <button class="btn btn-primary" :disabled="playlistLoading" @click="importPlaylist">
            {{ playlistLoading ? 'Importando...' : 'Importar playlist' }}
          </button>
        </div>
        <div class="pl-input-row">
          <input v-model="addSongUrl" class="input-field" placeholder="URL de canción individual..." aria-label="URL de canción individual de YouTube" />
          <button class="btn btn-primary add-single-btn" :disabled="playlistLoading" aria-label="Agregar canción individual" @click="addFallbackSong">+</button>
        </div>
        <p v-if="playlistMsg" class="pl-msg">{{ playlistMsg }}</p>
        <div class="pl-list">
          <div v-for="song in playlist" :key="song.id" class="pl-item" :class="{ 'pl-disabled': !song.active }">
            <img :src="song.thumbnail_url" class="pl-thumb" alt="Thumbnail" @error="thumbFallback" />
            <div class="pl-info">
              <p class="pl-title">{{ song.title }}</p>
              <p class="pl-meta">#{{ song.position }} &middot; {{ formatDuration(song.duration_sec) }}</p>
            </div>
            <div class="pl-actions">
              <button class="v-btn" :class="song.active ? 'v-btn-warn' : 'v-btn-success'" @click="toggleFallbackSong(song.id)">
                {{ song.active ? 'Desactivar' : 'Activar' }}
              </button>
              <button class="v-btn v-btn-danger" @click="removeFallbackSong(song.id)">Quitar</button>
            </div>
          </div>
          <p v-if="!playlist.length" class="text-muted">Sin canciones. Importa una playlist o agrega canciones individuales.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.vd-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

.vd-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.logo-upload {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}

.logo-preview {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-sm, 8px);
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border);
}

.logo-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.logo-btn {
  padding: 8px 16px;
  font-size: 13px;
  width: auto;
  cursor: pointer;
}

.logo-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.preset-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-card:hover {
  border-color: var(--border);
}

.preset-card.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.preset-swatches {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.ps {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--border);
}

.ps-accent {
  width: 22px;
  height: 22px;
}

.preset-name {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
}

.preset-mode {
  font-size: 14px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.limits-actions {
  margin-top: 14px;
}

.save-msg {
  font-size: 13px;
  color: var(--success);
  font-weight: 600;
}

.config-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--danger);
  font-weight: 500;
}

.danger-card {
  border-color: var(--danger-soft);
}

.danger-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-venue-toggle {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated);
  border: 1px solid var(--warning);
  color: var(--warning);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-venue-toggle:hover {
  background: var(--warning);
  color: var(--bg);
}

.btn-delete {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-sm, 8px);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  color: var(--danger);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-delete:hover {
  background: var(--danger);
  color: var(--text-on-primary, #FFFFFF);
}

.admin-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.admin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.admin-name {
  font-weight: 600;
}

.add-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pass-wrap {
  position: relative;
  width: 100%;
}

.pass-wrap .input-field {
  width: 100%;
  padding-right: 36px;
}

.eye-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.6;
  color: var(--text-muted);
}

.eye-btn:hover {
  opacity: 1;
  color: var(--text);
}

.v-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm, 8px);
  font-size: 12px;
  font-weight: 600;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.v-btn-warn {
  border-color: var(--warning);
  color: var(--warning);
}

.v-btn-warn:hover {
  background: var(--warning);
  color: var(--bg);
}

.v-btn-danger {
  border-color: var(--danger);
  color: var(--danger);
}

.v-btn-danger:hover {
  background: var(--danger);
  color: var(--text-on-primary, #FFFFFF);
}

.v-btn-success {
  border-color: var(--success);
  color: var(--success);
}

.v-btn-success:hover {
  background: var(--success);
  color: var(--bg);
}

.pl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.pl-input-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.pl-msg {
  font-size: 12px;
  color: var(--primary);
  margin-bottom: 8px;
}

.pl-list {
  max-height: 450px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.pl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm, 8px);
  border: 1px solid var(--border-soft);
  transition: opacity 0.15s;
}

.pl-disabled {
  opacity: 0.45;
}

.pl-thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.pl-info {
  flex: 1;
  min-width: 0;
}

.pl-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pl-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.pl-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.text-muted {
  color: var(--text-muted);
  font-size: 13px;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .vd-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    padding: 24px;
  }

  .card {
    padding: 20px;
  }

  .add-row {
    flex-direction: row;
    align-items: center;
  }

  .add-btn {
    width: auto;
    white-space: nowrap;
  }

  .pl-input-row {
    flex-direction: row;
    align-items: center;
  }

  .pl-input-row .input-field {
    flex: 1;
  }

  .pl-input-row .btn {
    width: auto;
    white-space: nowrap;
  }

  .add-single-btn {
    padding-left: 14px;
    padding-right: 14px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .vd-layout {
    padding: 12px 8px;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }

  .pl-item {
    flex-wrap: wrap;
  }

  .pl-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
