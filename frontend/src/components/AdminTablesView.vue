<script setup>
defineProps({
  tables: {
    type: Array,
    default: () => [],
  },
  selectedTable: {
    type: Object,
    default: null,
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

defineEmits(['select-table', 'back', 'reset-limit', 'kick-table'])
</script>

<template>
  <div class="tables-view">
    <div v-if="!selectedTable">
      <div v-if="!tables.length" class="card">
        <p class="text-muted">Sin mesas activas</p>
      </div>
      <div
        v-for="table in tables"
        :key="table.table_number"
        class="card table-detail-card"
        @click="$emit('select-table', table)"
        style="cursor: pointer;"
      >
        <div class="td-row">
          <div>
            <span class="td-num">#{{ table.table_number }}</span>
            <span class="td-user">{{ table.user_name }} ({{ table.user_phone }})</span>
          </div>
          <span class="td-count">{{ table.songs ? table.songs.length : 0 }}</span>
        </div>
        <div class="td-status-row" v-if="table.songs && table.songs.length">
          <span v-if="table.songs_playing" class="ts-badge ts-playing">{{ table.songs_playing }} sonando</span>
          <span v-if="table.songs_pending" class="ts-badge ts-pending">{{ table.songs_pending }} en cola</span>
          <span v-if="table.songs_played" class="ts-badge ts-played">{{ table.songs_played }} reproducidas</span>
        </div>
      </div>
    </div>

    <!-- Table detail -->
    <div v-else>
      <button class="back-btn" @click="$emit('back')">&#8592; Volver a mesas</button>
      <div class="card" style="margin-top: 10px;">
        <div class="td-header">
          <div>
            <h3>Usuario #{{ selectedTable.table_number }}</h3>
            <p class="td-user-detail">{{ selectedTable.user_name }} &middot; {{ selectedTable.user_phone }}</p>
          </div>
          <div class="td-actions">
            <button
              class="t-btn t-btn-reset"
              @click="$emit('reset-limit', selectedTable.table_number)"
              :disabled="loadingResetLimit[selectedTable.table_number]"
            >
              {{ loadingResetLimit[selectedTable.table_number] ? '...' : 'Resetear límite' }}
            </button>
            <button
              class="t-btn t-btn-kick"
              @click="$emit('kick-table', selectedTable.table_number)"
              :disabled="loadingKick[selectedTable.table_number]"
            >
              {{ loadingKick[selectedTable.table_number] ? '...' : 'Expulsar' }}
            </button>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top: 10px;">
        <p class="section-title">CANCIONES PEDIDAS ({{ selectedTable.songs ? selectedTable.songs.length : 0 }})</p>
        <div v-if="selectedTable.songs && selectedTable.songs.length" class="td-songs">
          <div v-for="(s, i) in selectedTable.songs" :key="i" class="td-song">
            <span class="td-song-status" :class="s.status"></span>
            <div class="td-song-info">
              <p class="td-song-title">{{ s.title }}</p>
              <p class="td-song-meta">
                {{ s.added_at }} &middot;
                {{ { playing: 'Sonando', pending: 'En cola', played: 'Reproducida', removed: 'Removida' }[s.status] || s.status }}
              </p>
            </div>
          </div>
        </div>
        <p v-else class="text-muted">No ha pedido canciones</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.tables-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

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

.table-detail-card {
  transition: border-color 0.15s;
  margin-bottom: 8px;
}

.table-detail-card:hover {
  border-color: var(--primary);
}

.td-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.td-row > div {
  min-width: 0;
  flex: 1;
}

.td-num {
  font-weight: 700;
  font-size: 15px;
  margin-right: 8px;
  white-space: nowrap;
}

.td-user {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-count {
  font-size: 13px;
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.td-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
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

.back-btn {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.back-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.td-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.td-header h3 {
  font-size: 18px;
}

.td-user-detail {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}

.td-actions {
  display: flex;
  gap: 6px;
}

.t-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
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

.td-songs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.td-song {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: var(--bg-elevated);
  border-radius: 8px;
}

.td-song-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.td-song-status.playing {
  background: var(--success);
}

.td-song-status.pending {
  background: var(--warning);
}

.td-song-status.played {
  background: var(--text-muted);
}

.td-song-status.removed {
  background: var(--danger);
}

.td-song-info {
  flex: 1;
  min-width: 0;
}

.td-song-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-song-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.text-muted {
  color: var(--text-muted);
  font-size: 14px;
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .td-header {
    flex-direction: column;
  }

  .td-actions {
    width: 100%;
  }

  .td-actions .t-btn {
    flex: 1;
    text-align: center;
  }
}
</style>
