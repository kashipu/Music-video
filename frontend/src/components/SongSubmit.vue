<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { useQueueStore } from '../stores/queue.js'
import { trackSongSearched, trackSongSubmitted, trackSearchResultSelected } from '../utils/analytics.js'

const API = import.meta.env.VITE_API_URL || ''

const props = defineProps({
  rateLimit: { type: Object, default: null },
})

const emit = defineEmits(['preview'])
const queueStore = useQueueStore()

const searchQuery = ref('')
const searchResults = ref([])
const error = ref('')
const loading = ref(false)
const loadingItemId = ref(null) // youtube_id of the search result currently being added
const searching = ref(false)
const countdown = ref('')
let countdownInterval = null
let searchTimeout = null
let searchStartedAt = null

const remaining = () => props.rateLimit?.songs_remaining ?? 5
const isBlocked = computed(() => remaining() <= 0)

function startCountdown() {
  stopCountdown()
  updateCountdown()
  countdownInterval = setInterval(updateCountdown, 1000)
}

function stopCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null }
}

function updateCountdown() {
  if (!props.rateLimit?.window_resets_at) { countdown.value = ''; return }
  const diff = Math.max(0, new Date(props.rateLimit.window_resets_at).getTime() - Date.now())
  if (diff <= 0) { countdown.value = ''; stopCountdown(); queueStore.fetchRemainingSlots(); return }
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  countdown.value = `${mins}:${secs.toString().padStart(2, '0')}`
}

watch(() => props.rateLimit?.songs_remaining, (val) => {
  if (val !== undefined && val <= 0) startCountdown()
  else { stopCountdown(); countdown.value = '' }
}, { immediate: true })

onUnmounted(stopCountdown)

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (searchQuery.value.length < 2) { searchResults.value = []; return }
  searchTimeout = setTimeout(doSearch, 400)
}

async function doSearch() {
  if (searchQuery.value.length < 2) return
  searching.value = true
  error.value = ''
  searchStartedAt = Date.now()
  try {
    const res = await fetch(`${API}/api/queue/search?q=${encodeURIComponent(searchQuery.value)}`)
    if (res.ok) {
      const data = await res.json()
      searchResults.value = data.results
      const searchDurationMs = Date.now() - searchStartedAt
      trackSongSearched(searchQuery.value, data.results.length, searchDurationMs)
    }
  } catch { /* ignore */ }
  finally { searching.value = false }
}

async function selectResult(result, index) {
  error.value = ''
  if (remaining() <= 0) { error.value = 'Ya usaste tus canciones'; return }
  if (loadingItemId.value) return // prevent anger-click on another item while one is processing
  loadingItemId.value = result.youtube_id
  loading.value = true
  try {
    trackSearchResultSelected(
      searchQuery.value, index, searchResults.value.length,
      result.youtube_id, result.title,
    )
    const preview = await queueStore.submitSong(result.url)
    trackSongSubmitted(preview.youtube_id, preview.title, 'search', index)
    emit('preview', preview)
    searchQuery.value = ''
    searchResults.value = []
  } catch (e) {
    error.value = e.message
  } finally { loadingItemId.value = null; loading.value = false }
}

</script>

<template>
  <div class="submit-section" style="margin-top: 16px;">

    <!-- Blocked -->
    <div v-if="isBlocked" class="blocked card">
      <div class="blocked-icon">&#9201;</div>
      <p class="blocked-title">Limite alcanzado</p>
      <p class="blocked-sub">Usaste tus {{ rateLimit?.max_songs || 5 }} canciones. Podras pedir mas en:</p>
      <p class="blocked-timer">{{ countdown }}</p>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </div>

    <template v-else>
      <!-- Card header: hint + remaining dots -->
      <div class="submit-header">
        <span class="search-hint">&#127925; Pide tu cancion</span>
        <div class="rate-dots" v-if="rateLimit">
          <span
            v-for="i in (rateLimit.max_songs || 5)"
            :key="i"
            class="rate-dot"
            :class="{ used: i > rateLimit.songs_remaining }"
          ></span>
        </div>
      </div>

      <!-- Search input with icon -->
      <div class="search-wrapper">
        <span class="search-icon">&#128269;</span>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Artista, cancion, genero..."
          @input="onSearchInput"
          @keydown.enter.prevent="doSearch"
          autofocus
        />
      </div>

      <!-- Searching indicator -->
      <div v-if="searching" class="search-status">
        <span class="search-spinner"></span>
        <span>Buscando...</span>
      </div>

      <!-- Results -->
      <div v-if="searchResults.length" class="search-results">
        <div
          v-for="(r, i) in searchResults"
          :key="r.youtube_id"
          class="result-item"
          :class="{ 'result-item--loading': loadingItemId === r.youtube_id, 'result-item--blocked': loadingItemId && loadingItemId !== r.youtube_id }"
          @click="selectResult(r, i)"
        >
          <img :src="r.thumbnail_url" class="result-thumb" />
          <div class="result-info">
            <p class="result-title">{{ r.title }}</p>
            <p class="result-duration" v-if="r.duration">&#9654; {{ r.duration }}</p>
          </div>
          <button class="result-add" :disabled="!!loadingItemId">
            <span v-if="loadingItemId === r.youtube_id" class="btn-spinner"></span>
            <span v-else>+</span>
          </button>
        </div>
      </div>

      <p v-if="searchQuery.length >= 2 && !searching && !searchResults.length" class="no-results">
        Sin resultados para "<em>{{ searchQuery }}</em>"
      </p>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
