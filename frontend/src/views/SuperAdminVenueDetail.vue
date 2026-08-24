<script setup>
import { onMounted, provide, readonly, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme.js'

const { currentMode, toggleMode } = useTheme()
const route = useRoute()
const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''
const venueId = route.params.venueId
const detail = ref(null)

document.title = 'Repítela - Detalle de Bar'

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` }
}

async function fetchDetail() {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}/stats`, { headers: headers() })
  if (!res.ok) { router.push({ name: 'superadmin' }); return }
  detail.value = await res.json()
}

provide('venueDetail', { detail: readonly(detail), refresh: fetchDetail })
onMounted(fetchDetail)
</script>

<template>
  <div v-if="detail" class="vd">
    <header class="vd-header">
      <div class="vd-header-left">
        <button class="back-btn" aria-label="Volver a bares" @click="router.push({ name: 'superadmin' })">&#8592; Bares</button>
        <img v-if="detail.venue.logo_url" :src="detail.venue.logo_url.startsWith('/') ? API + detail.venue.logo_url : detail.venue.logo_url" class="header-logo" alt="Logo" />
        <h1>{{ detail.venue.name }}</h1>
        <span class="status-badge" :class="detail.venue.active ? 'active' : 'inactive'">
          {{ detail.venue.active ? 'Activo' : 'Inactivo' }}
        </span>
      </div>
      <button
        class="theme-toggle"
        :title="currentMode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        :aria-label="currentMode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        @click="toggleMode"
      >
        {{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}
      </button>
    </header>

    <nav class="vd-tabs" aria-label="Secciones del bar">
      <div class="vd-tabs-inner">
        <RouterLink :to="{ name: 'superadmin-venue', params: { venueId } }">Resumen</RouterLink>
        <RouterLink :to="{ name: 'superadmin-venue-config', params: { venueId } }">Configuración</RouterLink>
        <RouterLink :to="{ name: 'superadmin-venue-users', params: { venueId } }">Usuarios</RouterLink>
      </div>
    </nav>

    <main class="vd-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.vd {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
}

.vd-header {
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vd-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.back-btn {
  padding: 6px 12px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.header-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
}

.vd-header h1 {
  font-size: 18px;
  font-weight: 700;
  text-transform: capitalize;
  margin: 0;
}

.status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 9999px;
}

.status-badge.active {
  background: var(--success-soft);
  color: var(--success);
}

.status-badge.inactive {
  background: var(--danger-soft);
  color: var(--danger);
}

.vd-tabs {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.vd-tabs-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  gap: 8px;
  padding: 8px 16px;
}

.vd-tabs a {
  padding: 8px 16px;
  border-radius: var(--radius-sm, 8px);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.vd-tabs a:hover:not(.router-link-exact-active) {
  color: var(--text);
  background: var(--bg-elevated);
}

.vd-tabs a.router-link-exact-active {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--border-soft);
  font-weight: 700;
}

.vd-main {
  width: 100%;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .vd-header {
    padding: 14px 24px;
  }

  .vd-header h1 {
    font-size: 20px;
  }

  .vd-tabs-inner {
    padding: 8px 24px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .vd-header {
    padding: 10px;
  }

  .vd-header h1 {
    font-size: 16px;
  }

  .vd-tabs-inner {
    padding: 6px 10px;
    gap: 4px;
  }

  .vd-tabs a {
    padding: 6px 10px;
    font-size: 12px;
  }
}
</style>
