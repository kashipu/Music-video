import AdminMusicPanel from './AdminMusicPanel.vue'

export default {
  title: 'Admin/AdminMusicPanel',
  component: AdminMusicPanel,
  tags: ['autodocs'],
  argTypes: {
    playbackBadge: { control: 'object' },
    queue: { control: 'object' },
    totalDuration: { control: 'text' },
    wsState: { control: 'object' },
    nowPlaying: { control: 'object' },
    fallbackSongs: { control: 'object' },
    playbackStatus: {
      control: 'select',
      options: ['playing', 'paused'],
    },
    volume: { control: 'number' },
    muted: { control: 'boolean' },
    showBrand: { control: 'boolean' },
    showQr: { control: 'boolean' },
    qrSize: { control: 'number' },
    bannerText: { control: 'text' },
    bannerActive: { control: 'boolean' },
    library: { control: 'object' },
    played: { control: 'object' },
    fallbackPaused: { control: 'boolean' },
  },
}

export const Completo = {
  args: {
    playbackBadge: { label: 'Sonando', cls: 'badge-user' },
    queue: [
      {
        id: 1,
        youtube_id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up - Rick Astley',
        user_name: 'Carlos',
        table_number: 4,
        duration_sec: 213,
      },
    ],
    totalDuration: '3 min 33 s',
    wsState: { label: 'Conectado', cls: 'ws-ok', dotCls: 'ws-dot-ok' },
    nowPlaying: {
      title: 'Tití Me Preguntó - Bad Bunny',
      user_name: 'Mateo R.',
      table_number: 4,
      duration_sec: 243,
    },
    fallbackSongs: [
      {
        id: 10,
        title: 'Lamento Boliviano - Enanitos Verdes',
        thumbnail_url: 'https://i.ytimg.com/vi/1/mqdefault.jpg',
        duration_sec: 220,
        active: true,
      },
    ],
    playbackStatus: 'playing',
    volume: 80,
    muted: false,
    showBrand: true,
    showQr: true,
    qrSize: 140,
    bannerText: '¡Bienvenidos!',
    bannerActive: true,
    library: [],
    played: [],
    fallbackPaused: false,
  },
}
