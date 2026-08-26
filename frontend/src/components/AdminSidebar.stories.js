import AdminSidebar from './AdminSidebar.vue'
// Monocromo oscuro a proposito: VenueLogo lo detecta y lo invierte solo en
// tema oscuro, asi que sirve en los dos modos sin depender del toolbar.
import logo from '../assets/logo-negativo.svg'

export default {
  title: 'Components/AdminSidebar', component: AdminSidebar,
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

const args = { venueName: 'Repítela', activeUsers: 18, queuedCount: 7, venueSlug: 'repitela' }
export const Abierto = { args: { ...args, logoUrl: logo, open: true }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
export const Cerrado = { args: { ...args, logoUrl: logo, open: false }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
