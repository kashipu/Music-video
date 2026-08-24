<script setup>
defineProps({
  variant: { type: String, default: 'neutral' },
})
</script>

<template>
  <span class="badge" :class="`badge-${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  line-height: 1.4;
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.badge-neutral {
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.badge-success {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid var(--border-soft);
}

.badge-warning {
  background: var(--warning-soft);
  color: var(--warning);
  border: 1px solid var(--border-soft);
}

.badge-danger {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--border-soft);
}

.badge-info {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--border-soft);
}
</style>
