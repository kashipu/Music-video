<script setup>
defineProps({ progress: Number })
</script>

<template>
  <div class="progress-thin">
    <div class="progress-thin-fill" :style="{ width: progress + '%' }"></div>
  </div>
</template>

<style>
.progress-thin {
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transition: opacity 0.3s;
}
.progress-thin-fill {
  height: 100%;
  background: var(--primary, #7C6CF0);
  transition: width 0.4s linear;
}
/* Hide thin bar when expanded */
.player-bar:hover .progress-thin { opacity: 0; }
</style>
