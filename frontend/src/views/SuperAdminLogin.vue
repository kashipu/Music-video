<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import AuthLoginForm from '../components/AuthLoginForm.vue'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

document.title = 'Repítela - Super Admin'

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.superAdminLogin(username.value, password.value)
    router.push({ name: 'superadmin' })
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
      title="Repítela"
      subtitle="Super Administrador"
      :error="error"
      :loading="loading"
      username-placeholder="username"
      @submit="handleLogin"
    />
  </AuthSplitLayout>
</template>
