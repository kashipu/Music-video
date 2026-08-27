<script setup>
defineProps({
  tables: {
    type: Array,
    default: () => [],
  },
  loadingResetLimit: {
    type: Object,
    default: () => ({}),
  },
  loadingKick: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['reset-limit', 'kick-table'])
</script>

<template>
  <div class="card">
    <p class="section-title">MESAS ({{ tables.length }})</p>
    <div v-if="tables.length" class="tables-list">
      <div v-for="table in tables" :key="table.table_number" class="table-item">
        <div class="table-top">
          <span class="table-num">#{{ table.table_number }}</span>
          <span class="table-user">{{ table.user_name }}</span>
          <span class="table-count">{{ table.songs ? table.songs.length : 0 }}</span>
        </div>
        <div class="table-status-row" v-if="table.songs && table.songs.length">
          <span v-if="table.songs_playing" class="ts-badge ts-playing">{{ table.songs_playing }} sonando</span>
          <span v-if="table.songs_pending" class="ts-badge ts-pending">{{ table.songs_pending }} en cola</span>
          <span v-if="table.songs_played" class="ts-badge ts-played">{{ table.songs_played }} reproducidas</span>
        </div>
        <div class="table-btns">
          <button
            class="t-btn t-btn-reset"
            @click="$emit('reset-limit', table.table_number)"
            :disabled="loadingResetLimit[table.table_number]"
          >
            {{ loadingResetLimit[table.table_number] ? '...' : 'Resetear' }}
          </button>
          <button
            class="t-btn t-btn-kick"
            @click="$emit('kick-table', table.table_number)"
            :disabled="loadingKick[table.table_number]"
          >
            {{ loadingKick[table.table_number] ? '...' : 'Expulsar' }}
          </button>
        </div>
      </div>
    </div>
    <p v-else class="text-muted">Sin mesas activas</p>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tables-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.table-item {
  padding: 8px;
  background: var(--bg-elevated);
  border-radius: 8px;
  border: 1px solid var(--border);
  min-width: 0;
}

.table-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
  min-width: 0;
}

.table-num {
  font-weight: 700;
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

.table-user {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.table-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.table-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.ts-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.ts-playing {
  background: var(--success-soft);
  color: var(--success);
}

.ts-pending {
  background: var(--warning-soft);
  color: var(--warning);
}

.ts-played {
  background: var(--border-soft);
  color: var(--text-muted);
}

.table-btns {
  display: flex;
  gap: 4px;
}

.t-btn {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid;
}

.t-btn-reset {
  border-color: var(--secondary);
  color: var(--secondary);
  background: transparent;
}

.t-btn-reset:hover {
  background: var(--secondary);
  color: #000;
}

.t-btn-kick {
  border-color: var(--danger);
  color: var(--danger);
  background: transparent;
}

.t-btn-kick:hover {
  background: var(--danger);
  color: white;
}

.text-muted {
  color: var(--text-muted);
  font-size: 14px;
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .tables-list {
    max-height: none;
  }

  .table-item {
    padding: 6px;
  }

  .table-btns {
    flex-wrap: wrap;
  }
}
</style>
