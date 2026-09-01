import KioskProgress from './KioskProgress.vue'

export default { title: 'Components/KioskProgress', component: KioskProgress, parameters: { layout: 'fullscreen' } }
export const Halfway = { args: { progress: 50 } }
export const Complete = { args: { progress: 100 } }
