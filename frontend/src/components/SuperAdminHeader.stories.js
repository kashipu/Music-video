import SuperAdminHeader from './SuperAdminHeader.vue'

export default {
  title: 'Components/SuperAdminHeader', component: SuperAdminHeader,
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

export const Default = { args: { badge: 'Administración' } }
