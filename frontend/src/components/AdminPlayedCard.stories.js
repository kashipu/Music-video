import AdminPlayedCard from './AdminPlayedCard.vue'

export default {
  title: 'Admin/AdminPlayedCard',
  component: AdminPlayedCard,
  tags: ['autodocs'],
  argTypes: {
    played: { control: 'object' },
    playedLimit: { control: 'number' },
    fallbackYoutubeIds: { control: 'object' },
    loadingAddFromLib: { control: 'object' },
    loadingAddToFallback: { control: 'object' },
    onRequeueSong: { action: 'requeue-song' },
    onAddToFallback: { action: 'add-to-fallback' },
    onLoadMore: { action: 'load-more' },
  },
}

export const ConHistorial = {
  args: {
    played: [
      {
        id: 101,
        youtube_id: 'abc12345',
        title: 'Cali Pachanguero - Grupo Niche',
        user_name: 'Mesa 1',
        played_at_label: 'hace 10 min',
      },
      {
        id: 102,
        youtube_id: 'xyz67890',
        title: 'La Rebelión - Joe Arroyo',
        user_name: 'Mesa 3',
        played_at_label: 'hace 25 min',
      },
    ],
    playedLimit: 15,
    fallbackYoutubeIds: new Set(['xyz67890']),
    loadingAddFromLib: {},
    loadingAddToFallback: {},
  },
}

export const SinHistorial = {
  args: {
    played: [],
    playedLimit: 15,
    fallbackYoutubeIds: new Set(),
    loadingAddFromLib: {},
    loadingAddToFallback: {},
  },
}
