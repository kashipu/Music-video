import AdminSidebar from './AdminSidebar.vue'
import logo from '../assets/logo-color-negativo.svg'

export default { title: 'Components/AdminSidebar', component: AdminSidebar }

const args = { venueName: 'Repítela', logoUrl: logo, activeUsers: 18, queuedCount: 7, venueSlug: 'repitela' }

export const Abierto = { args: { ...args, open: true }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
export const Cerrado = { args: { ...args, open: false }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
