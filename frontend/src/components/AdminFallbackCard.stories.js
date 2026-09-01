import AdminFallbackCard from './AdminFallbackCard.vue'

export default {
  title: 'Admin/AdminFallbackCard',
  component: AdminFallbackCard,
  tags: ['autodocs'],
  argTypes: {
    fallbackSongs: { control: 'object' },
    fallbackPaused: { control: 'boolean' },
    nowPlaying: { control: 'object' },
    queueLength: { control: 'number' },
    loadingFallbackPlay: { control: 'boolean' },
    loadingFallbackToggle: { control: 'boolean' },
    loadingDeleteFallback: { control: 'object' },
    onPlayNow: { action: 'play-now' },
    onToggleFallback: { action: 'toggle-fallback' },
    onDeleteSong: { action: 'delete-song' },
  },
}

export const Reproduciendo = {
  args: {
    fallbackSongs: [
      {
        id: 1,
        title: 'Lamento Boliviano - Enanitos Verdes',
        thumbnail_url: 'https://i.ytimg.com/vi/1/mqdefault.jpg',
        duration_sec: 220,
        active: true,
      },
      {
        id: 2,
        title: 'Música Ligera - Soda Stereo',
        thumbnail_url: 'https://i.ytimg.com/vi/2/mqdefault.jpg',
        duration_sec: 215,
        active: true,
      },
    ],
    fallbackPaused: false,
    nowPlaying: null,
    queueLength: 0,
    loadingFallbackPlay: false,
    loadingFallbackToggle: false,
    loadingDeleteFallback: {},
  },
}

export const Pausada = {
  args: {
    fallbackSongs: [
      {
        id: 1,
        title: 'Lamento Boliviano - Enanitos Verdes',
        thumbnail_url: 'https://i.ytimg.com/vi/1/mqdefault.jpg',
        duration_sec: 220,
        active: true,
      },
    ],
    fallbackPaused: true,
    nowPlaying: null,
    queueLength: 0,
    loadingFallbackPlay: false,
    loadingFallbackToggle: false,
    loadingDeleteFallback: {},
  },
}

export const SinPlaylist = {
  args: {
    fallbackSongs: [],
    fallbackPaused: false,
    nowPlaying: null,
    queueLength: 0,
    loadingFallbackPlay: false,
    loadingFallbackToggle: false,
    loadingDeleteFallback: {},
  },
}
