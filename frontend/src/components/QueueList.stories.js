import QueueList from './QueueList.vue'

const songs = [
  { id: 1, position: 1, title: 'Tití Me Preguntó', added_by: 'Ana', table_number: 3, duration_sec: 244, thumbnail_url: 'https://i.ytimg.com/vi/Cr8K88UcO0s/default.jpg' },
  { id: 2, position: 2, title: 'Ojitos Lindos', added_by: 'Luis', table_number: 7, duration_sec: 258, thumbnail_url: 'https://i.ytimg.com/vi/Cr8K88UcO0s/default.jpg' },
]
export default { title: 'Components/QueueList', component: QueueList }
export const WithQueue = { args: { songs, total: songs.length } }
export const Empty = { args: { songs: [], total: 0 } }
