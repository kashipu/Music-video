<script setup>
import { ref } from 'vue'
import { isMonochromeDarkLogo } from '../utils/logo.js'

const props = defineProps({
  src: { type: String, default: '' },
  // El kiosk va siempre sobre negro, sin importar el tema del bar.
  alwaysDark: { type: Boolean, default: false },
})

const API = import.meta.env.VITE_API_URL || ''
const adaptive = ref(false)

const resolved = () => (props.src?.startsWith('/') ? API + props.src : props.src)

function onLoad(e) {
  adaptive.value = isMonochromeDarkLogo(e.target)
}
</script>

<template>
  <img
    v-if="src"
    :src="resolved()"
    crossorigin="anonymous"
    :class="{ 'logo-adaptive': adaptive, 'logo-on-dark': alwaysDark }"
    @load="onLoad"
  />
</template>
