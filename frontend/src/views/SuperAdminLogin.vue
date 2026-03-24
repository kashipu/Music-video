<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const auth = useAuthStore()
const API = import.meta.env.VITE_API_URL || ''

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('bq_super_token', data.token)
    localStorage.setItem('bq_super_admin', JSON.stringify(data.admin))
    router.push({ name: 'superadmin' })
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
        <h1>BarQueue</h1>
        <p class="subtitle">Super Administrador</p>
      </div>
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Usuario</label>
          <input v-model="username" type="text" class="input-field" placeholder="username" autocomplete="username" />
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
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login-header { text-align: center; margin-bottom: 32px; }
.login-header h1 { font-size: 24px; }
.subtitle { color: var(--text-muted); font-size: 15px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; font-weight: 600; color: var(--text-muted); }
.error-msg { color: var(--danger); font-size: 14px; text-align: center; }
</style>
