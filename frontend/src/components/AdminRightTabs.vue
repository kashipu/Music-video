<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'music',
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

function selectTab(tab) {
  emit('update:modelValue', tab)
  emit('change', tab)
}
</script>

<template>
  <div class="right-tabs">
    <button
      class="rt"
      :class="{ active: modelValue === 'music' }"
      @click="selectTab('music')"
    >
      Música
    </button>
    <button
      class="rt"
      :class="{ active: modelValue === 'tables' }"
      @click="selectTab('tables')"
    >
      Mesas
    </button>
    <button
      class="rt"
      :class="{ active: modelValue === 'analytics' }"
      @click="selectTab('analytics')"
    >
      Analytics
    </button>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.right-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-card);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.rt {
  flex: 1;
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  transition: all 0.15s;
  border: none;
  cursor: pointer;
}

.rt.active {
  background: var(--primary);
  color: white;
}
</style>
