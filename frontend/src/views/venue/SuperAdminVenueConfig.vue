<template>
  <div v-if="detail" class="vd-layout">
    <div class="vd-col">
      <VenueGeneralConfig
        :venue-id="venueId"
        :venue="detail.venue"
        @refresh="refresh"
      />
      <VenueLimitsCard
        :venue-id="venueId"
        :config="detail.venue?.config"
        @refresh="refresh"
      />
      <VenueDangerZone
        :venue-id="venueId"
        :active="detail.venue?.active"
        @refresh="refresh"
      />
    </div>

    <div class="vd-col">
      <VenueAdminsCard
        :venue-id="venueId"
        :admins="detail.admins"
        @refresh="refresh"
      />
      <VenuePlaylistCard
        :venue-id="venueId"
      />
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useRoute } from 'vue-router'
import VenueGeneralConfig from '../../components/VenueGeneralConfig.vue'
import VenueLimitsCard from '../../components/VenueLimitsCard.vue'
import VenueDangerZone from '../../components/VenueDangerZone.vue'
import VenueAdminsCard from '../../components/VenueAdminsCard.vue'
import VenuePlaylistCard from '../../components/VenuePlaylistCard.vue'

const route = useRoute()
const venueId = route.params.venueId
const venueDetail = inject('venueDetail')
if (!venueDetail) throw new Error('venueDetail no disponible')
const { detail, refresh } = venueDetail
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.vd-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

.vd-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .vd-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    padding: 24px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .vd-layout {
    padding: 12px 8px;
  }
}
</style>
