import SongErrorModal from './SongErrorModal.vue'

export default {
  title: 'Components/SongErrorModal',
  component: SongErrorModal,
}

export const ConError = {
  args: {
    error: {
      title: 'Bohemian Rhapsody - Queen (Official Video)',
      youtube_id: 'fJ9rUzIMcZQ',
      message: 'Restricción de derechos de autor',
    },
  },
}

export const Oculto = {
  args: {
    error: null,
  },
}
