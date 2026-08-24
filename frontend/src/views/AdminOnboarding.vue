<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AuthSplitLayout from '../components/AuthSplitLayout.vue'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import { useAuthStore } from '../stores/auth.js'
import { LATAM_COUNTRIES } from '../data/countries.js'

document.title = 'Repítela - Completa tu cuenta'

const API = import.meta.env.VITE_API_URL || ''
const router = useRouter()
const auth = useAuthStore()

const fullName = ref('')
const phone = ref(auth.adminInfo?.phone || '')
const role = ref('owner')
const venueName = ref(auth.adminInfo?.venue_name || '')
const venueAddress = ref(auth.adminInfo?.venue_address || '')
const venueType = ref('discoteca')
const venueTypeOther = ref('')
const loading = ref(false)
const error = ref('')

const country = ref(auth.adminInfo?.country || 'Colombia')
const customCountry = ref(!LATAM_COUNTRIES.some(c => c.name === country.value))

const availableCities = computed(() => {
  const selected = LATAM_COUNTRIES.find(c => c.name === country.value)
  return selected ? selected.cities : []
})

const city = ref(auth.adminInfo?.city || availableCities.value[0] || 'Medellín')
// Si en el signup eligieron "Otro", el valor no esta en la lista: campo libre.
const customCity = ref(!availableCities.value.includes(city.value))

watch(country, (newCountry) => {
  const selected = LATAM_COUNTRIES.find(c => c.name === newCountry)
  if (!selected) return
  customCountry.value = false
  customCity.value = false
  city.value = selected.cities[0] || ''
})

watch(city, (newCity) => {
  if (customCity.value && availableCities.value.includes(newCity)) customCity.value = false
})

function selectCountry(value) {
  if (value === '__other__') {
    customCountry.value = true
    customCity.value = true
    country.value = ''
    city.value = ''
  } else {
    country.value = value
  }
}

function selectCity(value) {
  if (value === '__other__') {
    customCity.value = true
    city.value = ''
  } else {
    city.value = value
  }
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await fetch(`${API}/api/admin/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.adminHeaders() },
      body: JSON.stringify({
        full_name: fullName.value,
        phone: phone.value,
        role: role.value,
        city: city.value,
        country: country.value,
        venue_name: venueName.value,
        venue_address: venueAddress.value,
        venue_type: venueType.value,
        venue_type_other: venueTypeOther.value || null,
      }),
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
  <AuthSplitLayout :wide="true">
    <header class="onboarding-header">
      <h1>Cuéntanos sobre tu bar</h1>
      <p>Solo necesitamos estos datos para dejar tu cuenta lista.</p>
    </header>
    <form class="onboarding-form" @submit.prevent="submit">
      <div class="form-grid">
        <label class="form-group">
          <span>Nombre completo</span>
          <Input v-model="fullName" required autocomplete="name" />
        </label>
        <label class="form-group">
          <span>Teléfono</span>
          <Input v-model="phone" type="tel" required autocomplete="tel" placeholder="Ej: +57 300 123 4567" />
        </label>
        <label class="form-group">
          <span>Cargo</span>
          <select v-model="role" class="input-field select-field" required>
            <option value="owner">Dueño</option>
            <option value="manager">Administrador</option>
          </select>
        </label>
        <label class="form-group">
          <span>Nombre del bar</span>
          <Input v-model="venueName" required autocomplete="organization" />
        </label>
        <label class="form-group">
          <span>Dirección del local</span>
          <Input v-model="venueAddress" required autocomplete="street-address" placeholder="Ej: Calle 10 # 40-20" />
        </label>
        <label class="form-group">
          <span>Temática</span>
          <select v-model="venueType" class="input-field select-field" required>
            <option value="discoteca">Discoteca</option>
            <option value="rock">Rock</option>
            <option value="musica_popular">Música popular</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label v-if="venueType === 'otro'" class="form-group">
          <span>¿Cuál temática?</span>
          <Input v-model="venueTypeOther" required />
        </label>
        <label v-if="!customCountry" class="form-group">
          <span>País</span>
          <select :value="country" class="input-field select-field" required @change="selectCountry($event.target.value)">
            <option v-for="c in LATAM_COUNTRIES" :key="c.code" :value="c.name">
              {{ c.name }}
            </option>
            <option value="__other__">Otro</option>
          </select>
        </label>
        <label v-else class="form-group">
          <span>País</span>
          <Input v-model="country" list="country-options" required autocomplete="country-name" placeholder="Escribe tu país" />
          <datalist id="country-options">
            <option v-for="c in LATAM_COUNTRIES" :key="c.code" :value="c.name" />
          </datalist>
        </label>
        <label v-if="!customCity" class="form-group">
          <span>Ciudad</span>
          <select :value="city" class="input-field select-field" required @change="selectCity($event.target.value)">
            <option v-for="cityName in availableCities" :key="cityName" :value="cityName">
              {{ cityName }}
            </option>
            <option value="__other__">Otro</option>
          </select>
        </label>
        <label v-else class="form-group">
          <span>Ciudad</span>
          <Input v-model="city" list="city-options" required autocomplete="address-level2" placeholder="Escribe tu ciudad" />
          <datalist id="city-options">
            <option v-for="cityName in availableCities" :key="cityName" :value="cityName" />
          </datalist>
        </label>
      </div>

      <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
      <Button type="submit" :disabled="loading">{{ loading ? 'Guardando...' : 'Ir al panel' }}</Button>
    </form>
  </AuthSplitLayout>
</template>

<style scoped>
.onboarding-header {
  margin-bottom: 24px;
  text-align: center;
}

.onboarding-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.onboarding-header p {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 14px;
}

.onboarding-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
}

.select-field {
  cursor: pointer;
  appearance: auto;
}

.select-field option {
  background: var(--bg-card);
  color: var(--text);
}

.error-msg {
  color: var(--danger);
  text-align: center;
  font-size: 13px;
}

@media (min-width: 700px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
