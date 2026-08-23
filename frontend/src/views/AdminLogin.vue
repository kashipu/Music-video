<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import AuthLoginForm from '../components/AuthLoginForm.vue'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const venueSlug = route.params.venueSlug || null
document.title = venueSlug ? `${venueSlug.replace(/-/g, ' ')} - Admin` : 'Repitela - Admin'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

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
      :title="venueSlug ? venueSlug.replace(/-/g, ' ') : 'Repitela'"
      subtitle="Panel de administracion"
      :error="error"
      :loading="loading"
      @submit="handleLogin"
    />
  </AuthSplitLayout>
</template>
