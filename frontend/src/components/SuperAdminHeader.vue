<script setup>
import ThemeToggle from './ui/ThemeToggle.vue'
import UiButton from './ui/Button.vue'
import RepitelaLogo from './RepitelaLogo.vue'

defineProps({
  badge: { type: String, default: '' },
})

defineEmits(['logout'])
</script>

<template>
  <header class="sa-header">
    <div class="sa-brand"><RepitelaLogo class="sa-logo" /><span class="sa-badge">{{ badge }}</span></div>
    <div class="header-actions">
      <RouterLink class="btn-admins" :to="{ name: 'superadmin-sales' }">Ventas</RouterLink>
      <RouterLink class="btn-admins" :to="{ name: 'superadmin-admins' }">Usuarios</RouterLink>
      <ThemeToggle />
      <UiButton variant="danger" class="btn-logout" @click="$emit('logout')">Salir</UiButton>
    </div>
  </header>
</template>

<style scoped>
.sa-header { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-card); border-bottom:1px solid var(--border); }.sa-brand { display:flex; align-items:center; gap:10px; }.sa-logo { width:120px; height:auto; }.sa-badge { padding:2px 10px; border:1px solid var(--warning); border-radius:999px; background:var(--warning-soft); color:var(--warning); font-size:11px; font-weight:700; }.header-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }.btn-logout { width:auto; padding:6px 14px; font-size:13px; }.btn-admins { padding:6px 14px; border-radius:var(--radius-sm); background:var(--bg-elevated); border:1px solid var(--border); color:var(--text); font-size:13px; font-weight:600; text-decoration:none; }

@media (min-width:640px) { .sa-header { padding:12px 24px; } }
</style>
