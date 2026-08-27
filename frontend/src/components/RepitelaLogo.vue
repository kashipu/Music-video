<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import logoLight from '../assets/logo-color-positivo.svg'
import logoDark from '../assets/logo-color-negativo.svg'

const props = defineProps({
  alwaysDark: { type: Boolean, default: false },
  alt: { type: String, default: 'Repítela' },
})

const { currentMode } = useTheme()
const src = computed(() => (props.alwaysDark || currentMode.value === 'dark' ? logoDark : logoLight))
</script>

<template>
  <img :src="src" :alt="alt" />
</template>
