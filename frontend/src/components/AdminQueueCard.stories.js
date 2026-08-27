import AdminQueueCard from './AdminQueueCard.vue'

export default {
  title: 'Admin/AdminQueueCard',
  component: AdminQueueCard,
  tags: ['autodocs'],
  argTypes: {
    queue: { control: 'object' },
    queueLimit: { control: 'number' },
    loadingPlayNow: { control: 'object' },
    loadingRemove: { control: 'object' },
    loadingClearQueue: { control: 'boolean' },
    onClearQueue: { action: 'clear-queue' },
    onPlayNow: { action: 'play-now' },
    onRemoveSong: { action: 'remove-song' },
    onLoadMore: { action: 'load-more' },
  },
}

export const ConCanciones = {
  args: {
    queue: [
      {
        id: 1,
        youtube_id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up - Rick Astley',
        user_name: 'Carlos',
        table_number: 4,
        duration_sec: 213,
      },
      {
        id: 2,
        youtube_id: 'kJQP7kiw5Fk',
        title: 'Despacito - Luis Fonsi ft. Daddy Yankee',
        user_name: 'Andrea',
        table_number: 2,
        duration_sec: 228,
      },
      {
        id: 3,
        youtube_id: 'fJ9rUzIMcZQ',
        title: 'Bohemian Rhapsody - Queen',
        user_name: 'Felipe',
        table_number: 5,
        duration_sec: 354,
      },
    ],
    queueLimit: 15,
    loadingPlayNow: {},
    loadingRemove: {},
    loadingClearQueue: false,
  },
}

export const ColaVacia = {
  args: {
    queue: [],
    queueLimit: 15,
    loadingPlayNow: {},
    loadingRemove: {},
    loadingClearQueue: false,
  },
}
