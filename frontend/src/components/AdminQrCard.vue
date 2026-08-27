<script setup>
defineProps({
  venueSlug: {
    type: String,
    default: '',
  },
  venueName: {
    type: String,
    default: '',
  },
  qrCodeUrl: {
    type: String,
    required: true,
  },
  registroUrl: {
    type: String,
    required: true,
  },
})

defineEmits(['download', 'print'])
</script>

<template>
  <div class="card qr-card">
    <p class="section-title">QR DEL BAR</p>
    <div class="qr-wrapper" id="qr-print-area">
      <img :src="qrCodeUrl" :alt="`QR ${venueSlug}`" class="qr-img" crossorigin="anonymous" />
      <p class="qr-bar-name">{{ venueName || venueSlug }}</p>
      <p class="qr-url">{{ registroUrl }}</p>
    </div>
    <div class="qr-btns">
      <button class="qr-btn" @click="$emit('download')">Descargar</button>
      <button class="qr-btn" @click="$emit('print')">Imprimir</button>
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

.qr-card {
  text-align: center;
}

.qr-wrapper {
  padding: 16px;
}

.qr-img {
  width: 180px;
  height: 180px;
  border-radius: 8px;
  background: white;
  padding: 6px;
}

.qr-bar-name {
  font-size: 16px;
  font-weight: 700;
  margin-top: 10px;
}

.qr-url {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
  word-break: break-all;
}

.qr-btns {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.qr-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s;
}

.qr-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .qr-img {
    width: 150px;
    height: 150px;
  }
}
</style>
