<script setup>
import { useTheme } from '../composables/useTheme.js'
import logoPositive from '../assets/logo-color-positivo.svg'
import logoNegative from '../assets/logo-color-negativo.svg'

const { currentMode, toggleMode } = useTheme()
</script>

<template>
  <main class="auth-layout">
    <section class="auth-form-panel">
      <button class="theme-toggle auth-theme-toggle" :aria-label="`Cambiar a tema ${currentMode === 'dark' ? 'claro' : 'oscuro'}`" @click="toggleMode">
        {{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}
      </button>
      <div class="auth-form-content"><slot /></div>
    </section>
    <aside class="auth-brand-panel">
      <img :src="currentMode === 'dark' ? logoPositive : logoNegative" alt="Repitela" class="auth-logo" />
    </aside>
  </main>
</template>

<style scoped>
.auth-layout { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
.auth-form-panel { position: relative; display: flex; align-items: center; justify-content: center; padding: 32px; }
.auth-form-content { width: 100%; max-width: 360px; }
.auth-theme-toggle { position: absolute; top: 16px; right: 16px; }
.auth-brand-panel { display: flex; align-items: center; justify-content: center; padding: 48px; background: linear-gradient(135deg, var(--primary-soft), var(--primary)); }
.auth-logo { width: min(100%, 360px); }
@media (max-width: 767px) { .auth-layout { display: block; } .auth-brand-panel { display: none; } .auth-form-panel { min-height: 100vh; } }
</style>
