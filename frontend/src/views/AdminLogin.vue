<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTheme } from '../composables/useTheme.js'
import { useGoogleAuth } from '../composables/useGoogleAuth.js'
import AuthLoginForm from '../components/AuthLoginForm.vue'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'

const { applyVenueTheme, clearVenueTheme } = useTheme()
const { startGoogleAuth } = useGoogleAuth()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const API = import.meta.env.VITE_API_URL || ''
const venueSlug = route.params.venueSlug || null
document.title = venueSlug ? `${venueSlug.replace(/-/g, ' ')} - Admin` : 'Repítela - Admin'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const venueName = ref('')
const venueLogo = ref(null)

onMounted(async () => {
  if (venueSlug) {
    try {
      const res = await fetch(`${API}/api/auth/venue-info?venue_slug=${venueSlug}`)
      if (res.ok) {
        const data = await res.json()
        venueName.value = data.venue_name || ''
        if (data.logo_url) {
          venueLogo.value = data.logo_url.startsWith('/') ? API + data.logo_url : data.logo_url
        }
        if (venueName.value) {
          document.title = `${venueName.value} - Admin`
        }
        if (data.theme) {
          applyVenueTheme({ theme: data.theme })
        }
      }
    } catch {
      /* Fallback to default */
    }
  } else {
    clearVenueTheme()
  }
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await auth.adminLogin(username.value, password.value, venueSlug)
    const slug = data.admin?.venue_slug || venueSlug
    router.push({ name: 'admin', params: { venueSlug: slug } })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleGoogleLogin(credential) {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/google-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: credential,
        venue_name: null,
        terms_version: '2026-08',
        terms_accepted: true,
        privacy_accepted: true,
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.detail || 'No se encontró una cuenta asociada a este correo')
    }
    const data = await res.json()
    auth.adminToken = data.token
    auth.adminInfo = data.admin
    localStorage.setItem('bq_admin_token', data.token)
    localStorage.setItem('bq_admin', JSON.stringify(data.admin))
    const slug = data.admin?.venue_slug || venueSlug
    router.push({ name: 'admin', params: { venueSlug: slug } })
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function startGoogleLogin() {
  error.value = ''
  try {
    await startGoogleAuth(credential => handleGoogleLogin(credential))
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <AuthSplitLayout>
    <AuthLoginForm
      v-model:username="username"
      v-model:password="password"
      :title="venueName || (venueSlug ? venueSlug.replace(/-/g, ' ') : 'Repítela')"
      subtitle="Panel de administración"
      :logo-url="venueLogo"
      :error="error"
      :loading="loading"
      :show-google="true"
      @submit="handleLogin"
      @google="startGoogleLogin"
    >
      <template #footer>
        <p class="signup-prompt">
          <RouterLink :to="{ name: 'admin-forgot-password' }" class="signup-link">¿Olvidaste tu contraseña?</RouterLink>
        </p>
        <p class="signup-prompt">
          ¿No tienes cuenta?
          <RouterLink :to="{ name: 'admin-signup' }" class="signup-link">Regístrate</RouterLink>
        </p>
      </template>
    </AuthLoginForm>
  </AuthSplitLayout>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.signup-prompt {
  margin-top: 8px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.signup-link {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
  margin-left: 4px;
}

.signup-link:hover {
  text-decoration: underline;
}
</style>
