<script setup>
defineProps({ analytics: Object, analyticsPeriod: String, fallbackYoutubeIds: Object, loadingAddToFallback: Object })
defineEmits(['period', 'add-fallback'])
</script>
<template>
  <div>
    <div class="an-period"><button v-for="p in [{k:'day',l:'Hoy'},{k:'week',l:'Semana'},{k:'month',l:'Mes'},{k:'all',l:'Todo'}]" :key="p.k" class="an-period-btn" :class="{ active: analyticsPeriod === p.k }" @click="$emit('period', p.k)">{{ p.l }}</button></div>
    <div v-if="analytics"><div class="an-grid"><div class="an-card"><p class="an-val">{{ analytics.summary.total_songs_played }}</p><p class="an-label">Canciones</p></div><div class="an-card"><p class="an-val">{{ analytics.summary.unique_users }}</p><p class="an-label">Usuarios</p></div><div class="an-card"><p class="an-val">{{ analytics.summary.unique_songs }}</p><p class="an-label">Únicas</p></div><div class="an-card"><p class="an-val">{{ analytics.summary.avg_queue_length }}</p><p class="an-label">Prom. Cola</p></div><div class="an-card" v-if="analytics.summary.active_days !== undefined"><p class="an-val">{{ analytics.summary.active_days }}</p><p class="an-label">Días activos</p></div><div class="an-card" v-if="analytics.summary.skip_count !== undefined"><p class="an-val">{{ analytics.summary.skip_count }} <small>({{ analytics.summary.skip_rate }}%)</small></p><p class="an-label">Skips</p></div><div class="an-card" v-if="analytics.summary.error_count !== undefined"><p class="an-val">{{ analytics.summary.error_count }} <small>({{ analytics.summary.error_rate }}%)</small></p><p class="an-label">Errores</p></div><div class="an-card" v-if="analytics.summary.fallback_activations !== undefined"><p class="an-val">{{ analytics.summary.fallback_activations }}</p><p class="an-label">Fallbacks</p></div><div class="an-card" v-if="analytics.summary.new_users !== undefined"><p class="an-val">{{ analytics.summary.new_users }}</p><p class="an-label">Nuevos</p></div><div class="an-card" v-if="analytics.summary.returning_users !== undefined"><p class="an-val">{{ analytics.summary.returning_users }}</p><p class="an-label">Recurrentes</p></div></div>
      <div class="card" v-if="analytics.top_songs.length"><p class="section-title">TOP CANCIONES</p><div v-for="(s, i) in analytics.top_songs" :key="s.youtube_id" class="an-song"><span class="an-pos">{{ i + 1 }}</span><img :src="`https://i.ytimg.com/vi/${s.youtube_id}/mqdefault.jpg`" class="an-thumb" /><span class="an-title">{{ s.title }}</span><span class="an-count">{{ s.times_played }}x</span><button class="q-btn-label q-btn-fallback" @click="$emit('add-fallback', s.youtube_id)" :disabled="fallbackYoutubeIds?.has(s.youtube_id) || loadingAddToFallback?.[s.youtube_id]">{{ loadingAddToFallback?.[s.youtube_id] ? '...' : fallbackYoutubeIds?.has(s.youtube_id) ? '&#10003; En respaldo' : '+ Respaldo' }}</button></div></div>
      <div class="card" v-if="analytics.top_artists && analytics.top_artists.length" style="margin-top:12px;"><p class="section-title">TOP ARTISTAS</p><div v-for="(a, i) in analytics.top_artists" :key="a.artist" class="an-song"><span class="an-pos">{{ i + 1 }}</span><span class="an-title">{{ a.artist }}</span><span class="an-count">{{ a.count }}x</span></div></div>
      <div class="card" v-if="analytics.peak_hours.length" style="margin-top:12px;"><p class="section-title">HORAS PICO</p><div v-for="h in analytics.peak_hours.slice(0, 8)" :key="h.hour" class="an-hour"><span class="an-hour-label">{{ h.hour }}</span><div class="an-hour-bar"><div class="an-hour-fill" :style="{ width: (h.requests / analytics.peak_hours[0].requests * 100) + '%' }"></div></div><span class="an-hour-count">{{ h.requests }}</span></div></div>
      <div class="card" v-if="analytics.top_tables && analytics.top_tables.length" style="margin-top:12px;"><p class="section-title">USUARIOS MÁS ACTIVOS</p><div v-for="(t, i) in analytics.top_tables" :key="t.table_number" class="an-song"><span class="an-pos">{{ i + 1 }}</span><span class="an-title">{{ t.table_number }}</span><span class="an-count">{{ t.total_songs }} canciones</span></div></div></div>
    <div v-else class="card"><p class="text-muted">Cargando analítica...</p></div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.an-period { display: flex; gap: 6px; margin-bottom: 12px; }
.an-period-btn { padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border); cursor: pointer; }
.an-period-btn.active { background: var(--primary); color: var(--text-on-primary, #fff); border-color: var(--primary); }
.an-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
.an-card { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 16px; text-align: center; }
.an-val { font-size: 26px; font-weight: 700; }
.an-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.an-song {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid var(--border-soft);
}
.an-song:last-child { border-bottom: none; }
.an-pos { font-weight: 700; font-size: 13px; color: var(--text-muted); width: 20px; text-align: center; flex-shrink: 0; }
.an-thumb { width: 48px; height: 36px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.an-title { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.an-count { font-weight: 600; color: var(--primary); font-size: 13px; flex-shrink: 0; min-width: 28px; text-align: right; }
.an-hour {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0;
}
.an-hour-label { font-size: 13px; font-weight: 600; width: 45px; flex-shrink: 0; }
.an-hour-bar { flex: 1; height: 8px; background: var(--bg-elevated); border-radius: 4px; overflow: hidden; }
.an-hour-fill { height: 100%; background: var(--primary); border-radius: 4px; transition: width 0.3s; }
.an-hour-count { font-size: 12px; color: var(--text-muted); width: 30px; text-align: right; flex-shrink: 0; }

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .an-grid { grid-template-columns: repeat(3, 1fr); }
}

/* =========================================
   BREAKPOINT 480px
   ========================================= */
@media (max-width: 480px) {
  .an-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
  .an-val { font-size: 20px; }
}
</style>
