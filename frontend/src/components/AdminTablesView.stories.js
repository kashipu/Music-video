import AdminTablesView from './AdminTablesView.vue'

export default {
  title: 'Admin/AdminTablesView',
  component: AdminTablesView,
  tags: ['autodocs'],
  argTypes: {
    tables: { control: 'object' },
    selectedTable: { control: 'object' },
    loadingResetLimit: { control: 'object' },
    loadingKick: { control: 'object' },
    onSelectTable: { action: 'select-table' },
    onBack: { action: 'back' },
    onResetLimit: { action: 'reset-limit' },
    onKickTable: { action: 'kick-table' },
  },
}

export const ListaMesas = {
  args: {
    tables: [
      {
        table_number: 3,
        user_name: 'Mateo R.',
        user_phone: '+57 300 123 4567',
        songs: [
          { title: 'Canción 1', added_at: '21:15', status: 'playing' },
          { title: 'Canción 2', added_at: '21:30', status: 'pending' },
        ],
        songs_playing: 1,
        songs_pending: 1,
        songs_played: 0,
      },
      {
        table_number: 8,
        user_name: 'Lucía G.',
        user_phone: '+57 311 987 6543',
        songs: [],
        songs_playing: 0,
        songs_pending: 0,
        songs_played: 0,
      },
    ],
    selectedTable: null,
    loadingResetLimit: {},
    loadingKick: {},
  },
}

export const DetalleMesa = {
  args: {
    tables: [],
    selectedTable: {
      table_number: 3,
      user_name: 'Mateo R.',
      user_phone: '+57 300 123 4567',
      songs: [
        { title: 'La Gota Fría - Carlos Vives', added_at: '21:15', status: 'playing' },
        { title: 'Sobredosis - Romeo Santos', added_at: '21:30', status: 'pending' },
        { title: 'Bailando - Enrique Iglesias', added_at: '20:45', status: 'played' },
      ],
    },
    loadingResetLimit: {},
    loadingKick: {},
  },
}

export const SinMesas = {
  args: {
    tables: [],
    selectedTable: null,
    loadingResetLimit: {},
    loadingKick: {},
  },
}
