import VenueLogo from './VenueLogo.vue'
import colorSobreClaro from '../assets/logo-color-sobre-claro.svg'
import colorSobreOscuro from '../assets/logo-color-sobre-oscuro.svg'
import sobreClaro from '../assets/logo-sobre-claro.svg'
import sobreOscuro from '../assets/logo-sobre-oscuro.svg'

export default { title: 'Components/VenueLogo', component: VenueLogo }

const VARIANTS = [
  { src: colorSobreOscuro, name: 'logo-color-sobre-oscuro.svg', use: 'A color, para fondo oscuro (la que usa el login en dark)' },
  { src: colorSobreClaro, name: 'logo-color-sobre-claro.svg', use: 'A color, para fondo claro (la que usa el login en light)' },
  { src: sobreOscuro, name: 'logo-sobre-oscuro.svg', use: 'Monocromo blanco, para fondo oscuro' },
  { src: sobreClaro, name: 'logo-sobre-claro.svg', use: 'Monocromo negro, para fondo claro' },
]

export const Variantes = {
  render: () => ({
    components: { VenueLogo },
    setup: () => ({ VARIANTS }),
    template: `
      <div style="display:grid;gap:16px;padding:24px;background:var(--color-background)">
        <div v-for="v in VARIANTS" :key="v.name"
             style="display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:center;padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius,12px)">
          <VenueLogo :src="v.src" style="max-width:200px" />
          <div>
            <code style="color:var(--color-text);font-size:13px">{{ v.name }}</code>
            <p style="margin:4px 0 0;color:var(--color-text-muted);font-size:13px">{{ v.use }}</p>
          </div>
        </div>
      </div>
    `,
  }),
}

export const VariantesPorTema = {
  args: { srcLight: colorSobreClaro, srcDark: colorSobreOscuro },
  parameters: { layout: 'centered' },
}

// El kiosk va siempre sobre negro, sin importar el tema del bar.
export const KioskAlwaysDark = {
  render: () => ({
    components: { VenueLogo },
    setup: () => ({ src: colorSobreOscuro }),
    template: '<div style="padding:40px;background:#000"><VenueLogo :src="src" always-dark style="max-width:280px" /></div>',
  }),
}

// Sin src el componente no renderiza nada: el llamador decide el fallback.
export const SinLogo = { args: { src: '' } }
