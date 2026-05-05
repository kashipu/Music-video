<script setup>
import { useToast } from '../composables/useToast.js'
const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['toast', `toast-${t.type}`]"
          @click="dismiss(t.id)"
          role="status"
        >
          <span class="toast-dot" :class="`dot-${t.type}`"></span>
          <span class="toast-msg">{{ t.message }}</span>
          <button class="toast-x" @click.stop="dismiss(t.id)" aria-label="Cerrar">&#10005;</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: max(20px, env(safe-area-inset-top));
  right: max(20px, env(safe-area-inset-right));
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 380px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-card, #1f1f23);
  color: var(--text, #fff);
  border: 1px solid var(--border, rgba(255,255,255,0.1));
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  min-width: 240px;
}
.toast-dot {
  width: 8px; height: 8px; border-radius: 50%;
  flex-shrink: 0;
}
.dot-success { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
.dot-error   { background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.18); }
.dot-info    { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.18); }
.dot-warn    { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.18); }
.toast-success { border-left: 3px solid #22c55e; }
.toast-error   { border-left: 3px solid #ef4444; }
.toast-info    { border-left: 3px solid #3b82f6; }
.toast-warn    { border-left: 3px solid #f59e0b; }
.toast-msg { flex: 1; line-height: 1.35; }
.toast-x {
  background: transparent; border: none; color: inherit;
  opacity: 0.5; cursor: pointer; font-size: 12px;
  padding: 2px 6px; border-radius: 4px;
}
.toast-x:hover { opacity: 1; background: rgba(255,255,255,0.08); }

/* Animations */
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to   { opacity: 0; transform: translateX(20px); }
.toast-move       { transition: transform 0.25s ease; }
</style>
