<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'

const props = defineProps({
  src: { type: String, default: '' },
  srcLight: { type: String, default: '' },
  srcDark: { type: String, default: '' },
  // El kiosk va siempre sobre negro, sin importar el tema del bar.
  alwaysDark: { type: Boolean, default: false },
})

const API = import.meta.env.VITE_API_URL || ''
const { currentMode } = useTheme()

const source = computed(() => {
  const preferred = props.alwaysDark || currentMode.value === 'dark' ? props.srcDark : props.srcLight
  return preferred || props.srcLight || props.srcDark || props.src
})

const resolved = () => (source.value?.startsWith('/') ? API + source.value : source.value)
</script>

<template>
  <img
    v-if="source"
    :src="resolved()"
  />
</template>
