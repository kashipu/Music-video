<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTheme } from '../composables/useTheme.js'
import { trackUserRegistered, trackSessionStarted } from '../utils/analytics.js'

const { currentMode, toggleMode, applyVenueTheme } = useTheme()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const API = import.meta.env.VITE_API_URL || ''
const venueSlug = route.params.venueSlug

const phone = ref('')
const displayName = ref('')
const dataConsent = ref(false)
const pin = ref('')
const pinRequired = ref(false)
const venueName = ref('')
const venueLogo = ref(null)
const error = ref('')
const loading = ref(false)

onMounted(async () => {
  if (auth.isAuthenticated && auth.session?.venue_slug === venueSlug) {
    router.push({ name: 'usuario', params: { venueSlug } })
    return
  }
  // Fetch venue info (name, logo, theme, PIN)
  try {
    const res = await fetch(`${API}/api/auth/venue-info?venue_slug=${venueSlug}`)
    if (res.ok) {
      const data = await res.json()
      pinRequired.value = data.pin_required
      venueName.value = data.venue_name || ''
      venueLogo.value = data.logo_url || null
      if (data.theme) applyVenueTheme({ theme: data.theme })
    }
  } catch { /* */ }
})

async function handleRegister() {
  error.value = ''
  if (!phone.value.trim()) {
    error.value = 'Ingresa tu numero de celular'
    return
  }
  if (!dataConsent.value) {
    error.value = 'Debes aceptar el uso de datos para continuar'
    return
  }
  loading.value = true
  try {
    const data = await auth.register(phone.value, null, venueSlug, dataConsent.value, displayName.value, pinRequired.value ? pin.value : null)
    trackUserRegistered(venueSlug, !!data.user?.id)
    trackSessionStarted(venueSlug)
    router.push({ name: 'usuario', params: { venueSlug } })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="landing">
    <button class="theme-toggle" style="position:fixed;top:16px;right:16px;" @click="toggleMode">{{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}</button>
    <div class="container">
      <div class="landing-header">
        <img v-if="venueLogo" :src="venueLogo" class="venue-logo" />
        <div v-else class="music-icon">&#9835;</div>
        <h1>{{ venueName || venueSlug.replace(/-/g, ' ') }}</h1>
        <p class="subtitle">Elige la musica que suena!</p>
        <p class="powered-by">por Repitela</p>
      </div>

      <form class="register-form" @submit.prevent="handleRegister">
        <div class="form-group">
          <label>Tu numero de celular</label>
          <input
            v-model="phone"
            type="tel"
            class="input-field"
            placeholder="+57 300 123 4567"
            inputmode="tel"
          />
        </div>

        <div class="form-group">
          <label>Tu nombre (opcional)</label>
          <input
            v-model="displayName"
            type="text"
            class="input-field"
            placeholder="Como te llamas?"
          />
        </div>

        <div v-if="pinRequired" class="form-group">
          <label>Codigo PIN (visible en la pantalla del bar)</label>
          <input
            v-model="pin"
            type="text"
            class="input-field pin-input"
            placeholder="1234"
            inputmode="numeric"
            maxlength="4"
            autocomplete="off"
          />
        </div>

        <label class="consent-label">
          <input v-model="dataConsent" type="checkbox" />
          <span>Acepto el uso de mis datos para mejorar la experiencia musical del bar.</span>
        </label>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Entrando...' : 'ENTRAR' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  padding-top: max(24px, env(safe-area-inset-top));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
.landing-header {
  text-align: center;
  margin-bottom: 32px;
}
.venue-logo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 12px;
}
.music-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
.landing-header h1 {
  font-size: 24px;
  text-transform: capitalize;
  margin-bottom: 4px;
}
.subtitle {
  color: var(--text-muted);
  font-size: 15px;
}
.powered-by {
  color: var(--text-muted);
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.6;
}
.register-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}
.consent-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
}
.consent-label input {
  margin-top: 2px;
  accent-color: var(--primary);
}
.pin-input {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 8px;
  max-width: 160px;
}
.error-msg {
  color: var(--danger);
  font-size: 14px;
  text-align: center;
}
</style>
