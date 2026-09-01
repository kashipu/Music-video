import AdminHeader from './AdminHeader.vue'
import logo from '../assets/logo-color-sobre-oscuro.svg'

export default {
  title: 'Components/AdminHeader', component: AdminHeader,
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

export const ConLogo = { args: { venueName: 'Repítela', logoUrl: logo } }
export const SinLogo = { args: { venueName: 'Repítela', logoUrl: '' } }
