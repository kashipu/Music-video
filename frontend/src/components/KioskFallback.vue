<script setup>
defineProps({
  fallbackPaused: Boolean,
  qrCodeUrl: String,
  dailyPin: String,
})
</script>

<template>
  <div class="fallback-overlay">
    <div class="fallback-content">
      <div class="fallback-icon">&#9835;</div>
      <p class="fallback-text" v-if="fallbackPaused">Playlist pausada</p>
      <p class="fallback-text" v-else>Esperando canciones...</p>
      <p class="fallback-sub">Escanea el QR para pedir musica</p>
      <div class="fallback-qr">
        <img :src="qrCodeUrl" alt="QR" class="fallback-qr-img" crossorigin="anonymous" />
      </div>
      <div v-if="dailyPin" class="pin-display">
        <p class="pin-label">CODIGO DE HOY</p>
        <p class="pin-value">{{ dailyPin }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fallback-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kiosk-bg);
  z-index: 5;
}
.fallback-content {
  text-align: center;
}
.fallback-icon {
  font-size: 80px;
  margin-bottom: 16px;
  opacity: 0.3;
}
.fallback-text {
  font-size: 32px;
  font-weight: 700;
  opacity: 0.8;
}
.fallback-sub {
  font-size: 18px;
  color: var(--kiosk-text-dim);
  margin-top: 8px;
}
.fallback-qr {
  margin-top: 24px;
}
.fallback-qr-img {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: #fff;
  padding: 8px;
}
.pin-display {
  margin-top: 20px;
  text-align: center;
}
.pin-label {
  font-size: 14px;
  color: var(--kiosk-text-dim);
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.pin-value {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: 12px;
  color: #fff;
}
</style>
