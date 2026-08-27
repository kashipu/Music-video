<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Select from '../components/ui/Select.vue'
import FormField from '../components/ui/FormField.vue'
import FormError from '../components/ui/FormError.vue'
import PasswordInput from '../components/ui/PasswordInput.vue'
import { useAuthStore } from '../stores/auth.js'
import { useConfigStore } from '../stores/config.js'
import { useGoogleAuth } from '../composables/useGoogleAuth.js'
import { LATAM_COUNTRIES } from '../data/countries.js'

document.title = 'Repítela - Crear Cuenta'

const API = import.meta.env.VITE_API_URL || ''
const { startGoogleAuth } = useGoogleAuth()
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const router = useRouter()
const auth = useAuthStore()
const config = useConfigStore()

const venueName = ref('')
const email = ref('')
const phone = ref('')
const address = ref('')
const country = ref('Colombia')
const customCountry = ref(false)
const customCity = ref(false)

const availableCities = computed(() => {
  const selected = LATAM_COUNTRIES.find(c => c.name === country.value)
  return selected ? selected.cities : []
})

const city = ref(availableCities.value[0] || 'Medellín')

watch(country, (newCountry) => {
  const selected = LATAM_COUNTRIES.find(c => c.name === newCountry)
  if (!selected) return
  customCountry.value = false
  customCity.value = false
  city.value = selected.cities[0] || ''
})

watch(city, (newCity) => {
  if (customCity.value && availableCities.value.includes(newCity)) customCity.value = false
})

function selectCountry(value) {
  if (value === '__other__') {
    customCountry.value = true
    customCity.value = true
    country.value = ''
    city.value = ''
  } else {
    country.value = value
  }
}

function selectCity(value) {
  if (value === '__other__') {
    customCity.value = true
    city.value = ''
  } else {
    city.value = value
  }
}

const password = ref('')
const accepted = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref('')
const trialDays = ref(15)
const turnstileToken = ref('')
const turnstileElement = ref(null)
let turnstileWidget

async function responseError(res) {
  try { return (await res.json()).detail || 'No pudimos completar la solicitud' } catch { return 'No pudimos completar la solicitud' }
}

