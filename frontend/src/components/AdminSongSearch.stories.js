import AdminSongSearch from './AdminSongSearch.vue'

export default {
  title: 'Components/AdminSongSearch',
  component: AdminSongSearch,
}

export const Busqueda = {
  args: {
    library: [],
    loadingAdd: {},
    addError: '',
  },
}

export const ConBiblioteca = {
  args: {
    library: [
      {
        youtube_id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        artist: 'Rick Astley',
        duration_sec: 213,
        thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      },
      {
        youtube_id: 'kJQP7kiw5Fk',
        title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
        artist: 'Luis Fonsi',
        duration_sec: 282,
        thumbnail_url: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg',
      },
    ],
    loadingAdd: {},
    addError: '',
  },
}

export const ConError = {
  args: {
    library: [],
    loadingAdd: {},
    addError: 'No se pudo agregar la canción',
  },
}
