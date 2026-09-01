import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminAnalyticsPanel from './AdminAnalyticsPanel.vue'

const analytics = { summary: { total_songs_played: 9, unique_users: 3, unique_songs: 5, avg_queue_length: 2, skip_count: 1, skip_rate: 10 }, top_songs: [{ youtube_id: 'abc', title: 'Tema', times_played: 4 }], top_artists: [{ artist: 'Artista', count: 4 }], peak_hours: [{ hour: '20:00', requests: 4 }], top_tables: [{ table_number: 7, total_songs: 3 }] }

describe('AdminAnalyticsPanel', () => {
  it('renders loading state when analytics are absent', () => {
    expect(mount(AdminAnalyticsPanel).text()).toContain('Cargando analítica...')
  })

  it('renders data and emits period and fallback actions', async () => {
    const wrapper = mount(AdminAnalyticsPanel, { props: { analytics, analyticsPeriod: 'week', fallbackYoutubeIds: new Set() } })
    expect(wrapper.text()).toContain('Tema')
    expect(wrapper.text()).toContain('Artista')
    await wrapper.get('.an-period-btn').trigger('click')
    await wrapper.get('.q-btn-fallback').trigger('click')
    expect(wrapper.emitted('period')[0]).toEqual(['day'])
    expect(wrapper.emitted('add-fallback')[0]).toEqual(['abc'])
  })
})
