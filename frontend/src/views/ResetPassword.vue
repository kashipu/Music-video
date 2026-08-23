<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'

const API = import.meta.env.VITE_API_URL || ''
const route = useRoute()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!route.query.token) { error.value = 'Falta el token de recuperacion'; return }
  if (password.value !== confirmPassword.value) { error.value = 'Las contrasenas no coinciden'; return }
  loading.value = true; error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: route.query.token, password: password.value }) })
    if (!res.ok) throw new Error((await res.json()).detail || 'No pudimos actualizar la contrasena')
    router.push({ name: 'admin-login-global' })
  } catch (err) { error.value = err.message } finally { loading.value = false }
}
</script>

<template><AuthSplitLayout><section class="short-form"><h1>Nueva contrasena</h1><p>Elige una contrasena segura de al menos 8 caracteres.</p><form @submit.prevent="submit"><Input v-model="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Nueva contrasena" /><Input v-model="confirmPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="Confirmar contrasena" /><p v-if="error" class="error-msg">{{ error }}</p><Button :disabled="loading">{{ loading ? 'Guardando...' : 'Actualizar contrasena' }}</Button></form></section></AuthSplitLayout></template>

<style scoped>.short-form { text-align: center; }.short-form > p { color: var(--text-muted); margin: 12px 0 24px; }.short-form form { display: flex; flex-direction: column; gap: 16px; }.error-msg { color: var(--danger); }</style>
