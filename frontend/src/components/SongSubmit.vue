<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { useQueueStore } from '../stores/queue.js'

const API = import.meta.env.VITE_API_URL || ''

const props = defineProps({
  rateLimit: { type: Object, default: null },
})

const emit = defineEmits(['preview'])
const queueStore = useQueueStore()

const mode = ref('search') // 'search' or 'paste'
const url = ref('')
const searchQuery = ref('')
const searchResults = ref([])
const error = ref('')
const loading = ref(false)
const searching = ref(false)
const countdown = ref('')
let countdownInterval = null
let searchTimeout = null

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
  try {
    const res = await fetch(`${API}/api/queue/search?q=${encodeURIComponent(searchQuery.value)}`)
    if (res.ok) {
      const data = await res.json()
      searchResults.value = data.results
    }
  } catch { /* ignore */ }
  finally { searching.value = false }
}

async function selectResult(result) {
  error.value = ''
  if (remaining() <= 0) { error.value = 'Ya usaste tus canciones'; return }
  loading.value = true
  try {
    const preview = await queueStore.submitSong(result.url)
    emit('preview', preview)
    searchQuery.value = ''
    searchResults.value = []
  } catch (e) {
    error.value = e.message
  } finally { loading.value = false }
}

async function handlePaste() {
  error.value = ''
  if (!url.value.trim()) { error.value = 'Pega un link de YouTube'; return }
  if (remaining() <= 0) { error.value = 'Ya usaste tus canciones'; return }
  loading.value = true
  try {
    const preview = await queueStore.submitSong(url.value)
    emit('preview', preview)
    url.value = ''
  } catch (e) {
    error.value = e.message
  } finally { loading.value = false }
}

async function pasteFromClipboard() {
  try { url.value = await navigator.clipboard.readText() } catch { /* */ }
}
</script>

<template>
  <div class="card submit-section" style="margin-top: 16px;">

    <!-- Blocked -->
    <div v-if="isBlocked" class="blocked">
      <p class="blocked-title">Ya usaste tus {{ rateLimit?.max_songs || 5 }} canciones</p>
      <p class="blocked-sub">Podras pedir mas en:</p>
      <p class="blocked-timer">{{ countdown }}</p>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="mode-tabs">
        <button class="mode-tab" :class="{ active: mode === 'search' }" @click="mode = 'search'">Buscar</button>
        <button class="mode-tab" :class="{ active: mode === 'paste' }" @click="mode = 'paste'">Pegar link</button>
      </div>

      <!-- SEARCH MODE -->
      <div v-if="mode === 'search'" class="search-mode">
        <div class="search-input-row">
          <input
            v-model="searchQuery"
            type="text"
            class="input-field"
            placeholder="Busca tu cancion..."
            @input="onSearchInput"
            @keydown.enter.prevent="doSearch"
          />
        </div>

        <p v-if="searching" class="search-status">Buscando...</p>

        <div v-if="searchResults.length" class="search-results">
          <div v-for="r in searchResults" :key="r.youtube_id" class="result-item" @click="selectResult(r)">
            <img :src="r.thumbnail_url" class="result-thumb" />
            <div class="result-info">
              <p class="result-title">{{ r.title }}</p>
              <p class="result-duration" v-if="r.duration">{{ r.duration }}</p>
            </div>
            <button class="result-add" :disabled="loading">+</button>
          </div>
        </div>

        <p v-if="searchQuery.length >= 2 && !searching && !searchResults.length" class="search-status">
          Sin resultados
        </p>
      </div>

      <!-- PASTE MODE -->
      <div v-if="mode === 'paste'" class="paste-mode">
        <form class="submit-form" @submit.prevent="handlePaste">
          <div class="input-row">
            <input v-model="url" type="url" class="input-field" placeholder="https://youtu.be/..." inputmode="url" />
            <button type="button" class="paste-btn" @click="pasteFromClipboard">Pegar</button>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Validando...' : 'ENVIAR' }}
          </button>
        </form>
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="rate-info" v-if="rateLimit">
        <span>Te quedan <strong>{{ rateLimit.songs_remaining }}</strong> canciones</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Tabs */
.mode-tabs {
  display: flex; gap: 4px; margin-bottom: 12px;
  background: var(--bg-elevated); border-radius: 8px; padding: 3px;
}
.mode-tab {
  flex: 1; padding: 8px; border-radius: 6px;
  background: transparent; color: var(--text-muted);
  font-size: 13px; font-weight: 600; text-align: center;
  transition: all 0.15s;
}
.mode-tab.active {
  background: var(--primary); color: white;
}

/* Search */
.search-input-row { margin-bottom: 8px; }
.search-status { font-size: 13px; color: var(--text-muted); text-align: center; padding: 12px 0; }
.search-results { max-height: 320px; overflow-y: auto; }
.result-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 4px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s;
}
.result-item:hover { background: var(--bg-elevated); }
.result-thumb {
  width: 56px; height: 42px; border-radius: 6px;
  object-fit: cover; flex-shrink: 0;
}
.result-info { flex: 1; min-width: 0; }
.result-title {
  font-size: 13px; font-weight: 500; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.result-duration { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.result-add {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--primary); color: white;
  font-size: 18px; font-weight: 700; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; transition: all 0.15s;
}
.result-add:hover { background: var(--primary-dark); }
.result-add:disabled { opacity: 0.4; }

/* Paste */
.submit-form { display: flex; flex-direction: column; gap: 10px; }
.input-row { display: flex; gap: 8px; min-width: 0; }
.input-row .input-field { flex: 1; min-width: 0; }
.paste-btn {
  padding: 8px 14px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); color: var(--text-muted);
  font-size: 13px; font-weight: 600; border: 1px solid var(--border);
  white-space: nowrap;
}

/* Common */
.error-msg { color: var(--danger); font-size: 13px; margin-top: 8px; }
.rate-info { margin-top: 10px; font-size: 13px; color: var(--text-muted); }

/* Blocked */
.blocked { text-align: center; padding: 16px 0; }
.blocked-title { font-size: 15px; font-weight: 600; color: var(--warning); }
.blocked-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.blocked-timer {
  font-size: 40px; font-weight: 700; color: var(--text);
  margin: 12px 0; font-variant-numeric: tabular-nums;
}
.progress-bar { height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden; margin-top: 8px; }
.progress-fill { height: 100%; background: var(--warning); border-radius: 3px; animation: shrink 1800s linear forwards; }
@keyframes shrink { from { width: 100%; } to { width: 0%; } }
</style>
