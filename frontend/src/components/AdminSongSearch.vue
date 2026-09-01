<script setup>
import { onUnmounted, ref } from 'vue'
import { formatDuration, thumbFallback } from '../utils/youtube.js'
import { searchSongs } from '../services/admin.js'

defineProps({
  library: { type: Array, default: () => [] },
  loadingAdd: { type: Object, default: () => ({}) },
  addError: { type: String, default: '' },
})

const emit = defineEmits(['add-song', 'fetch-library'])

const addMode = ref('search')
const ytSearch = ref('')
const ytResults = ref([])
const ytSearching = ref(false)
const librarySearch = ref('')
let ytSearchTimeout = null

onUnmounted(() => { if (ytSearchTimeout) clearTimeout(ytSearchTimeout) })

function onYtSearch() {
  if (ytSearchTimeout) clearTimeout(ytSearchTimeout)
  if (ytSearch.value.length < 2) { ytResults.value = []; return }
  ytSearchTimeout = setTimeout(doYtSearch, 400)
}

async function doYtSearch() {
  if (ytSearch.value.length < 2) return
  ytSearching.value = true
  try {
    const data = await searchSongs(ytSearch.value)
    if (data?.results) ytResults.value = data.results
  } catch { /* */ }
  finally { ytSearching.value = false }
}

function onLibraryTabClick(library) {
  addMode.value = 'library'
  if (!library.length) emit('fetch-library', librarySearch.value)
}

function onLibrarySearchInput() {
  emit('fetch-library', librarySearch.value)
}
</script>

<template>
  <div class="card add-card">
    <div class="add-tabs">
      <button class="add-tab" :class="{ active: addMode === 'search' }" @click="addMode = 'search'">Buscar</button>
      <button class="add-tab" :class="{ active: addMode === 'library' }" @click="onLibraryTabClick(library)">Biblioteca</button>
    </div>

    <!-- Search YouTube -->
    <div v-if="addMode === 'search'">
      <input v-model="ytSearch" class="input-field" placeholder="Buscar en YouTube..." @input="onYtSearch" @keydown.enter.prevent="doYtSearch" />
      <p v-if="ytSearching" class="search-status">Buscando...</p>
      <div class="library-list" v-if="ytResults.length">
        <div v-for="r in ytResults" :key="r.youtube_id" class="lib-item">
          <img :src="r.thumbnail_url" class="lib-thumb" @error="thumbFallback" />
          <div class="lib-info">
            <p class="lib-title">{{ r.title }}</p>
            <p class="lib-artist">{{ r.duration }}</p>
          </div>
          <button class="ctrl-add-sm" :disabled="loadingAdd[r.youtube_id]" @click.stop="emit('add-song', r.youtube_id)">{{ loadingAdd[r.youtube_id] ? '...' : '+' }}</button>
        </div>
      </div>
    </div>

    <!-- Library -->
    <div v-if="addMode === 'library'" class="library">
      <input v-model="librarySearch" class="input-field" placeholder="Buscar en biblioteca..." @input="onLibrarySearchInput" />
      <div class="library-list">
        <div v-for="song in library" :key="song.youtube_id" class="lib-item">
          <img :src="song.thumbnail_url" class="lib-thumb" @error="thumbFallback" />
          <div class="lib-info">
            <p class="lib-title">{{ song.title }}</p>
            <p class="lib-artist">{{ song.artist }} &middot; {{ formatDuration(song.duration_sec) }}</p>
          </div>
          <button class="ctrl-add-sm" @click="emit('add-song', song.youtube_id)" :disabled="loadingAdd[song.youtube_id]">{{ loadingAdd[song.youtube_id] ? '...' : '+' }}</button>
        </div>
        <p v-if="!library.length" class="text-muted">Sin canciones guardadas</p>
      </div>
    </div>
    <p v-if="addError" class="add-error">{{ addError }}</p>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.add-card { padding: 14px; }
.add-tabs {
  display: flex; gap: 4px; background: var(--bg-elevated);
  border-radius: 8px; padding: 3px; margin-bottom: 10px;
}
.add-tab {
  flex: 1; padding: 6px; border-radius: 6px; background: transparent;
  color: var(--text-muted); font-size: 12px; font-weight: 600;
  text-align: center; transition: all 0.15s;
}
.add-tab.active { background: var(--primary); color: var(--text-on-primary); }
.search-status { font-size: 13px; color: var(--text-muted); text-align: center; padding: 12px 0; }
.add-error { color: var(--danger); font-size: 13px; margin-top: 8px; font-weight: 500; }
.ctrl-add-sm {
  width: 32px; height: 32px; min-width: 32px;
  background: var(--primary); border: 2px solid var(--primary);
  color: var(--text-on-primary, #ffffff); font-size: 18px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.ctrl-add-sm:disabled { opacity: 0.4; }
.library { display: flex; flex-direction: column; gap: 10px; }
.library-list { max-height: 300px; overflow-y: auto; }
.lib-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.lib-item:last-child { border-bottom: none; }
.lib-thumb { width: 48px; height: 36px; border-radius: 4px; object-fit: cover; }
.lib-info { flex: 1; min-width: 0; }
.lib-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-artist { font-size: 11px; color: var(--text-muted); }
.text-muted { color: var(--text-muted); font-size: 14px; }

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .lib-item { gap: 8px; }
  .lib-thumb { width: 40px; height: 30px; }
  .ctrl-add-sm { width: 28px; height: 28px; min-width: 28px; font-size: 16px; }
}
</style>
