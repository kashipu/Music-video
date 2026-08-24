<script setup>
import { RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import ConfirmModal from './components/ui/ConfirmModal.vue'
import ToastContainer from './components/ToastContainer.vue'

const { currentMode } = useTheme()
</script>

<template>
  <RouterView />
  <ToastContainer />
  <ConfirmModal />
</template>

