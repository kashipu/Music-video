<script setup>
defineProps({
  modelValue: { type: String, default: '' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <input class="input-field" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
</template>