async function submitSignup() {
  error.value = ''
  success.value = ''
  loading.value = true
  try {
    const res = await fetch(`${API}/api/admin/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        venue_name: venueName.value,
        email: email.value,
        phone: phone.value,
        address: address.value,
        city: city.value,
        country: country.value,
        password: password.value,
        terms_version: '2026-08',
        terms_accepted: accepted.value,
        privacy_accepted: accepted.value,
        turnstile_token: turnstileToken.value,
      }),
    })
    if (!res.ok) throw new Error(await responseError(res))
    // La cuenta ya sirve: el login no exige email verificado. Mandamos a entrar en
    // vez de dejar el form lleno (un segundo submit daba 409).
    success.value = 'Cuenta creada. Ya puedes iniciar sesion con tu correo.'
    setTimeout(() => router.push({ name: 'admin-login-global' }), 1500)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
    resetTurnstile()
  }
}

async function handleGoogle(credential) {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/google-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: credential,
        venue_name: venueName.value || null,
        phone: phone.value || null,
        address: address.value || null,
        city: city.value || null,
        country: country.value || null,
        terms_version: '2026-08',
        terms_accepted: true,
        privacy_accepted: true,
      }),
    })
    if (!res.ok) throw new Error(await responseError(res))
    const data = await res.json()
    auth.adminToken = data.token
    auth.adminInfo = data.admin
    localStorage.setItem('bq_admin_token', data.token)
    localStorage.setItem('bq_admin', JSON.stringify(data.admin))
    router.push({ name: 'admin', params: { venueSlug: data.admin.venue_slug } })
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function startGoogleSignup() {
  error.value = ''
  try {
    await startGoogleAuth(credential => handleGoogle(credential))
  } catch (err) {
    error.value = err.message
  }
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('No pudimos cargar la verificación anti-bot'))
    document.head.appendChild(script)
  })
}

function resetTurnstile() {
  turnstileToken.value = ''
  if (turnstileWidget !== undefined && window.turnstile) window.turnstile.reset(turnstileWidget)
}

onMounted(async () => {
  try {
    const res = await fetch(`${API}/api/admin/trial-info`)
    if (res.ok) trialDays.value = (await res.json()).trial_days
  } catch { /* keep the schema default while offline */ }
  if (!TURNSTILE_SITE_KEY) return
  try {
    await loadTurnstile()
    turnstileWidget = window.turnstile.render(turnstileElement.value, {
      sitekey: TURNSTILE_SITE_KEY,
      // El backend exige result.action === 'signup' en siteverify.
      action: 'signup',
      callback: token => { turnstileToken.value = token },
      'expired-callback': () => { turnstileToken.value = '' },
    })
  } catch (err) { error.value = err.message }
})

onBeforeUnmount(() => {
  if (turnstileWidget !== undefined && window.turnstile) window.turnstile.remove(turnstileWidget)
})
</script>

<template>
  <AuthSplitLayout :wide="true">
    <header class="signup-header">
      <h1>Crea tu cuenta</h1>
      <div class="trial-badge-wrap">
        <span class="trial-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Repítela es gratis por {{ trialDays }} días
        </span>
      </div>
    </header>
    <form class="signup-form" @submit.prevent="submitSignup">
      <div class="form-grid">
        <FormField id="signup-venue-name" label="Nombre del bar" required v-slot="{ id }">
          <Input :id="id" v-model="venueName" required autocomplete="organization" />
        </FormField>
        <FormField id="signup-email" label="Correo electrónico" required v-slot="{ id }">
          <Input :id="id" v-model="email" type="email" required autocomplete="email" />
        </FormField>
        <FormField id="signup-phone" label="Teléfono" required v-slot="{ id }">
          <Input :id="id" v-model="phone" type="tel" required autocomplete="tel" placeholder="Ej: +57 300 123 4567" />
        </FormField>
        <FormField id="signup-address" label="Dirección" required v-slot="{ id }">
          <Input :id="id" v-model="address" required autocomplete="street-address" placeholder="Ej: Calle 10 # 40-20" />
        </FormField>
        <FormField v-if="!customCountry" id="signup-country" label="País" required v-slot="{ id }">
          <Select :id="id" :model-value="country" required @update:model-value="selectCountry">
            <option v-for="c in LATAM_COUNTRIES" :key="c.code" :value="c.name">
              {{ c.name }}
            </option>
            <option value="__other__">Otro</option>
          </Select>
        </FormField>
        <FormField v-else id="signup-country-custom" label="País" required v-slot="{ id }">
          <Input :id="id" v-model="country" list="country-options" required autocomplete="country-name" placeholder="Escribe tu país" />
          <datalist id="country-options">
            <option v-for="c in LATAM_COUNTRIES" :key="c.code" :value="c.name" />
          </datalist>
        </FormField>
        <FormField v-if="!customCity" id="signup-city" label="Ciudad" required v-slot="{ id }">
          <Select :id="id" :model-value="city" required @update:model-value="selectCity">
            <option v-for="cityName in availableCities" :key="cityName" :value="cityName">
              {{ cityName }}
            </option>
            <option value="__other__">Otro</option>
          </Select>
        </FormField>
        <FormField v-else id="signup-city-custom" label="Ciudad" required v-slot="{ id }">
          <Input :id="id" v-model="city" list="city-options" required autocomplete="address-level2" placeholder="Escribe tu ciudad" />
          <datalist id="city-options">
            <option v-for="cityName in availableCities" :key="cityName" :value="cityName" />
          </datalist>
        </FormField>
      </div>

      <FormField id="signup-password" class="full-width" label="Contraseña" required v-slot="{ id }">
        <PasswordInput
          :id="id"
          v-model="password"
          required
          minlength="8"
          autocomplete="new-password"
        />
      </FormField>

      <label class="consent">
        <input v-model="accepted" type="checkbox" />
        <span>Acepto los términos y la <a href="/privacidad" target="_blank" rel="noopener noreferrer">política de tratamiento de datos personales</a>.</span>
      </label>

      <div v-if="TURNSTILE_SITE_KEY" ref="turnstileElement" class="turnstile" />
      <FormError :message="error" />
      <p v-if="success" class="success-msg" role="status">{{ success }}</p>
      <Button type="submit" :disabled="loading || !accepted || (TURNSTILE_SITE_KEY && !turnstileToken)">{{ loading ? 'Creando...' : 'Crear cuenta' }}</Button>
      <template v-if="config.google_signup">
        <div class="divider">o continúa con</div>
        <Button type="button" variant="secondary" :disabled="loading" @click="startGoogleSignup">
          <svg viewBox="0 0 24 24" width="16" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Regístrate con Google
        </Button>
        <p class="google-consent">Al registrarte con Google, aceptas nuestros <a href="/privacidad" target="_blank" rel="noopener noreferrer">términos y política de tratamiento de datos</a>.</p>
      </template>
      <p class="login-prompt">
        ¿Ya tienes cuenta?
        <RouterLink :to="{ name: 'admin-login-global' }" class="login-link">Inicia sesión</RouterLink>
      </p>
    </form>
  </AuthSplitLayout>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.signup-header {
  margin-bottom: 24px;
  text-align: center;
}

.signup-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.trial-badge-wrap {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

.trial-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
  border: 1px solid var(--primary);
}

.signup-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.full-width {
  grid-column: 1 / -1;
}

.consent {
  display: flex;
  flex-direction: row;
  align-items: start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.consent input {
  margin-top: 3px;
  cursor: pointer;
}

.consent a {
  color: var(--primary);
  text-decoration: none;
}

.consent a:hover {
  text-decoration: underline;
}

.turnstile {
  min-height: 65px;
}

.google-consent {
  margin: 0;
  font-size: 12px;
  text-align: center;
  color: var(--text-muted);
}

.google-consent a {
  color: var(--primary);
  text-decoration: none;
}

.google-consent a:hover {
  text-decoration: underline;
}

.login-prompt {
  margin: 4px 0 0;
  font-size: 14px;
  text-align: center;
  color: var(--text-muted);
}

.login-link {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
  margin-left: 4px;
}

.login-link:hover {
  text-decoration: underline;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 10px;
}

.success-msg {
  color: var(--success);
  text-align: center;
  font-size: 13px;
}

/* =========================================
   BREAKPOINT 640px
   ========================================= */
@media (min-width: 700px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .trial-badge {
    font-size: 12px;
    padding: 4px 10px;
  }
}
</style>
