<script setup>
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import { useTheme } from '../composables/useTheme.js'
import logoPositive from '../assets/logo-color-positivo.svg'
import logoNegative from '../assets/logo-color-negativo.svg'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  error: { type: String, default: '' },
  loading: Boolean,
  usernamePlaceholder: { type: String, default: 'admin' },
  logoUrl: { type: String, default: null },
  showGoogle: { type: Boolean, default: false },
})

defineEmits(['submit', 'google'])
const username = defineModel('username', { default: '' })
const password = defineModel('password', { default: '' })

// Este fondo (--bg del form panel) SI cambia con el tema, a diferencia del
// panel de marca -- por eso el icono sigue el modo claro/oscuro.
const { currentMode } = useTheme()
</script>

<template>
  <header class="login-header">
    <img
      v-if="logoUrl"
      :src="logoUrl"
      :alt="title"
      class="login-icon venue-logo"
    />
    <img
      v-else
      :src="currentMode === 'dark' ? logoNegative : logoPositive"
      alt="Repítela"
      class="login-icon"
    />
    <h1 v-if="title !== 'Repitela' && title !== 'Repítela'">{{ title }}</h1>
    <p>{{ subtitle }}</p>
  </header>
  <form class="login-form" @submit.prevent="$emit('submit')">
    <div class="form-group">
      <label for="username" class="form-label">Usuario</label>
      <Input
        id="username"
        v-model="username"
        name="username"
        type="text"
        :placeholder="usernamePlaceholder"
        autocomplete="username"
      />
    </div>
    <div class="form-group">
      <label for="password" class="form-label">Contraseña</label>
      <Input
        id="password"
        v-model="password"
        name="password"
        type="password"
        placeholder="********"
        autocomplete="current-password"
      />
    </div>
    <p v-if="error" class="error-msg" role="alert" aria-live="polite">{{ error }}</p>
    <Button type="submit" :disabled="loading">{{ loading ? 'Entrando...' : 'ENTRAR' }}</Button>

    <template v-if="showGoogle">
      <div class="auth-divider">
        <span class="auth-divider-text">O continúa con</span>
      </div>

      <Button type="button" variant="secondary" class="btn-google" :disabled="loading" @click="$emit('google')">
        <svg class="google-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        Iniciar sesión con Google
      </Button>
    </template>

    <slot name="footer" />
  </form>
</template>

<style scoped>
.login-header { margin-bottom: 32px; text-align: center; }
.login-icon { width: 140px; height: auto; margin: 0 auto 16px; display: block; }
.venue-logo {
  max-width: 180px;
  max-height: 80px;
  width: auto;
  height: auto;
  object-fit: contain;
}
.login-header h1 { font-size: 24px; font-weight: 700; }
.login-header p { color: var(--text-muted); font-size: 15px; margin-top: 4px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); }
.error-msg { color: var(--danger); font-size: 14px; text-align: center; }

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
  color: var(--text-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.auth-divider-text {
  font-size: 12px;
  font-weight: 500;
}

.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.google-icon {
  flex-shrink: 0;
}
</style>
