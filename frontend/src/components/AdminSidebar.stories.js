import AdminSidebar from './AdminSidebar.vue'
import logoNegativo from '../assets/logo-color-negativo.svg'
import logoPositivo from '../assets/logo-color-positivo.svg'

// "negativo" es la variante para fondo oscuro.
const logoFor = (mode) => (mode === 'dark' ? logoNegativo : logoPositivo)

export default {
  title: 'Components/AdminSidebar', component: AdminSidebar,
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

const args = { venueName: 'Repítela', activeUsers: 18, queuedCount: 7, venueSlug: 'repitela' }
const story = (open) => ({
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: (_, { globals }) => ({
    components: { AdminSidebar },
    setup: () => ({ args: { ...args, open, logoUrl: logoFor(globals.mode) } }),
    template: '<AdminSidebar v-bind="args" />',
  }),
})

export const Abierto = story(true)
export const Cerrado = story(false)
