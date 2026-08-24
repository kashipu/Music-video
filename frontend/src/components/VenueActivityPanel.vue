<script setup>
defineProps({
  dailyAnalytics: { type: Object, default: null },
  bestDay: { type: Object, default: null },
})

function shortDate(date) {
  return date.slice(5).split('-').reverse().join('/')
}
</script>

<template>
  <div v-if="dailyAnalytics" class="card">
    <p class="section-title">ACTIVIDAD</p>
    <p v-if="bestDay && bestDay.people > 0" class="activity-best">
      Mejor día: <strong>{{ shortDate(bestDay.date) }}</strong> · {{ bestDay.people }} personas
    </p>
    <p v-else class="text-muted">Sin actividad en los últimos 7 días</p>
    <div v-if="dailyAnalytics.days && dailyAnalytics.days.length" class="activity-days">
      <div v-for="day in dailyAnalytics.days" :key="day.date" class="activity-day">
        <span>{{ shortDate(day.date) }}</span>
        <div class="activity-bar">
          <i :style="{ width: `${(bestDay && bestDay.people > 0) ? (day.people / bestDay.people * 100) : 0}%` }" />
        </div>
        <strong>{{ day.people }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; }
.section-title { margin: 0 0 12px; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.activity-best { margin-bottom: 12px; color: var(--text-muted); font-size: 13px; }
.activity-best strong, .activity-day strong { color: var(--text); }
.activity-days { display: flex; flex-direction: column; gap: 8px; }
.activity-day { display: grid; grid-template-columns: 40px 1fr 28px; gap: 8px; align-items: center; color: var(--text-muted); font-size: 12px; }
.activity-bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--bg-elevated); }
.activity-bar i { display: block; min-width: 4px; height: 100%; border-radius: inherit; background: var(--primary); }
.text-muted { color: var(--text-muted); font-size: 13px; }

@media (min-width: 850px) {
  .card { padding: 20px; }
}
</style>
