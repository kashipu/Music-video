<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import FormError from '../components/ui/FormError.vue'

const API = import.meta.env.VITE_API_URL || ''
const email = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'No pudimos enviar las instrucciones')
    message.value = data.message
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout>
    <section class="short-form">
      <h1>Recupera tu contrasena</h1>
      <p>Te enviaremos instrucciones para restablecerla.</p>
      <form @submit.prevent="submit">
        <Input v-model="email" type="email" required autocomplete="email" placeholder="tu@correo.com" />
        <p v-if="message" class="success-msg">{{ message }}</p>
        <FormError :message="error" />
        <Button :disabled="loading">{{ loading ? 'Enviando...' : 'Enviar instrucciones' }}</Button>
      </form>
      <p class="login-prompt">
        <RouterLink :to="{ name: 'admin-login-global' }" class="login-link">Volver a iniciar sesión</RouterLink>
      </p>
    </section>
  </AuthSplitLayout>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.short-form {
  text-align: center;
}

.short-form > p {
  color: var(--text-muted);
  margin: 12px 0 24px;
}

.short-form form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.success-msg {
  color: var(--success);
}

.login-prompt {
  margin: 20px 0 0 !important;
  font-size: 14px;
}

.login-link {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
}

.login-link:hover {
  text-decoration: underline;
}
</style>
