<script setup>
defineProps({
  playbackBadge: {
    type: Object,
    default: () => ({ label: 'SIN REPRODUCCIÓN', cls: 'badge-idle' }),
  },
  queueCount: {
    type: Number,
    default: 0,
  },
  totalDuration: {
    type: String,
    default: '0 min',
  },
  wsState: {
    type: Object,
    default: () => ({ label: 'Conectado', cls: 'ws-ok', dotCls: 'ws-dot-ok' }),
  },
})
</script>

<template>
  <div class="stats-bar">
    <!-- Unified playback state badge — single source of truth -->
    <div class="stat-pill stat-state" :class="playbackBadge.cls" :title="`Estado: ${playbackBadge.label}`">
      <span class="state-dot"></span>
      {{ playbackBadge.label }}
    </div>
    <div class="stat-pill"><span>&#9835;</span> <strong>{{ queueCount }}</strong> en cola</div>
    <div class="stat-pill"><span>&#9201;</span> {{ totalDuration }}</div>
    <!-- WebSocket connection indicator -->
    <div class="stat-pill ws-pill" :class="wsState.cls" :title="`WebSocket: ${wsState.label}`">
      <span class="ws-dot" :class="wsState.dotCls"></span>
      {{ wsState.label }}
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.stats-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 13px;
}

.stat-live {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
  font-weight: 700;
}

.stat-paused {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
  font-weight: 700;
}

.stat-fallback {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 700;
  font-size: 12px;
}

/* Unified state badge */
.stat-state {
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.stat-state .state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.badge-user {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
}

.badge-user .state-dot {
  background: var(--success);
  animation: pulse-dot 2s infinite;
}

.badge-fallback {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

.badge-fallback .state-dot {
  background: var(--primary);
  animation: pulse-dot 2s infinite;
}

.badge-paused {
  background: var(--warning-soft, rgba(245, 158, 11, 0.15));
  border-color: var(--warning, #f59e0b);
  color: var(--warning, #f59e0b);
}

.badge-paused .state-dot {
  background: var(--warning, #f59e0b);
}

.badge-ready {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
}

.badge-ready .state-dot {
  background: var(--success);
}

.badge-idle {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
  border-color: var(--border);
  color: var(--text-muted);
}

.badge-idle .state-dot {
  background: var(--text-muted);
}

.badge-offline {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}

.badge-offline .state-dot {
  background: var(--danger);
  animation: pulse-dot 1s infinite;
}

/* WebSocket indicator */
.ws-pill {
  font-size: 11px;
}

.ws-pill .ws-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.ws-ok {
  color: var(--text-muted);
}

.ws-ok .ws-dot-ok {
  background: var(--success);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}

.ws-bad {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
  font-weight: 700;
}

.ws-bad .ws-dot-bad {
  background: var(--danger);
  animation: pulse-dot 1s infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .stats-bar {
    flex-wrap: wrap;
  }

  .stat-pill {
    font-size: 12px;
    padding: 5px 10px;
  }
}
</style>
