<script setup>
defineProps({
  users: {
    type: Array,
    required: true,
  },
})

function daysSince(dateStr) {
  if (!dateStr) return null
  const value = new Date(dateStr.replace(' ', 'T'))
  if (isNaN(value.getTime())) return null
  const today = new Date()
  const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const d2 = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  return Math.max(0, Math.floor((d1 - d2) / 86400000))
}

function relativeDate(dateStr) {
  const days = daysSince(dateStr)
  if (days === null) return '—'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `hace ${days} días`
}
</script>

<template>
  <div class="users-content">
    <!-- Desktop Table View -->
    <div class="table-card">
      <table class="users-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Teléfono</th>
            <th>Última conexión</th>
            <th>Primera visita</th>
            <th>Pedidos</th>
            <th>Recurrente</th>
            <th>Auth</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <span class="user-name">{{ u.display_name || 'Sin nombre' }}</span>
            </td>
            <td>
              <span class="user-phone-cell">{{ u.phone }}</span>
            </td>
            <td>
              <span class="date-value">{{ relativeDate(u.last_connection) }}</span>
            </td>
            <td>
              <span class="date-value text-muted">{{ relativeDate(u.first_seen_at_venue) }}</span>
            </td>
            <td>
              <span class="songs-pill">{{ u.songs_count }}</span>
            </td>
            <td>
              <span class="badge-status" :class="u.is_recurring ? 'badge-recurring' : 'badge-first'">
                {{ u.is_recurring ? 'Sí' : 'No' }}
              </span>
            </td>
            <td>
              <span class="badge-status" :class="u.data_consent ? 'badge-consent' : 'badge-noconsent'">
                {{ u.data_consent ? 'Sí' : 'No' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards View -->
    <div class="mobile-cards-list">
      <div v-for="u in users" :key="`m-${u.id}`" class="user-card">
        <div class="user-card-header">
          <div class="user-title-wrap">
            <span class="user-card-name">{{ u.display_name || 'Sin nombre' }}</span>
            <span class="user-card-phone">{{ u.phone }}</span>
          </div>
          <div class="user-card-badges">
            <span class="badge-status" :class="u.is_recurring ? 'badge-recurring' : 'badge-first'">
              {{ u.is_recurring ? 'Recurrente' : '1ra vez' }}
            </span>
          </div>
        </div>

        <div class="user-card-grid">
          <div class="grid-item">
            <span class="item-label">Última conexión</span>
            <span class="item-val">{{ relativeDate(u.last_connection) }}</span>
          </div>
          <div class="grid-item">
            <span class="item-label">Primera visita</span>
            <span class="item-val">{{ relativeDate(u.first_seen_at_venue) }}</span>
          </div>
          <div class="grid-item">
            <span class="item-label">Canciones pedidas</span>
            <span class="item-val">{{ u.songs_count }}</span>
          </div>
          <div class="grid-item full-row">
            <span class="item-label">Auth</span>
            <span class="item-val consent-val">
              <span class="dot-indicator" :class="u.data_consent ? 'dot-yes' : 'dot-no'" />
              {{ u.data_consent ? 'Autorizado (Registro)' : 'No' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.table-card { display: none; }
.mobile-cards-list { display: flex; flex-direction: column; gap: 12px; }
.user-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.user-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
.user-title-wrap { display: flex; flex-direction: column; gap: 2px; }
.user-card-name { font-weight: 700; font-size: 15px; color: var(--text); }
.user-card-phone { font-size: 13px; color: var(--text-muted); }
.user-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
.grid-item { display: flex; flex-direction: column; gap: 2px; }
.grid-item.full-row { grid-column: 1 / -1; border-top: 1px dashed var(--border); padding-top: 8px; }
.item-label { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.3px; }
.item-val { font-size: 13px; font-weight: 500; color: var(--text); }
.consent-val { display: inline-flex; align-items: center; gap: 6px; }
.dot-indicator { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-yes { background-color: var(--success); }
.dot-no { background-color: var(--text-muted); }
.badge-status { display: inline-flex; align-items: center; justify-content: center; padding: 3px 9px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.badge-recurring { background: var(--success-soft); color: var(--success); }
.badge-first { background: var(--bg-elevated); color: var(--text-muted); }
.badge-consent { background: var(--success-soft); color: var(--success); }
.badge-noconsent { background: var(--bg-elevated); color: var(--text-muted); }
.songs-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 6px; background: var(--bg-elevated); border-radius: 12px; font-size: 12px; font-weight: 700; color: var(--primary); }

/* =========================================
   BREAKPOINT 850px (Desktop Table)
   ========================================= */
@media (min-width: 850px) {
  .mobile-cards-list { display: none; }
  .table-card { display: block; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); overflow: hidden; }
  .users-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
  .users-table th { background: var(--bg-elevated); padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
  .users-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--text); }
  .users-table tbody tr:last-child td { border-bottom: none; }
  .users-table tbody tr:hover { background: var(--bg-elevated); }
  .user-name { font-weight: 600; color: var(--text); }
  .user-phone-cell { color: var(--text-muted); font-family: monospace; font-size: 13px; }
  .date-value { white-space: nowrap; }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .user-card-grid { grid-template-columns: 1fr; }
}
</style>
