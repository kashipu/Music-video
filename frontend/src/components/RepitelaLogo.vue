<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import logoSobreClaro from '../assets/logo-color-sobre-claro.svg'
import logoSobreOscuro from '../assets/logo-color-sobre-oscuro.svg'

const props = defineProps({
  alwaysDark: { type: Boolean, default: false },
  alt: { type: String, default: 'Repítela' },
})

const { currentMode } = useTheme()
const src = computed(() => (props.alwaysDark || currentMode.value === 'dark' ? logoSobreOscuro : logoSobreClaro))
</script>

<template>
  <img :src="src" :alt="alt" />
</template>
