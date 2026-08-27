import VenueLimitsCard from './VenueLimitsCard.vue'

export default {
  title: 'Components/VenueLimitsCard',
  component: VenueLimitsCard,
}

export const Default = {
  args: {
    venueId: 'venue-1',
    config: {
      max_duration_sec: 600,
      max_songs_per_window: 3,
      window_minutes: 20,
    },
  },
}
