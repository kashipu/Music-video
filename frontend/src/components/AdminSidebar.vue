<script setup>
import VenueLogo from './VenueLogo.vue'
import RepitelaLogo from './RepitelaLogo.vue'

defineProps({
  venueName: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  logoUrlLight: { type: String, default: '' },
  logoUrlDark: { type: String, default: '' },
  activeUsers: { type: Number, default: 0 },
  queuedCount: { type: Number, default: 0 },
  venueSlug: { type: String, required: true },
  open: { type: Boolean, default: false },
})

defineEmits(['close'])
</script>

<template>
  <aside class="sidebar" :class="{ open }">
    <button class="sidebar-close" @click="$emit('close')">&#10005;</button>

    <!-- Bar Info Card -->
    <div class="card sidebar-info">
      <VenueLogo v-if="logoUrl || logoUrlLight || logoUrlDark" :src="logoUrl" :src-light="logoUrlLight" :src-dark="logoUrlDark" class="sidebar-logo" />
      <RepitelaLogo v-else class="sidebar-logo" />
      <h2 class="bar-name">{{ venueName }}</h2>
      <div class="info-stats">
        <div class="info-stat">
          <span class="info-val">{{ activeUsers }}</span>
          <span class="info-label">Usuarios activos</span>
        </div>
        <div class="info-stat">
          <span class="info-val">{{ queuedCount }}</span>
          <span class="info-label">En cola</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <p class="section-title">ABRIR VISTAS</p>
      <div class="quick-actions">
        <a :href="`/${venueSlug}/registro`" target="_blank" class="action-btn action-registro">
          <span>&#128221;</span> Registro (QR)
        </a>
        <a :href="`/${venueSlug}/video`" target="_blank" class="action-btn action-video">
          <span>&#127909;</span> Pantalla Video
        </a>
        <a :href="`/${venueSlug}/usuario`" target="_blank" class="action-btn action-usuario">
          <span>&#128241;</span> Vista Usuario
        </a>
        <RouterLink :to="{ name: 'admin-subscription', params: { venueSlug } }" class="action-btn action-subscription">
          <span>&#128179;</span> Mi suscripción
        </RouterLink>
      </div>
    </div>

    <slot />
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex; flex-direction: column; gap: 14px;
  position: -webkit-sticky; position: sticky; top: 16px; align-self: start;
  max-height: calc(100vh - 80px); overflow-y: auto;
  min-width: 0;
}
.sidebar-close {
  display: none; position: absolute; top: 12px; right: 12px;
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text-muted); font-size: 18px;
  align-items: center; justify-content: center; z-index: 1;
}
.sidebar-info { text-align: center; }
.sidebar-logo { max-width: 160px; max-height: 80px; width: auto; height: auto; object-fit: contain; margin: 0 auto 8px; }
.bar-name { font-size: 22px; margin-bottom: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info-stats { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.info-stat { text-align: center; min-width: 0; }
.info-val { font-size: 28px; font-weight: 700; display: block; }
.info-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

/* Quick Actions */
.quick-actions { display: flex; flex-direction: column; gap: 6px; }
.action-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text); font-weight: 600; font-size: 13px;
  text-decoration: none; transition: all 0.15s;
}
.action-btn:hover { border-color: var(--primary); color: var(--primary); }
.action-registro:hover { border-color: var(--success); color: var(--success); }
.action-video:hover { border-color: var(--warning); color: var(--warning); }
.action-usuario:hover { border-color: var(--secondary); color: var(--secondary); }
.action-subscription:hover { border-color: var(--primary); color: var(--primary); }

@media (max-width: 900px) {
  .sidebar-close { display: flex; }
  .sidebar {
    display: none; position: fixed; top: 0; left: 0; bottom: 0;
    width: 320px; max-width: 85vw; z-index: 100;
    background: var(--bg); padding: 16px; padding-top: 56px; padding-bottom: 200px;
    overflow-y: auto; max-height: 100vh;
    box-shadow: 4px 0 20px rgba(0,0,0,0.3);
  }
  .sidebar.open { display: flex; }
  .info-stats { gap: 12px; }
  .info-val { font-size: 22px; }
  .quick-actions { gap: 4px; }
  .action-btn { padding: 8px 12px; font-size: 12px; }
}
</style>
