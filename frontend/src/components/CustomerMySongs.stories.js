import CustomerMySongs from './CustomerMySongs.vue'

export default {
  title: 'Components/CustomerMySongs',
  component: CustomerMySongs,
}

const sampleSongs = [
  {
    id: 1,
    youtube_id: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up - Rick Astley',
    status: 'playing',
    position: 0,
  },
  {
    id: 2,
    youtube_id: 'kJQP7kiw5Fk',
    title: 'Despacito - Luis Fonsi ft. Daddy Yankee',
    status: 'pending',
    position: 2,
  },
]

export const ConCanciones = {
  args: {
    songs: sampleSongs,
    cancelLoading: {},
  },
}

export const Cancelando = {
  args: {
    songs: sampleSongs,
    cancelLoading: { 2: true },
  },
}

export const Vacio = {
  args: {
    songs: [],
    cancelLoading: {},
  },
}
