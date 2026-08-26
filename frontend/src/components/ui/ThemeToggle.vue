<script setup>
import { useTheme } from '../../composables/useTheme.js'

const { currentMode, toggleMode } = useTheme()
</script>

<template>
  <button
    class="theme-toggle"
    :aria-label="`Cambiar a tema ${currentMode === 'dark' ? 'claro' : 'oscuro'}`"
    @click="toggleMode"
  >
    {{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}
  </button>
</template>
