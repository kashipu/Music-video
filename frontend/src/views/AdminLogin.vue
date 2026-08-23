<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useTheme } from '../composables/useTheme.js'
import AuthLoginForm from '../components/AuthLoginForm.vue'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'

const { applyVenueTheme, clearVenueTheme } = useTheme()

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
      @submit="handleLogin"
    />
  </AuthSplitLayout>
</template>
