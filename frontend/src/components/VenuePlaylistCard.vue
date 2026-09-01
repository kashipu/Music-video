<template>
  <Card>
    <div class="pl-header">
      <p class="section-title">PLAYLIST DE RESPALDO ({{ playlist.length }})</p>
      <button v-if="playlist.length" class="v-btn v-btn-danger pl-clear-btn" @click="handleClearPlaylist">Limpiar todo</button>
    </div>
    <p class="hint">Estas canciones suenan automáticamente cuando no hay pedidos de las mesas.</p>
    <div class="pl-input-row">
      <Input v-model="playlistUrl" placeholder="URL de playlist de YouTube..." aria-label="URL de playlist de YouTube" />
      <Button :disabled="playlistLoading" @click="handleImportPlaylist">
        {{ playlistLoading ? 'Importando...' : 'Importar playlist' }}
      </Button>
    </div>
    <div class="pl-input-row">
      <Input v-model="addSongUrl" placeholder="URL de canción individual..." aria-label="URL de canción individual de YouTube" />
      <Button class="add-single-btn" :disabled="playlistLoading" aria-label="Agregar canción individual" @click="handleAddFallbackSong">+</Button>
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
          <button class="v-btn" :class="song.active ? 'v-btn-warn' : 'v-btn-success'" @click="handleToggleFallbackSong(song.id)">
            {{ song.active ? 'Desactivar' : 'Activar' }}
          </button>
          <button class="v-btn v-btn-danger" @click="handleRemoveFallbackSong(song.id)">Quitar</button>
        </div>
      </div>
      <p v-if="!playlist.length" class="text-muted">Sin canciones. Importa una playlist o agrega canciones individuales.</p>
    </div>
  </Card>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import Card from './ui/Card.vue'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import { formatDuration, thumbFallback } from '../utils/youtube.js'
import { useConfirmModal } from '../composables/useConfirmModal.js'
import {
  getVenuePlaylist,
  importVenuePlaylist,
  addVenueFallbackSong,
  removeVenueFallbackSong,
  toggleVenueFallbackSong,
  clearVenuePlaylist,
} from '../services/superadmin.js'

const props = defineProps({
  venueId: { type: String, required: true },
})

const playlist = ref([])
const playlistUrl = ref('')
const addSongUrl = ref('')
const playlistLoading = ref(false)
const playlistMsg = ref('')
const { confirm } = useConfirmModal()

onMounted(fetchPlaylist)

async function fetchPlaylist() {
  const res = await getVenuePlaylist(props.venueId)
  if (res.ok) {
    const data = await res.json()
    playlist.value = data.songs || []
  }
}

async function handleImportPlaylist() {
  if (!playlistUrl.value.trim()) return
  playlistLoading.value = true
  playlistMsg.value = 'Importando playlist...'
  try {
    const res = await importVenuePlaylist(props.venueId, playlistUrl.value)
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail)
    playlistMsg.value = data.message
    playlistUrl.value = ''
    await fetchPlaylist()
  } catch (e) {
    playlistMsg.value = e.message
  } finally {
    playlistLoading.value = false
  }
}

async function handleAddFallbackSong() {
  if (!addSongUrl.value.trim()) return
  playlistLoading.value = true
  try {
    const res = await addVenueFallbackSong(props.venueId, addSongUrl.value)
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail)
    addSongUrl.value = ''
    await fetchPlaylist()
  } catch (e) {
    playlistMsg.value = e.message
  } finally {
    playlistLoading.value = false
  }
}

async function handleRemoveFallbackSong(songId) {
  await removeVenueFallbackSong(props.venueId, songId)
  await fetchPlaylist()
}

async function handleToggleFallbackSong(songId) {
  await toggleVenueFallbackSong(props.venueId, songId)
  await fetchPlaylist()
}

async function handleClearPlaylist() {
  const ok = await confirm({
    title: 'Limpiar playlist',
    message: '¿Eliminar toda la playlist de respaldo de este bar? Esta acción no se puede deshacer.',
    danger: true,
    confirmText: 'Limpiar todo',
  })
  if (!ok) return
  await clearVenuePlaylist(props.venueId)
  playlist.value = []
}
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.pl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pl-clear-btn {
  font-size: 11px;
  padding: 3px 10px;
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
.pl-disabled { opacity: 0.45; }
.pl-thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.pl-info { flex: 1; min-width: 0; }
.pl-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pl-meta { font-size: 11px; color: var(--text-muted); }
.pl-actions { display: flex; gap: 4px; flex-shrink: 0; }
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
.v-btn-warn { border-color: var(--warning); color: var(--warning); }
.v-btn-warn:hover { background: var(--warning); color: var(--bg); }
.v-btn-danger { border-color: var(--danger); color: var(--danger); }
.v-btn-danger:hover { background: var(--danger); color: var(--text-on-primary, #FFFFFF); }
.v-btn-success { border-color: var(--success); color: var(--success); }
.v-btn-success:hover { background: var(--success); color: var(--bg); }

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .card { padding: 20px; }
  .pl-input-row {
    flex-direction: row;
    align-items: center;
  }
  .pl-input-row :deep(.input-field) { flex: 1; }
  .pl-input-row :deep(button) { width: auto; white-space: nowrap; }
  .add-single-btn { padding-left: 14px; padding-right: 14px; }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .pl-item { flex-wrap: wrap; }
  .pl-actions { width: 100%; justify-content: flex-end; }
}
</style>
