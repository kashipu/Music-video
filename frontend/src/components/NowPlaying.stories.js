import NowPlaying from './NowPlaying.vue'

export default { title: 'Components/NowPlaying', component: NowPlaying }
export const Playing = { args: { song: { title: 'Baila conmigo', duration_sec: 198, added_by: 'Mesa 4', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg' } } }
export const Empty = { args: { song: null } }
