import AdminSidebar from './AdminSidebar.vue'
import logoSobreOscuro from '../assets/logo-color-negativo.svg'
import logoSobreClaro from '../assets/logo-color-positivo.svg'

export default {
  title: 'Components/AdminSidebar', component: AdminSidebar,
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

const args = { venueName: 'Repítela', activeUsers: 18, queuedCount: 7, venueSlug: 'repitela' }
const story = (open) => ({
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => ({
    components: { AdminSidebar },
    setup: () => ({ args: { ...args, open, logoUrlLight: logoSobreClaro, logoUrlDark: logoSobreOscuro } }),
    template: '<AdminSidebar v-bind="args" />',
  }),
})

export const Abierto = story(true)
export const Cerrado = story(false)
