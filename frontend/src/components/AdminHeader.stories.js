import AdminHeader from './AdminHeader.vue'
import logo from '../assets/logo-color-negativo.svg'

export default { title: 'Components/AdminHeader', component: AdminHeader }

export const ConLogo = { args: { venueName: 'Repítela', logoUrl: logo } }
export const SinLogo = { args: { venueName: 'Repítela', logoUrl: '' } }
