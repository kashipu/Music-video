import KioskPlayerControls from './KioskPlayerControls.vue'

export default { title: 'Components/KioskPlayerControls', component: KioskPlayerControls, parameters: { layout: 'fullscreen' } }

const args = { progress: 42, currentTime: 76, duration: 180 }

export const Pausado = { args: { ...args, isPlaying: false, controlsVisible: false } }
export const Reproduciendo = { args: { ...args, isPlaying: true, controlsVisible: false } }
export const ControlesVisibles = { args: { ...args, isPlaying: true, controlsVisible: true } }
