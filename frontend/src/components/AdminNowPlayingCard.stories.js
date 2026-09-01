import AdminNowPlayingCard from './AdminNowPlayingCard.vue'

export default {
  title: 'Admin/AdminNowPlayingCard',
  component: AdminNowPlayingCard,
  tags: ['autodocs'],
  argTypes: {
    nowPlaying: { control: 'object' },
    fallbackSongs: { control: 'object' },
    playbackStatus: {
      control: 'select',
      options: ['playing', 'paused'],
    },
    queueLength: { control: 'number' },
    loadingPause: { control: 'boolean' },
    loadingResume: { control: 'boolean' },
    loadingSkip: { control: 'boolean' },
    loadingFallbackSkip: { control: 'boolean' },
    loadingStart: { control: 'boolean' },
    onPause: { action: 'pause' },
    onResume: { action: 'resume' },
    onNext: { action: 'next' },
    onStart: { action: 'start' },
  },
}

export const Reproduciendo = {
  args: {
    nowPlaying: {
      title: 'Tití Me Preguntó - Bad Bunny',
      user_name: 'Mateo R.',
      table_number: 4,
      duration_sec: 243,
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    },
    fallbackSongs: [],
    playbackStatus: 'playing',
    queueLength: 3,
  },
}

export const Pausado = {
  args: {
    nowPlaying: {
      title: 'Tití Me Preguntó - Bad Bunny',
      user_name: 'Mateo R.',
      table_number: 4,
      duration_sec: 243,
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    },
    fallbackSongs: [],
    playbackStatus: 'paused',
    queueLength: 3,
  },
}

export const SinReproduccionConCola = {
  args: {
    nowPlaying: null,
    fallbackSongs: [],
    playbackStatus: 'paused',
    queueLength: 5,
  },
}

export const Vacio = {
  args: {
    nowPlaying: null,
    fallbackSongs: [],
    playbackStatus: 'paused',
    queueLength: 0,
  },
}
