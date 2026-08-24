<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import { useAuthStore } from '../stores/auth.js'

const API = import.meta.env.VITE_API_URL || ''
const router = useRouter()
const auth = useAuthStore()
const fullName = ref('')
const phone = ref('')
const role = ref('owner')
const venueName = ref(auth.adminInfo?.venue_name || '')
const venueAddress = ref('')
const venueType = ref('discoteca')
const venueTypeOther = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await fetch(`${API}/api/admin/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.adminHeaders() },
      body: JSON.stringify({ full_name: fullName.value, phone: phone.value, role: role.value, venue_name: venueName.value, venue_address: venueAddress.value, venue_type: venueType.value, venue_type_other: venueTypeOther.value || null }),
    })
    if (!res.ok) throw new Error((await res.json()).detail || 'No pudimos guardar tus datos')
    auth.adminInfo = { ...auth.adminInfo, venue_name: venueName.value, onboarding_completed_at: new Date().toISOString() }
    localStorage.setItem('bq_admin', JSON.stringify(auth.adminInfo))
    router.push({ name: 'admin', params: { venueSlug: auth.adminInfo.venue_slug } })
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout>
    <header class="onboarding-header"><h1>Cuéntanos sobre tu bar</h1><p>Solo necesitamos estos datos para dejar tu cuenta lista.</p></header>
    <form class="onboarding-form" @submit.prevent="submit">
      <label>Nombre completo<Input v-model="fullName" required autocomplete="name" /></label>
      <label>Teléfono<Input v-model="phone" required type="tel" autocomplete="tel" /></label>
      <label>Cargo<select v-model="role" class="input-field"><option value="owner">Dueño</option><option value="manager">Administrador</option></select></label>
      <label>Nombre del bar<Input v-model="venueName" required autocomplete="organization" /></label>
      <label>Dirección del local<Input v-model="venueAddress" required autocomplete="street-address" /></label>
      <label>Temática<select v-model="venueType" class="input-field"><option value="discoteca">Discoteca</option><option value="rock">Rock</option><option value="musica_popular">Música popular</option><option value="otro">Otro</option></select></label>
      <label v-if="venueType === 'otro'">¿Cuál?<Input v-model="venueTypeOther" required /></label>
      <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
      <Button type="submit" :disabled="loading">{{ loading ? 'Guardando...' : 'Ir al panel' }}</Button>
    </form>
  </AuthSplitLayout>
</template>

<style scoped>
.onboarding-header { margin-bottom: 24px; text-align: center; }.onboarding-header p, label { color: var(--text-muted); }.onboarding-form, label { display: flex; flex-direction: column; gap: 6px; }.onboarding-form { gap: 16px; }.error-msg { color: var(--danger); text-align: center; }
</style>
