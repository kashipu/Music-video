import AdminSidebar from './AdminSidebar.vue'
import logoSobreOscuro from '../assets/logo-color-negativo.svg'
import logoSobreClaro from '../assets/logo-color-positivo.svg'

// Las variantes a color conservan el rojo del isotipo, pero no se auto-invierten:
// hay que elegir la del fondo. El ?? 'dark' evita que un global ausente la de
// vuelta en silencio, que ya paso dos veces.
const logoFor = (mode) => (mode === 'dark' ? logoSobreOscuro : logoSobreClaro)

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
    setup: () => ({ args: { ...args, open, logoUrl: logoFor(globals.mode ?? 'dark') } }),
    template: '<AdminSidebar v-bind="args" />',
  }),
})

export const Abierto = story(true)
export const Cerrado = story(false)
