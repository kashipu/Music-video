<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTheme } from '../composables/useTheme.js'
import { trackUserRegistered, trackSessionStarted, setAnalyticsContext } from '../utils/analytics.js'
import ThemeToggle from '../components/ui/ThemeToggle.vue'
import VenueLogo from '../components/VenueLogo.vue'
import FormField from '../components/ui/FormField.vue'
import FormError from '../components/ui/FormError.vue'
import Input from '../components/ui/Input.vue'
import Button from '../components/ui/Button.vue'

const { applyVenueTheme } = useTheme()

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
const venueLogoLight = ref(null)
const venueLogoDark = ref(null)
const error = ref('')
const loading = ref(false)
const pageOpenedAt = Date.now()

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
      venueLogoLight.value = data.logo_url_light || null
      venueLogoDark.value = data.logo_url_dark || null
      if (venueName.value) document.title = `${venueName.value} - Repitela`
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
    const registrationTimeSec = Math.round((Date.now() - pageOpenedAt) / 1000)
    trackUserRegistered(venueSlug, !!data.user?.id, registrationTimeSec)
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
    <ThemeToggle style="position:fixed;top:16px;right:16px;" />
    <div class="container">
      <div class="landing-header">
        <VenueLogo v-if="venueLogo || venueLogoLight || venueLogoDark" :src="venueLogo" :src-light="venueLogoLight" :src-dark="venueLogoDark" class="venue-logo" />
        <div v-else class="music-icon">&#9835;</div>
        <h1 v-if="!venueLogo && !venueLogoLight && !venueLogoDark">{{ venueName || venueSlug.replace(/-/g, ' ') }}</h1>
        <p class="subtitle">Elige la musica que suena!</p>
        <p class="powered-by">por Repitela</p>
      </div>

      <form class="register-form" @submit.prevent="handleRegister">
        <FormField label="Tu número de celular" required v-slot="{ id }">
          <Input
            :id="id"
            v-model="phone"
            type="tel"
            placeholder="+57 300 123 4567"
            inputmode="tel"
            required
          />
        </FormField>

        <FormField label="Tu nombre (opcional)" v-slot="{ id }">
          <Input
            :id="id"
            v-model="displayName"
            type="text"
            placeholder="¿Cómo te llamas?"
          />
        </FormField>

        <FormField v-if="pinRequired" label="Código PIN (visible en la pantalla del bar)" required v-slot="{ id }">
          <Input
            :id="id"
            v-model="pin"
            type="text"
            class="pin-input"
            placeholder="1234"
            inputmode="numeric"
            maxlength="4"
            autocomplete="off"
            required
          />
        </FormField>

        <label class="consent-label">
          <input v-model="dataConsent" type="checkbox" />
          <span>Acepto el uso de mis datos para mejorar la experiencia musical del bar.</span>
        </label>

        <FormError :message="error" />

        <Button type="submit" :disabled="loading">
          {{ loading ? 'Entrando...' : 'ENTRAR' }}
        </Button>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
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
  max-width: 200px;
  max-height: 120px;
  width: auto;
  height: auto;
  object-fit: contain;
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
</style>
