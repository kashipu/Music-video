<script setup>
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  error: { type: String, default: '' },
  loading: Boolean,
  usernamePlaceholder: { type: String, default: 'admin' },
})

defineEmits(['submit'])
const username = defineModel('username', { default: '' })
const password = defineModel('password', { default: '' })
</script>

<template>
  <header class="login-header"><h1>{{ title }}</h1><p>{{ subtitle }}</p></header>
  <form class="login-form" @submit.prevent="$emit('submit')">
    <label class="form-group">Usuario<Input v-model="username" type="text" :placeholder="usernamePlaceholder" autocomplete="username" /></label>
    <label class="form-group">Contrasena<Input v-model="password" type="password" placeholder="********" autocomplete="current-password" /></label>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <Button type="submit" :disabled="loading">{{ loading ? 'Entrando...' : 'ENTRAR' }}</Button>
  </form>
</template>

<style scoped>
.login-header { margin-bottom: 32px; text-align: center; }
.login-header h1 { font-size: 24px; }
.login-header p { color: var(--text-muted); font-size: 15px; }
.login-form, .form-group { display: flex; flex-direction: column; }
.login-form { gap: 16px; }
.form-group { gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.error-msg { color: var(--danger); font-size: 14px; text-align: center; }
</style>
