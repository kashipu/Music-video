import KioskBottomBar from './KioskBottomBar.vue'

export default { title: 'Components/KioskBottomBar', component: KioskBottomBar, parameters: { layout: 'fullscreen' } }
export const Playing = { args: { song: { title: 'Baila conmigo' }, queue: [{ title: 'La noche entera' }], fallbackPlayed: new Set(), fallbackSongs: [] } }
export const Fallback = { args: { song: { title: 'Playlist nocturna' }, playingFallback: true, queue: [], fallbackPlayed: new Set(['a', 'b']), fallbackSongs: [{}, {}, {}] } }
