import { useQueueStore } from '../stores/queue.js'
import SongSubmit from './SongSubmit.vue'

export default { title: 'Components/SongSubmit', component: SongSubmit }

export const SearchReady = {
  render: () => ({
    components: { SongSubmit },
    setup() {
      const queue = useQueueStore()
      queue.rateLimit = { max_songs: 5, songs_remaining: 3 }
      return { rateLimit: queue.rateLimit }
    },
    template: '<SongSubmit :rate-limit="rateLimit" />',
  }),
}

export const LimitReached = { args: { rateLimit: { max_songs: 3, songs_remaining: 0, window_resets_at: '2030-01-01T00:05:00Z' } } }
