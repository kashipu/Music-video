<script setup>
defineProps({
  variant: { type: String, default: 'primary' },
})
</script>

<template>
  <button class="btn" :class="`btn-${variant}`"><slot /></button>
</template>
