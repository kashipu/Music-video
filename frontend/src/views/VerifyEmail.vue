<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'

const API = import.meta.env.VITE_API_URL || ''
const route = useRoute()
const loading = ref(false)
const message = ref('')
const error = ref('')

async function verify() {
  if (!route.query.token) { error.value = 'Falta el token de verificacion'; return }
  loading.value = true; error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: route.query.token }) })
    if (!res.ok) throw new Error((await res.json()).detail || 'No pudimos verificar el correo')
    message.value = 'Correo verificado. Ya puedes iniciar sesion.'
  } catch (err) { error.value = err.message } finally { loading.value = false }
}
</script>

<template><AuthSplitLayout><section class="short-form"><h1>Verifica tu correo</h1><p>Confirma tu cuenta para continuar.</p><p v-if="message" class="success-msg">{{ message }}</p><p v-if="error" class="error-msg">{{ error }}</p><Button :disabled="loading || !!message" @click="verify">{{ loading ? 'Verificando...' : 'Verificar correo' }}</Button><p class="login-prompt"><RouterLink :to="{ name: 'admin-login-global' }" class="login-link">Ir a iniciar sesión</RouterLink></p></section></AuthSplitLayout></template>

<style scoped>.short-form { text-align: center; }.short-form p { color: var(--text-muted); margin: 12px 0 24px; }.error-msg { color: var(--danger) !important; }.success-msg { color: var(--success) !important; }.login-prompt { margin: 20px 0 0 !important; font-size: 14px; }.login-link { color: var(--primary); font-weight: 600; text-decoration: none; }.login-link:hover { text-decoration: underline; }</style>
