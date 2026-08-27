<script setup>
import { useId } from 'vue'
import FormError from './FormError.vue'

defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: Boolean,
})

const id = useId()
</script>

<template>
  <div class="form-field">
    <label class="form-label" :for="id">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <slot :id="id" :required="required" />
    <small v-if="hint" class="form-hint">{{ hint }}</small>
    <FormError :message="error" />
  </div>
</template>

<style scoped>
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-label { color: var(--text-muted); font-size: 13px; font-weight: 600; }
.form-hint { color: var(--text-muted); font-size: 12px; line-height: 1.35; }
</style>
