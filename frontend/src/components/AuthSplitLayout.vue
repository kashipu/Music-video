<script setup>
import { useTheme } from '../composables/useTheme.js'

defineProps({
  wide: { type: Boolean, default: false },
})

const { currentMode, toggleMode } = useTheme()
</script>

<template>
  <main class="auth-layout">
    <button
      class="theme-toggle auth-theme-toggle"
      :aria-label="`Cambiar a tema ${currentMode === 'dark' ? 'claro' : 'oscuro'}`"
      @click="toggleMode"
    >
      {{ currentMode === 'dark' ? '☀' : '☾' }}
    </button>
    <div class="auth-card card" :class="{ 'auth-card--wide': wide }">
      <slot />
    </div>
  </main>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.auth-layout {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  position: relative;
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 80% 50% at 50% 85%, var(--warning-soft) 0%, var(--primary-soft) 55%, transparent 75%),
    radial-gradient(circle at 50% 95%, var(--primary-soft) 0%, transparent 60%);
  background-repeat: no-repeat;
  background-attachment: fixed;
  transition: background-color 0.3s ease;
}

.auth-theme-toggle {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  z-index: 10;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 36px 32px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px var(--shadow), 0 0 0 1px var(--border-soft);
  position: relative;
  z-index: 1;
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.auth-card.auth-card--wide {
  max-width: 760px;
}

/* =========================================
   BREAKPOINT 480px (Mobile)
   ========================================= */
@media (max-width: 480px) {
  .auth-layout {
    padding: 24px 12px;
  }
  .auth-card {
    padding: 28px 20px;
    border-radius: var(--radius);
  }
}
</style>
