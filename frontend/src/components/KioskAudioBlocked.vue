<script setup>
defineEmits(['unlock'])
</script>

<template>
  <div class="audio-blocked-overlay" @click="$emit('unlock')">
    <div class="audio-blocked-content">
      <div class="audio-blocked-icon">&#128264;</div>
      <p class="audio-blocked-text">El navegador bloqueo el audio</p>
      <button class="audio-blocked-btn" @click.stop="$emit('unlock')">ACTIVAR SONIDO</button>
    </div>
  </div>
</template>

<style scoped>
.audio-blocked-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  cursor: pointer;
}
.audio-blocked-content {
  text-align: center;
  color: #fff;
}
.audio-blocked-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
.audio-blocked-text {
  font-size: 20px;
  margin-bottom: 24px;
  opacity: 0.8;
}
.audio-blocked-btn {
  padding: 16px 48px;
  font-size: 20px;
  font-weight: 700;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  animation: pulse-btn 2s ease-in-out infinite;
}
@keyframes pulse-btn {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
