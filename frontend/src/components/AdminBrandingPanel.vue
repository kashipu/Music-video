<script setup>
defineProps({ showBrand: Boolean, loadingBrand: Boolean, showQr: Boolean, loadingQr: Boolean, qrSize: String, loadingQrSize: Boolean, bannerText: String, bannerActive: Boolean, loadingBanner: Boolean })
defineEmits(['toggle-brand', 'toggle-qr', 'set-qr-size', 'update:bannerText', 'activate-banner', 'deactivate-banner'])
</script>

<template>
  <div class="card volume-card">
    <p class="section-title">PANTALLA VIDEO</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:13px;font-weight:600;">Logo / Nombre del bar</span>
      <button class="t-btn" :class="showBrand ? 't-btn-kick' : 't-btn-reset'" @click="$emit('toggle-brand')" :disabled="loadingBrand" style="padding:5px 12px;font-size:11px;">{{ loadingBrand ? '...' : (showBrand ? 'Ocultar' : 'Mostrar') }}</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:13px;font-weight:600;">QR en pantalla</span>
      <button class="t-btn" :class="showQr ? 't-btn-kick' : 't-btn-reset'" @click="$emit('toggle-qr')" :disabled="loadingQr" style="padding:5px 12px;font-size:11px;">{{ loadingQr ? '...' : (showQr ? 'Ocultar' : 'Mostrar') }}</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:13px;font-weight:600;">Tamano del QR</span>
      <div style="display:flex;gap:4px;"><button v-for="s in ['S', 'M', 'L']" :key="s" class="t-btn" :class="qrSize === s ? 't-btn-kick' : 't-btn-reset'" @click="$emit('set-qr-size', s)" :disabled="loadingQrSize" style="padding:5px 10px;font-size:11px;">{{ s }}</button></div>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:12px;">
      <span style="font-size:13px;font-weight:600;display:block;margin-bottom:8px;">Banner publicitario</span>
      <input type="text" :value="bannerText" @input="$emit('update:bannerText', $event.target.value)" class="input-field" placeholder="Escribe el texto del banner..." />
      <div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary" style="flex:1;" @click="$emit('activate-banner')" :disabled="!bannerText || bannerActive || loadingBanner">{{ loadingBanner ? '...' : 'Mostrar (3 min)' }}</button><button class="btn btn-danger" style="flex:1;" @click="$emit('deactivate-banner')" :disabled="!bannerActive || loadingBanner">{{ loadingBanner ? '...' : 'Apagar' }}</button></div>
    </div>
  </div>
</template>

<style scoped>
.t-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
}

.t-btn-reset {
  border-color: var(--secondary);
  color: var(--secondary);
  background: transparent;
}

.t-btn-reset:hover {
  background: var(--secondary);
  color: #000;
}

.t-btn-kick {
  border-color: var(--danger);
  color: var(--danger);
  background: transparent;
}

.t-btn-kick:hover {
  background: var(--danger);
  color: white;
}
</style>
