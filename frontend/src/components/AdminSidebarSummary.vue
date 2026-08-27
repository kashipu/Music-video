<script setup>
defineProps({
  analytics: {
    type: Object,
    default: null,
  },
})
</script>

<template>
  <div class="card" v-if="analytics">
    <p class="section-title">RESUMEN SEMANAL</p>
    <div class="analytics-mini" v-if="analytics.summary">
      <div class="am"><strong>{{ analytics.summary.total_songs_played }}</strong> canciones</div>
      <div class="am"><strong>{{ analytics.summary.unique_users }}</strong> usuarios</div>
    </div>
    <div v-if="analytics.top_songs && analytics.top_songs.length" class="top-mini">
      <p class="mini-label">Top canciones:</p>
      <div v-for="s in analytics.top_songs.slice(0, 3)" :key="s.youtube_id" class="top-mini-item">
        <span class="top-mini-title">{{ s.title }}</span>
        <span class="top-mini-count">{{ s.times_played }}x</span>
      </div>
    </div>
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

.analytics-mini {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.am {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: var(--bg-elevated);
  border-radius: 6px;
  font-size: 12px;
}

.top-mini {
  margin-top: 4px;
}

.mini-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.top-mini-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 2px 0;
}

.top-mini-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.top-mini-count {
  font-weight: 600;
  color: var(--primary);
}
</style>
