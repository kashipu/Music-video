<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import { useAuthStore } from '../stores/auth.js'

const API = import.meta.env.VITE_API_URL || ''
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const router = useRouter()
const auth = useAuthStore()
const venueName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venue_name: venueName.value, email: email.value, password: password.value, terms_version: '2026-08', terms_accepted: accepted.value, privacy_accepted: accepted.value, turnstile_token: turnstileToken.value }),
    })
    if (!res.ok) throw new Error(await responseError(res))
    success.value = 'Cuenta creada. Revisa tu correo para verificarla.'
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
    resetTurnstile()
  }
}

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('No pudimos cargar Google'))
    document.head.appendChild(script)
  })
}

async function handleGoogle(credential) {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/google-signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: credential, venue_name: venueName.value || null, terms_version: '2026-08', terms_accepted: accepted.value, privacy_accepted: accepted.value, turnstile_token: turnstileToken.value }),
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
    resetTurnstile()
  }
}

async function startGoogleSignup() {
  if (!accepted.value) {
    error.value = 'Debes aceptar los terminos y el tratamiento de datos'
    return
  }
  if (TURNSTILE_SITE_KEY && !turnstileToken.value) {
    error.value = 'Completa la verificacion anti-bot'
    return
  }
  if (!GOOGLE_CLIENT_ID) {
    error.value = 'Google Sign-In no esta configurado'
    return
  }
  try {
    await loadGoogle()
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: ({ credential }) => handleGoogle(credential) })
    window.google.accounts.id.prompt()
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
    script.onerror = () => reject(new Error('No pudimos cargar la verificacion anti-bot'))
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
  <AuthSplitLayout>
    <header class="signup-header"><h1>Crea tu cuenta</h1><p>Repitela es gratis por {{ trialDays }} dias</p></header>
    <form class="signup-form" @submit.prevent="submitSignup">
      <label>Nombre del bar<Input v-model="venueName" required autocomplete="organization" /></label>
      <label>Correo electronico<Input v-model="email" type="email" required autocomplete="email" /></label>
      <label>Contrasena
        <span class="password-field"><Input v-model="password" :type="showPassword ? 'text' : 'password'" required minlength="8" autocomplete="new-password" /><button type="button" @click="showPassword = !showPassword">{{ showPassword ? 'Ocultar' : 'Mostrar' }}</button></span>
      </label>
      <label class="consent">
        <input v-model="accepted" type="checkbox" />
        <span>Acepto los términos y la <a href="/privacidad" target="_blank" rel="noopener noreferrer">política de tratamiento de datos personales</a>.</span>
      </label>
      <div v-if="TURNSTILE_SITE_KEY" ref="turnstileElement" class="turnstile" />
      <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
      <p v-if="success" class="success-msg" role="status">{{ success }}</p>
      <Button type="submit" :disabled="loading || !accepted || (TURNSTILE_SITE_KEY && !turnstileToken)">{{ loading ? 'Creando...' : 'Crear cuenta' }}</Button>
      <div class="divider">o continua con</div>
      <Button type="button" variant="secondary" :disabled="loading" @click="startGoogleSignup"><svg viewBox="0 0 24 24" width="16" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" /></svg>Continuar con Google</Button>
    </form>
  </AuthSplitLayout>
</template>

<style scoped>
.signup-header { margin-bottom: 24px; text-align: center; }.signup-header p, label, .consent, .divider { color: var(--text-muted); }.signup-form, label { display: flex; flex-direction: column; gap: 6px; }.signup-form { gap: 16px; }.password-field { position: relative; }.password-field button { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--primary); font-size: 12px; }.consent { flex-direction: row; align-items: start; font-size: 13px; }.consent input { margin-top: 3px; }.consent a { color: var(--primary); }.turnstile { min-height: 65px; }.divider { display: flex; align-items: center; gap: 12px; font-size: 12px; text-transform: uppercase; }.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }.btn-secondary { display: flex; align-items: center; gap: 10px; }.error-msg { color: var(--danger); text-align: center; }.success-msg { color: var(--success); text-align: center; }
</style>
