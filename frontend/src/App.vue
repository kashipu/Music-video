<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme.js'

// Initialize theme on app load
const { currentMode } = useTheme()
</script>

<template>
  <RouterView />
</template>
