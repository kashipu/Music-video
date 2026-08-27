<script setup>
defineProps({
  song: Object,
  queue: Array,
  pendingUserSong: Object,
})
</script>

<template>
  <div class="song-overlay">
    <div class="overlay-content">
      <p class="overlay-title">{{ song.title }}</p>
      <p class="overlay-meta" v-if="queue.length || pendingUserSong">
        Siguiente: {{ queue[0]?.title || pendingUserSong?.title }}
      </p>
    </div>
  </div>
</template>

<style>
.song-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  padding: 60px 40px 40px;
}
.overlay-content {
  max-width: 900px;
}
.overlay-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
.overlay-meta {
  font-size: 16px;
  color: rgba(255,255,255,0.6);
  margin-top: 8px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
}

/* Overlay transition */
.overlay-enter-active, .fade-enter-active {
  transition: opacity 0.3s ease;
}
.overlay-leave-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.overlay-enter-from, .overlay-leave-to,
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
