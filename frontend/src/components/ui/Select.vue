<script setup>
const model = defineModel({ default: '' })
</script>

<template>
  <select v-model="model" class="input-field select-field"><slot /></select>
</template>

<style scoped>
.select-field {
  cursor: pointer;
  appearance: auto;
}

.select-field option {
  background: var(--bg-card);
  color: var(--text);
}
</style>
