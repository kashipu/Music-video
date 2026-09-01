<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="card">
    <slot name="title">
      <p v-if="title" class="section-title">{{ title }}</p>
    </slot>
    <slot />
  </div>
</template>
