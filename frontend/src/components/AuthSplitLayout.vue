<script setup>
import { useTheme } from '../composables/useTheme.js'
import logoNegative from '../assets/logo-color-negativo.svg'

// coverImageUrl: foto de venue configurable desde superadmin (a futuro). Cuando
// no hay foto, se usa el fondo negro + logo por defecto. El fondo/la foto NO
// deben depender del modo claro/oscuro -- por eso el panel usa --kiosk-bg
// (ya es #000 en ambos temas en style.css) y la imagen no lleva filtro de tema.
defineProps({
  coverImageUrl: { type: String, default: null },
})

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
      <img v-if="coverImageUrl" :src="coverImageUrl" alt="" class="auth-cover-image" />
      <img v-else :src="logoNegative" alt="Repitela" class="auth-logo" />
    </aside>
  </main>
</template>

<style scoped>
.auth-layout { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
.auth-form-panel { position: relative; display: flex; align-items: center; justify-content: center; padding: 32px; }
.auth-form-content { width: 100%; max-width: 360px; }
.auth-theme-toggle { position: absolute; top: max(16px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right)); }
.auth-brand-panel { display: flex; align-items: center; justify-content: center; padding: 48px; background: var(--kiosk-bg); overflow: hidden; }
.auth-logo { width: min(100%, 360px); }
.auth-cover-image { width: 100%; height: 100%; object-fit: cover; }
@media (max-width: 767px) { .auth-layout { display: block; } .auth-brand-panel { display: none; } .auth-form-panel { min-height: 100vh; } }
</style>
