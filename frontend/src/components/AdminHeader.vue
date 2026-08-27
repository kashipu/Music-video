<script setup>
import ThemeToggle from './ui/ThemeToggle.vue'
import VenueLogo from './VenueLogo.vue'

defineProps({
  venueName: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  logoUrlLight: { type: String, default: '' },
  logoUrlDark: { type: String, default: '' },
})

defineEmits(['toggle-sidebar', 'logout'])
</script>

<template>
  <header class="admin-header">
    <div class="header-brand">
      <button class="menu-btn" @click="$emit('toggle-sidebar')">&#9776;</button>
      <VenueLogo v-if="logoUrl || logoUrlLight || logoUrlDark" :src="logoUrl" :src-light="logoUrlLight" :src-dark="logoUrlDark" class="header-logo" />
      <!-- El logo ya lleva el nombre del bar: repetirlo al lado es redundante -->
      <h1 v-if="!logoUrl && !logoUrlLight && !logoUrlDark">{{ venueName }}</h1>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <ThemeToggle />
      <button class="btn-logout" @click="$emit('logout')">Salir</button>
    </div>
  </header>
</template>

<style scoped>
.admin-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 20px; background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.header-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.header-logo {
  /* width:100% y no auto: un SVG con solo viewBox no tiene tamano intrinseco,
     y como item flex colapsa a 0. El max-width lo acota y contain no deforma. */
  width: 100%; max-width: 120px; max-height: 36px; height: auto; object-fit: contain;
}
.admin-header h1 { font-size: 18px; text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menu-btn {
  display: none; width: 40px; height: 40px; border-radius: 8px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text); font-size: 20px; flex-shrink: 0;
  align-items: center; justify-content: center;
}
.btn-logout {
  padding: 6px 14px; border-radius: 6px;
  background: var(--danger); color: white;
  font-size: 13px; font-weight: 600; opacity: 0.8;
}
.btn-logout:hover { opacity: 1; }

@media (max-width: 900px) {
  .menu-btn { display: flex; }
  .admin-header { padding: 10px 12px; }
  .admin-header h1 { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .header-brand { min-width: 0; flex: 1; }
}
</style>
