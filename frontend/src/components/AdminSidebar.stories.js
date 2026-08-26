import AdminSidebar from './AdminSidebar.vue'
import logo from '../assets/logo-color-negativo.svg'

export default {
  title: 'Components/AdminSidebar', component: AdminSidebar,
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

const args = { venueName: 'Repítela', logoUrl: logo, activeUsers: 18, queuedCount: 7, venueSlug: 'repitela' }

export const Abierto = { args: { ...args, open: true }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
export const Cerrado = { args: { ...args, open: false }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
