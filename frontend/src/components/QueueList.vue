<script setup>
import SongCard from './SongCard.vue'

defineProps({
  songs: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
})
</script>

<template>
  <div class="card queue-list" style="margin-top: 16px;">
    <p class="section-title">Siguiente en la Cola ({{ total }})</p>
    <div v-if="songs.length">
      <SongCard
        v-for="song in songs"
        :key="song.id"
        :song="song"
      />
    </div>
    <p v-else class="empty">No hay canciones en la cola</p>
  </div>
</template>

<style scoped>
.empty {
  color: var(--text-muted);
  font-size: 14px;
}
</style>
