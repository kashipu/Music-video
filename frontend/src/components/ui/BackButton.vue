<script setup>
defineProps({
  type: { type: String, default: 'button' },
})
</script>

<template>
  <button class="back-btn" :type="type"><slot /></button>
</template>

<style scoped>
.back-btn {
  padding: 6px 12px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>
