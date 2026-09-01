<script setup>
import KioskProgress from './KioskProgress.vue'

const props = defineProps({
  isPlaying: Boolean,
  progress: Number,
  currentTime: Number,
  duration: Number,
  controlsVisible: Boolean,
})

const emit = defineEmits(['toggle-play-pause', 'seek-relative', 'seek-to-percent', 'show-controls', 'hide-controls'])

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function seekToPercent(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  emit('seek-to-percent', Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)))
}
</script>

<template>
  <Transition name="fade-quick">
    <div v-if="!isPlaying || controlsVisible" class="center-playpause" @click.stop="emit('toggle-play-pause')">
      <div class="center-btn-circle" :class="{ 'center-paused': !isPlaying }">
        <span class="center-icon">{{ isPlaying ? '&#10074;&#10074;' : '&#9654;' }}</span>
      </div>
    </div>
  </Transition>

  <div class="player-bar" @mouseenter="$emit('show-controls')" @mouseleave="$emit('hide-controls')" @click="$emit('show-controls')">
    <KioskProgress :progress="progress" />
    <Transition name="slide-up">
      <div v-if="controlsVisible" class="player-bar-expanded">
        <div class="pb-progress" @click.stop="seekToPercent">
          <div class="pb-track">
            <div class="pb-fill" :style="{ width: progress + '%' }"></div>
            <div class="pb-handle" :style="{ left: progress + '%' }"></div>
          </div>
        </div>
        <div class="pb-row">
          <span class="pb-time">{{ formatTime(currentTime) }}</span>
          <div class="pb-controls">
            <button class="kc-btn" @click.stop="emit('seek-relative', -10)">-10s</button>
            <button class="kc-btn kc-playpause" @click.stop="emit('toggle-play-pause')">{{ isPlaying ? '&#10074;&#10074;' : '&#9654;' }}</button>
            <button class="kc-btn" @click.stop="emit('seek-relative', 10)">+10s</button>
          </div>
          <span class="pb-time">{{ formatTime(duration) }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.player-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 25;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.player-bar-expanded {
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  padding: 24px 24px 14px;
}
.pb-progress {
  cursor: pointer;
  padding: 8px 0;
}
.pb-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: visible;
}
.pb-fill {
  height: 100%;
  background: var(--primary, #7C6CF0);
  border-radius: 3px;
  transition: width 0.3s linear;
}
.pb-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
  transition: left 0.3s linear;
}
.pb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.pb-time {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
}
.pb-time:last-child { text-align: right; }
.pb-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}
.kc-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.kc-btn:hover { background: rgba(255, 255, 255, 0.3); }
.kc-btn:active { background: rgba(255, 255, 255, 0.4); }
.kc-playpause {
  font-size: 20px;
  padding: 8px 20px;
}

.slide-up-enter-active { transition: all 0.3s ease; }
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.center-playpause {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 15;
  cursor: pointer;
}
.center-btn-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.15s, border-color 0.2s;
  backdrop-filter: blur(6px);
}
.center-btn-circle:hover {
  background: rgba(0, 0, 0, 0.75);
  border-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.1);
}
.center-btn-circle:active { transform: scale(0.95); }
.center-btn-circle.center-paused {
  background: rgba(124, 108, 240, 0.6);
  border-color: rgba(124, 108, 240, 0.9);
  animation: pulse-center 2.5s ease-in-out infinite;
}
@keyframes pulse-center {
  0%, 100% { box-shadow: 0 0 0 0 rgba(124, 108, 240, 0.5); }
  50% { box-shadow: 0 0 0 18px rgba(124, 108, 240, 0); }
}
.center-icon {
  font-size: 28px;
  color: #fff;
  line-height: 1;
  padding-left: 4px;
}
.center-btn-circle.center-paused .center-icon {
  padding-left: 6px;
}
.center-btn-circle:not(.center-paused) .center-icon {
  padding-left: 0;
}

.fade-quick-enter-active { transition: opacity 0.2s ease; }
.fade-quick-leave-active { transition: opacity 0.4s ease; }
.fade-quick-enter-from, .fade-quick-leave-to { opacity: 0; }
</style>
