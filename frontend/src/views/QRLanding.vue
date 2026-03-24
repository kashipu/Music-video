<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const venueSlug = route.params.venueSlug
const tableNumber = ref(route.query.mesa || '')
const phone = ref('')
const displayName = ref('')
const dataConsent = ref(false)
const error = ref('')
const loading = ref(false)

onMounted(() => {
  if (auth.isAuthenticated && auth.session?.venue_slug === venueSlug) {
    router.push({ name: 'usuario', params: { venueSlug } })
  }
})

async function handleRegister() {
  error.value = ''
  if (!phone.value.trim()) {
    error.value = 'Ingresa tu numero de celular'
    return
  }
  if (!tableNumber.value.trim()) {
    error.value = 'Ingresa el numero de mesa'
    return
  }
  if (!dataConsent.value) {
    error.value = 'Debes aceptar el uso de datos para continuar'
    return
  }
  loading.value = true
  try {
    await auth.register(phone.value, tableNumber.value, venueSlug, dataConsent.value, displayName.value)
    router.push({ name: 'usuario', params: { venueSlug } })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="landing">
    <div class="container">
      <div class="landing-header">
        <div class="music-icon">&#9835;</div>
        <h1>BarQueue</h1>
        <p class="subtitle">Elige la musica que suena!</p>
      </div>

      <form class="register-form" @submit.prevent="handleRegister">
        <div class="form-group">
          <label>Tu numero de celular</label>
          <input
            v-model="phone"
            type="tel"
            class="input-field"
            placeholder="+57 300 123 4567"
            inputmode="tel"
          />
        </div>

        <div class="form-group">
          <label>Numero de mesa</label>
          <input
            v-model="tableNumber"
            type="text"
            class="input-field"
            placeholder="Mesa"
          />
        </div>

        <div class="form-group">
          <label>Tu nombre (opcional)</label>
          <input
            v-model="displayName"
            type="text"
            class="input-field"
            placeholder="Como te llamas?"
          />
        </div>

        <label class="consent-label">
          <input v-model="dataConsent" type="checkbox" />
          <span>Acepto el uso de mis datos para mejorar la experiencia musical del bar.</span>
        </label>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Entrando...' : 'ENTRAR' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}
.landing-header {
  text-align: center;
  margin-bottom: 32px;
}
.music-icon {
  font-size: 48px;
  margin-bottom: 8px;
}
.landing-header h1 {
  font-size: 24px;
  text-transform: capitalize;
  margin-bottom: 4px;
}
.subtitle {
  color: var(--text-muted);
  font-size: 15px;
}
.register-form {
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
.consent-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
}
.consent-label input {
  margin-top: 2px;
  accent-color: var(--primary);
}
.error-msg {
  color: var(--danger);
  font-size: 14px;
  text-align: center;
}
</style>
