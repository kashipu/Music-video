import AdminAnalyticsPanel from './AdminAnalyticsPanel.vue'

export default { title: 'Components/AdminAnalyticsPanel', component: AdminAnalyticsPanel }

export const Loading = {
  args: {
    analytics: null,
    analyticsPeriod: 'week',
    fallbackYoutubeIds: new Set(),
    loadingAddToFallback: {},
  },
}

export const ConDatos = {
  args: {
    analytics: {
      summary: {
        total_songs_played: 142,
        unique_users: 28,
        unique_songs: 95,
        avg_queue_length: 3.2,
        active_days: 7,
        skip_count: 5,
        skip_rate: 3.5,
        error_count: 1,
        error_rate: 0.7,
        fallback_activations: 4,
        new_users: 12,
        returning_users: 16,
      },
      top_songs: [
        { youtube_id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up', times_played: 12 },
        { youtube_id: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', times_played: 9 },
      ],
      top_artists: [
        { artist: 'Bad Bunny', count: 24 },
        { artist: 'Dua Lipa', count: 18 },
      ],
      peak_hours: [
        { hour: '22:00', requests: 45 },
        { hour: '23:00', requests: 38 },
        { hour: '21:00', requests: 30 },
      ],
      top_tables: [
        { table_number: 'Mesa 4', total_songs: 18 },
        { table_number: 'Mesa 12', total_songs: 15 },
      ],
    },
    analyticsPeriod: 'week',
    fallbackYoutubeIds: new Set(['dQw4w9WgXcQ']),
    loadingAddToFallback: {},
  },
}

