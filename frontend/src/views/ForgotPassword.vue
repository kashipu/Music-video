<script setup>
import { ref } from 'vue'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'

const API = import.meta.env.VITE_API_URL || ''
const email = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')

async function submit() {
  loading.value = true; error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value }) })
    if (!res.ok) throw new Error((await res.json()).detail || 'No pudimos enviar las instrucciones')
    message.value = (await res.json()).message
  } catch (err) { error.value = err.message } finally { loading.value = false }
}
</script>

<template><AuthSplitLayout><section class="short-form"><h1>Recupera tu contrasena</h1><p>Te enviaremos instrucciones para restablecerla.</p><form @submit.prevent="submit"><Input v-model="email" type="email" required autocomplete="email" placeholder="tu@correo.com" /><p v-if="message" class="success-msg">{{ message }}</p><p v-if="error" class="error-msg">{{ error }}</p><Button :disabled="loading">{{ loading ? 'Enviando...' : 'Enviar instrucciones' }}</Button></form></section></AuthSplitLayout></template>

<style scoped>.short-form { text-align: center; }.short-form > p { color: var(--text-muted); margin: 12px 0 24px; }.short-form form { display: flex; flex-direction: column; gap: 16px; }.error-msg { color: var(--danger); }.success-msg { color: var(--success); }</style>
