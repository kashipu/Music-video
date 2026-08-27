import KioskFallback from './KioskFallback.vue'

export default { title: 'Components/KioskFallback', component: KioskFallback, parameters: { layout: 'fullscreen' } }
export const Waiting = { args: { qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fexample.com', dailyPin: '1234' } }
export const Paused = { args: { fallbackPaused: true, qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https%3A%2F%2Fexample.com' } }
