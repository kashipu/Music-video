<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import VenueLimitsForm from '../components/VenueLimitsForm.vue'
import UiButton from '../components/ui/Button.vue'
import UiInput from '../components/ui/Input.vue'

document.title = 'Repítela - Crear Bar'

const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''
const loading = ref(false)
const createError = ref('')
const newVenue = ref({
  name: '',
  slug: '',
  admin_username: '',
  admin_password: '',
  admin_email: '',
  admin_phone: '',
  admin_address: '',
  admin_city: '',
  logo_url: '',
  qr_url: '',
  max_duration_sec: 600,
  max_songs_per_window: 3,
  window_minutes: 20,
  trial_days: 15,
})

function headers() {
  return {
    Authorization: `Bearer ${localStorage.getItem('bq_super_token')}`,
  }
}

function autoSlug() {
  newVenue.value.slug = (newVenue.value.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function createVenue() {
  createError.value = ''
  const name = newVenue.value.name.trim()
  const slug = newVenue.value.slug.trim()
  const adminUsername = newVenue.value.admin_username.trim()
  const adminPassword = newVenue.value.admin_password
  const adminEmail = newVenue.value.admin_email.trim()
  const adminPhone = newVenue.value.admin_phone.trim()
  const adminAddress = newVenue.value.admin_address.trim()
  const adminCity = newVenue.value.admin_city.trim()

  if (!name || !slug || !adminUsername || !adminPassword || !adminEmail || !adminPhone || !adminAddress || !adminCity) {
    createError.value = 'Todos los campos obligatorios son requeridos'
    return
  }

  loading.value = true
  try {
    const payload = {
      name,
      slug,
      admin_username: adminUsername,
      admin_password: adminPassword,
      admin_email: adminEmail,
      admin_phone: adminPhone,
      admin_address: adminAddress,
      admin_city: adminCity,
      logo_url: newVenue.value.logo_url?.trim() || null,
      qr_url: newVenue.value.qr_url?.trim() || null,
      max_duration_sec: Number(newVenue.value.max_duration_sec) || 600,
      max_songs_per_window: Number(newVenue.value.max_songs_per_window) || 3,
      window_minutes: Number(newVenue.value.window_minutes) || 20,
      trial_days: Number(newVenue.value.trial_days) || 15,
    }

    const res = await fetch(`${API}/api/superadmin/venues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.detail || 'Error creando bar')
    }
    if (data?.venue?.id) {
      router.push({ name: 'superadmin-venue', params: { venueId: data.venue.id } })
    } else {
      router.push({ name: 'superadmin' })
    }
  } catch (e) {
    createError.value = e.message || 'Error al crear el bar'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="create-page">
    <header class="create-header">
      <RouterLink class="back-link" :to="{ name: 'superadmin' }" aria-label="Volver al panel principal">← Volver</RouterLink>
      <h1>Crear bar</h1>
    </header>

    <main class="create-main">
      <form @submit.prevent="createVenue" class="create-form">
        <section class="card form-section">
          <h2>Datos del bar</h2>
          <p class="section-help">Todos los campos son obligatorios.</p>
          <div class="form-grid">
            <div class="form-group">
              <label for="venue-name">Nombre del bar</label>
              <UiInput id="venue-name" v-model="newVenue.name" placeholder="Bar La Esquina" required @input="autoSlug" />
            </div>
            <div class="form-group">
              <label for="venue-slug">Identificador de la URL</label>
              <UiInput id="venue-slug" v-model="newVenue.slug" placeholder="bar-la-esquina" required />
            </div>
            <div class="form-group">
              <label for="venue-admin-user">Usuario administrador</label>
              <UiInput id="venue-admin-user" v-model="newVenue.admin_username" placeholder="admin_bar" required />
            </div>
            <div class="form-group">
              <label for="venue-admin-pass">Contraseña del administrador</label>
              <UiInput id="venue-admin-pass" v-model="newVenue.admin_password" type="password" placeholder="********" required />
            </div>
            <div class="form-group">
              <label for="venue-admin-email">Correo del admin</label>
              <UiInput id="venue-admin-email" v-model="newVenue.admin_email" type="email" placeholder="admin@bar.com" required />
            </div>
            <div class="form-group">
              <label for="venue-admin-phone">Teléfono</label>
              <UiInput id="venue-admin-phone" v-model="newVenue.admin_phone" type="tel" placeholder="+57 300 123 4567" required />
            </div>
            <div class="form-group">
              <label for="venue-admin-address">Dirección</label>
              <UiInput id="venue-admin-address" v-model="newVenue.admin_address" placeholder="Calle 10 # 20-30" required />
            </div>
            <div class="form-group">
              <label for="venue-admin-city">Ciudad</label>
              <UiInput id="venue-admin-city" v-model="newVenue.admin_city" placeholder="Bogotá" required />
            </div>
          </div>
        </section>

        <section class="card form-section">
          <h2>Tiempo de prueba</h2>
          <p class="section-help">Periodo de prueba asignado al bar antes de requerir pago.</p>
          <div class="trial-options" role="radiogroup" aria-label="Tiempo de prueba">
            <button
              v-for="opt in [7, 15, 30]"
              :key="opt"
              type="button"
              class="trial-pill"
              :class="{ selected: newVenue.trial_days === opt }"
              role="radio"
              :aria-checked="newVenue.trial_days === opt"
              @click="newVenue.trial_days = opt"
            >
              {{ opt }} días
            </button>
          </div>
        </section>

        <section class="card form-section">
          <h2>Datos de onboarding</h2>
          <p class="section-help">Opcionales. Puedes ajustarlos después desde el detalle del bar.</p>
          <div class="form-grid">
            <div class="form-group">
              <label for="venue-logo-url">Imagen del bar (URL, opcional)</label>
              <UiInput id="venue-logo-url" v-model="newVenue.logo_url" placeholder="https://ejemplo.com/logo.png" />
            </div>
            <div class="form-group">
              <label for="venue-qr-url">URL del QR (opcional)</label>
              <UiInput id="venue-qr-url" v-model="newVenue.qr_url" placeholder="Se puede agregar después" />
            </div>
          </div>
          <VenueLimitsForm
            v-model:max-duration-sec="newVenue.max_duration_sec"
            v-model:max-songs="newVenue.max_songs_per_window"
            v-model:window-minutes="newVenue.window_minutes"
            class="limits-form"
          />
        </section>

        <p v-if="createError" class="error-msg" role="alert">{{ createError }}</p>
        <UiButton type="submit" :disabled="loading">{{ loading ? 'Creando...' : 'Crear bar' }}</UiButton>
      </form>
    </main>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.create-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
}

.create-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
}

.create-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.back-link {
  padding: 7px 12px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius, 8px);
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
  font-size: 13px;
  transition: opacity 0.15s;
}

.back-link:hover {
  opacity: 0.85;
}

.create-main {
  max-width: 900px;
  margin: auto;
  padding: 20px 12px;
}

.form-section {
  padding: 20px;
  margin-bottom: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius, 12px);
}

.form-section h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.section-help {
  margin: 6px 0 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.limits-form { margin-top: 12px; }

.trial-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.trial-pill {
  padding: 8px 18px;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.trial-pill:hover {
  border-color: var(--primary);
}

.trial-pill.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.trial-pill:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.error-msg {
  margin: 0 0 12px;
  color: var(--danger);
  font-size: 13px;
  background: var(--danger-soft);
  padding: 8px 12px;
  border-radius: var(--radius-sm, 8px);
  border: 1px solid var(--danger);
}

/* =========================================
   BREAKPOINT 640px
   ========================================= */
@media (min-width: 640px) {
  .create-header {
    padding: 16px 24px;
  }

  .create-main {
    padding: 24px;
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .create-header {
    padding: 10px 12px;
    gap: 10px;
  }

  .create-main {
    padding: 14px 10px;
  }

  .form-section {
    padding: 14px;
  }

  .trial-pill {
    flex: 1;
    text-align: center;
    padding: 8px 12px;
  }
}
</style>
