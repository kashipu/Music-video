import KioskSongOverlay from './KioskSongOverlay.vue'

export default { title: 'Components/KioskSongOverlay', component: KioskSongOverlay, parameters: { layout: 'fullscreen' } }
export const WithNextSong = { args: { song: { title: 'Baila conmigo' }, queue: [{ title: 'La noche entera' }] } }
export const WithoutNextSong = { args: { song: { title: 'Baila conmigo' }, queue: [] } }
