<script setup>
defineProps({
  message: { type: String, default: '' },
})
</script>

<template>
  <p v-if="message" class="error-msg" role="alert">{{ message }}</p>
</template>

<style scoped>
.error-msg { color: var(--danger); font-size: 14px; text-align: center; }
</style>
