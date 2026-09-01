import AdminTablesCard from './AdminTablesCard.vue'

export default {
  title: 'Admin/AdminTablesCard',
  component: AdminTablesCard,
  tags: ['autodocs'],
  argTypes: {
    tables: { control: 'object' },
    loadingResetLimit: { control: 'object' },
    loadingKick: { control: 'object' },
    onResetLimit: { action: 'reset-limit' },
    onKickTable: { action: 'kick-table' },
  },
}

export const ConMesas = {
  args: {
    tables: [
      {
        table_number: 4,
        user_name: 'Carlos',
        songs: [{}, {}, {}],
        songs_playing: 1,
        songs_pending: 1,
        songs_played: 1,
      },
      {
        table_number: 7,
        user_name: 'Andrea M.',
        songs: [{}],
        songs_playing: 0,
        songs_pending: 1,
        songs_played: 0,
      },
    ],
    loadingResetLimit: {},
    loadingKick: {},
  },
}

export const SinMesas = {
  args: {
    tables: [],
    loadingResetLimit: {},
    loadingKick: {},
  },
}
