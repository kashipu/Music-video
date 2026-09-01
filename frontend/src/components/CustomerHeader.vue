<script setup>
import ThemeToggle from './ui/ThemeToggle.vue'

defineProps({
  venueName: {
    type: String,
    required: true,
  },
})

defineEmits(['logout'])
</script>

<template>
  <header class="dash-header">
    <div class="header-left">
      <span class="venue-name">{{ venueName }}</span>
    </div>
    <div class="header-right">
      <ThemeToggle />
      <button class="logout-btn" type="button" @click="$emit('logout')">Salir</button>
    </div>
  </header>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: max(14px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 14px max(16px, env(safe-area-inset-left));
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-soft);
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex-shrink: 1;
}

.venue-name {
  font-weight: 800;
  font-size: 17px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.logout-btn {
  padding: 6px 14px;
  border-radius: 20px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.logout-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
