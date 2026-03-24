<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { useQueueStore } from '../stores/queue.js'

const props = defineProps({
  rateLimit: { type: Object, default: null },
})

const emit = defineEmits(['preview'])
const queueStore = useQueueStore()

const url = ref('')
const error = ref('')
const loading = ref(false)
const countdown = ref('')
let countdownInterval = null

const remaining = () => props.rateLimit?.songs_remaining ?? 5
const isBlocked = computed(() => remaining() <= 0)

function startCountdown() {
  stopCountdown()
  updateCountdown()
  countdownInterval = setInterval(updateCountdown, 1000)
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function updateCountdown() {
  if (!props.rateLimit?.window_resets_at) {
    countdown.value = ''
    return
  }
  const resetAt = new Date(props.rateLimit.window_resets_at).getTime()
  const now = Date.now()
  const diff = Math.max(0, resetAt - now)

  if (diff <= 0) {
    countdown.value = ''
    stopCountdown()
    queueStore.fetchRemainingSlots()
    return
  }

  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  countdown.value = `${mins}:${secs.toString().padStart(2, '0')}`
}

watch(() => props.rateLimit?.songs_remaining, (val) => {
  if (val !== undefined && val <= 0) {
    startCountdown()
  } else {
    stopCountdown()
    countdown.value = ''
  }
}, { immediate: true })

onUnmounted(stopCountdown)

async function handleSubmit() {
  error.value = ''
  if (!url.value.trim()) {
    error.value = 'Pega un link de YouTube'
    return
  }
  if (remaining() <= 0) {
    error.value = 'Ya usaste tus canciones. Espera un poco.'
    return
  }

  loading.value = true
  try {
    const preview = await queueStore.submitSong(url.value)
    emit('preview', preview)
    url.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    url.value = text
  } catch {
    // clipboard not available
  }
}
</script>

<template>
  <div class="card submit-section" style="margin-top: 16px;">
    <p class="section-title">Pegar Link de YouTube</p>

    <!-- Blocked: countdown -->
    <div v-if="isBlocked" class="blocked">
      <p class="blocked-title">Ya usaste tus {{ rateLimit?.max_songs || 5 }} canciones</p>
      <p class="blocked-sub">Podras pedir mas en:</p>
      <p class="blocked-timer">{{ countdown }}</p>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
    </div>

    <!-- Normal: submit form -->
    <template v-else>
      <form class="submit-form" @submit.prevent="handleSubmit">
        <div class="input-row">
          <input
            v-model="url"
            type="url"
            class="input-field"
            placeholder="https://youtu.be/..."
            inputmode="url"
          />
          <button type="button" class="paste-btn" @click="pasteFromClipboard">Pegar</button>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Validando...' : 'ENVIAR' }}
        </button>
      </form>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="rate-info" v-if="rateLimit">
        <span>Te quedan <strong>{{ rateLimit.songs_remaining }}</strong> canciones</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.submit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.input-row {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.input-row .input-field {
  flex: 1;
  min-width: 0;
}
.paste-btn {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  white-space: nowrap;
}
.error-msg {
  color: var(--danger);
  font-size: 13px;
  margin-top: 8px;
}
.rate-info {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
}
.blocked {
  text-align: center;
  padding: 16px 0;
}
.blocked-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--warning);
}
.blocked-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.blocked-timer {
  font-size: 40px;
  font-weight: 700;
  color: var(--text);
  margin: 12px 0;
  font-variant-numeric: tabular-nums;
}
.progress-bar {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}
.progress-fill {
  height: 100%;
  background: var(--warning);
  border-radius: 3px;
  animation: shrink 1800s linear forwards;
}
@keyframes shrink {
  from { width: 100%; }
  to { width: 0%; }
}
</style>
