import AdminSidebarSummary from './AdminSidebarSummary.vue'

export default {
  title: 'Admin/AdminSidebarSummary',
  component: AdminSidebarSummary,
  tags: ['autodocs'],
  argTypes: {
    analytics: { control: 'object' },
  },
}

export const ConDatos = {
  args: {
    analytics: {
      summary: {
        total_songs_played: 142,
        unique_users: 38,
      },
      top_songs: [
        { youtube_id: '1', title: 'La Bachata - Manuel Turizo', times_played: 12 },
        { youtube_id: '2', title: 'Despechá - Rosalía', times_played: 9 },
        { youtube_id: '3', title: 'Tití Me Preguntó - Bad Bunny', times_played: 8 },
      ],
    },
  },
}

export const SinDatos = {
  args: {
    analytics: null,
  },
}
