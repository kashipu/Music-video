<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const venueSlug = route.params.venueSlug

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.adminLogin(username.value, password.value, venueSlug)
    router.push({ name: 'admin', params: { venueSlug } })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="container">
      <div class="login-header">
        <h1>{{ venueSlug.replace(/-/g, ' ') }}</h1>
        <p class="subtitle">Panel de administracion</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Usuario</label>
          <input v-model="username" type="text" class="input-field" placeholder="admin" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Contrasena</label>
          <input v-model="password" type="password" class="input-field" placeholder="********" autocomplete="current-password" />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Entrando...' : 'ENTRAR' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h1 {
  font-size: 24px;
}
.subtitle {
  color: var(--text-muted);
  font-size: 15px;
}
.login-form {
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
.error-msg {
  color: var(--danger);
  font-size: 14px;
  text-align: center;
}
</style>
