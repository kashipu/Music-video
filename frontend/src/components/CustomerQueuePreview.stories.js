import CustomerQueuePreview from './CustomerQueuePreview.vue'

export default {
  title: 'Components/CustomerQueuePreview',
  component: CustomerQueuePreview,
}

const sampleQueue = [
  {
    id: 1,
    youtube_id: 'kJQP7kiw5Fk',
    title: 'Despacito - Luis Fonsi ft. Daddy Yankee',
    added_by: 'Mesa 4',
  },
  {
    id: 2,
    youtube_id: 'OPf0YbXqDm0',
    title: 'Uptown Funk - Mark Ronson ft. Bruno Mars',
    added_by: 'Carlos',
  },
  {
    id: 3,
    youtube_id: 'fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody - Queen',
    added_by: 'Mesa 8',
  },
]

export const ColaCorta = {
  args: {
    queue: sampleQueue,
    totalInQueue: 3,
  },
}

export const ColaLarga = {
  args: {
    queue: sampleQueue,
    totalInQueue: 12,
  },
}

export const Vacio = {
  args: {
    queue: [],
    totalInQueue: 0,
  },
}
