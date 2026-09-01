<script setup>
import Card from './ui/Card.vue'

defineProps({
  dailyAnalytics: { type: Object, default: null },
  bestDay: { type: Object, default: null },
})

function shortDate(date) {
  return date.slice(5).split('-').reverse().join('/')
}
</script>

<template>
  <Card v-if="dailyAnalytics" title="ACTIVIDAD">
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
  </Card>
</template>

<style scoped>
.activity-best { margin-bottom: 12px; color: var(--text-muted); font-size: 13px; }
.activity-best strong, .activity-day strong { color: var(--text); }
.activity-days { display: flex; flex-direction: column; gap: 8px; }
.activity-day { display: grid; grid-template-columns: 40px 1fr 28px; gap: 8px; align-items: center; color: var(--text-muted); font-size: 12px; }
.activity-bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--bg-elevated); }
.activity-bar i { display: block; min-width: 4px; height: 100%; border-radius: inherit; background: var(--primary); }

@media (min-width: 850px) {
  .card { padding: 20px; }
}
</style>
