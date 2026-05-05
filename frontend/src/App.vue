<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import ToastContainer from './components/ToastContainer.vue'

const { currentMode } = useTheme()
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
