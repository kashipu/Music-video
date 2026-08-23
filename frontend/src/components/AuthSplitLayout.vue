<script setup>
import { useTheme } from '../composables/useTheme.js'

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
    <div class="auth-card card">
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
    radial-gradient(ellipse 80% 50% at 50% 85%, rgba(255, 167, 51, 0.45) 0%, rgba(255, 85, 34, 0.32) 28%, rgba(184, 52, 26, 0.18) 55%, transparent 75%),
    radial-gradient(circle at 50% 95%, rgba(255, 85, 34, 0.2) 0%, transparent 60%);
  background-repeat: no-repeat;
  background-attachment: fixed;
  transition: background-color 0.3s ease;
}

:global([data-theme="light"]) .auth-layout {
  background-color: #F8F8FC;
  background-image:
    radial-gradient(ellipse 120% 80% at 50% 0%, rgba(253, 246, 216, 0.95) 0%, rgba(253, 246, 216, 0.45) 35%, transparent 70%),
    radial-gradient(ellipse 120% 90% at 90% 100%, rgba(251, 201, 163, 0.6) 0%, rgba(251, 201, 163, 0.22) 45%, transparent 75%),
    radial-gradient(ellipse 100% 70% at 15% 95%, rgba(254, 235, 210, 0.35) 0%, transparent 65%);
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
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-soft);
  position: relative;
  z-index: 1;
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

:global([data-theme="light"]) .auth-card {
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
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
    border-radius: var(--radius, 12px);
  }
}
</style>
