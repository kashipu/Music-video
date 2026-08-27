<script setup>
defineProps({
  totalCount: {
    type: Number,
    default: 0,
  },
  recurringCount: {
    type: Number,
    default: 0,
  },
  firstTimeCount: {
    type: Number,
    default: 0,
  },
  recurringFilter: {
    type: String,
    default: 'all',
  },
  search: {
    type: String,
    default: '',
  },
})

defineEmits(['update:recurringFilter', 'update:search'])
</script>

<template>
  <div class="users-toolbar">
    <div class="toolbar-left">
      <div class="stats-pills">
        <button
          type="button"
          class="stat-pill"
          :class="{ active: recurringFilter === 'all' }"
          @click="$emit('update:recurringFilter', 'all')"
        >
          <span class="stat-label">Total</span>
          <span class="stat-count">{{ totalCount }}</span>
        </button>
        <button
          type="button"
          class="stat-pill recurring"
          :class="{ active: recurringFilter === 'recurring' }"
          @click="$emit('update:recurringFilter', 'recurring')"
        >
          <span class="stat-label">Recurrentes</span>
          <span class="stat-count">{{ recurringCount }}</span>
        </button>
        <button
          type="button"
          class="stat-pill first-time"
          :class="{ active: recurringFilter === 'first_time' }"
          @click="$emit('update:recurringFilter', 'first_time')"
        >
          <span class="stat-label">Primera vez</span>
          <span class="stat-count">{{ firstTimeCount }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar-right">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          :value="search"
          type="search"
          placeholder="Buscar por nombre o teléfono..."
          class="search-input"
          aria-label="Buscar usuarios"
          @input="$emit('update:search', $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.users-toolbar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.stats-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 9999px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.stat-pill:hover {
  border-color: var(--primary);
  color: var(--text);
}

.stat-pill.active {
  background: var(--bg-elevated);
  border-color: var(--primary);
  color: var(--text);
}

.stat-count {
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 12px;
}

.stat-pill.recurring.active .stat-count {
  background: var(--success-soft);
  color: var(--success);
}

.stat-pill.first-time.active .stat-count {
  background: var(--primary-soft);
  color: var(--primary);
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 14px 10px 36px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: var(--primary);
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .users-toolbar {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .toolbar-right {
    width: 320px;
  }
}
</style>