/* ── Card wrapper ── */
.submit-section {
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 3px var(--shadow);
}

/* ── Header row ── */
.submit-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.search-hint { font-size: 13px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.3px; text-transform: uppercase; }
.rate-dots { display: flex; gap: 5px; }
.rate-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary); opacity: 1;
  transition: opacity 0.2s, background 0.2s;
}
.rate-dot.used { background: var(--border); opacity: 0.4; }

/* ── Search input ── */
.search-wrapper {
  position: relative; margin-bottom: 4px;
}
.search-icon {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  font-size: 15px; pointer-events: none; opacity: 0.45;
}
.search-input {
  width: 100%; padding: 13px 16px 13px 42px;
  background: var(--bg-elevated); border: 1.5px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text);
  font-size: 16px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  -webkit-appearance: none; appearance: none;
}
.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.search-input::placeholder { color: var(--text-muted); }
.search-input::-webkit-search-cancel-button { -webkit-appearance: none; }

/* ── Status ── */
.search-status {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 13px; color: var(--text-muted); padding: 14px 0;
}
.search-spinner {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  animation: spin 0.7s linear infinite;
}
.no-results {
  font-size: 13px; color: var(--text-muted); text-align: center;
  padding: 14px 0; line-height: 1.5;
}

/* ── Results list ── */
.search-results { max-height: 50dvh; max-height: 50vh; overflow-y: auto; margin-top: 4px; }
.result-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 4px; cursor: pointer;
  border-top: 1px solid var(--border-soft);
  transition: background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.result-item:first-child { border-top: none; }
.result-item:active { background: var(--bg-elevated); border-radius: 8px; }
.result-thumb {
  width: 60px; height: 45px; border-radius: 6px;
  object-fit: cover; flex-shrink: 0;
}
.result-info { flex: 1; min-width: 0; }
.result-title {
  font-size: 13px; font-weight: 500; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.result-duration { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.result-add {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--primary); color: white;
  font-size: 20px; font-weight: 300; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; transition: all 0.15s; line-height: 1;
}
.result-add:hover { background: var(--primary-dark); transform: scale(1.08); }
.result-add:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* Item states */
.result-item--loading { background: var(--bg-elevated); border-radius: 8px; opacity: 1; }
.result-item--blocked { opacity: 0.4; pointer-events: none; }

/* ── Spinners ── */
.btn-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff; border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Errors ── */
.error-msg { color: var(--danger); font-size: 13px; margin-top: 10px; }

/* ── Blocked state ── */
.blocked { text-align: center; padding: 20px 8px; }
.blocked-icon { font-size: 36px; margin-bottom: 8px; }
.blocked-title { font-size: 16px; font-weight: 700; color: var(--warning); }
.blocked-sub { font-size: 13px; color: var(--text-muted); margin-top: 6px; line-height: 1.5; }
.blocked-timer {
  font-size: 48px; font-weight: 800; color: var(--text);
  margin: 14px 0 8px; font-variant-numeric: tabular-nums; letter-spacing: -1px;
}
.progress-bar { height: 4px; background: var(--bg-elevated); border-radius: 2px; overflow: hidden; margin-top: 12px; }
.progress-fill { height: 100%; background: var(--warning); border-radius: 2px; animation: shrink 1800s linear forwards; }
@keyframes shrink { from { width: 100%; } to { width: 0%; } }
</style>
