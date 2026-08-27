import VenueLogo from './VenueLogo.vue'
import colorPositivo from '../assets/logo-color-positivo.svg'
import colorNegativo from '../assets/logo-color-negativo.svg'
import positivo from '../assets/logo-positivo.svg'
import negativo from '../assets/logo-negativo.svg'

export default { title: 'Components/VenueLogo', component: VenueLogo }

// Ojo con los nombres: "negativo" es la variante PARA fondo oscuro (texto
// blanco) y "positivo" la de fondo claro (texto negro). Se leen al reves de
// lo que uno espera; asi las usa AuthLoginForm.vue segun currentMode.
const VARIANTS = [
  { src: colorNegativo, name: 'logo-color-negativo.svg', use: 'A color, para fondo oscuro (la que usa el login en dark)' },
  { src: colorPositivo, name: 'logo-color-positivo.svg', use: 'A color, para fondo claro (la que usa el login en light)' },
  { src: positivo, name: 'logo-positivo.svg', use: 'Monocromo blanco, para fondo oscuro' },
  { src: negativo, name: 'logo-negativo.svg', use: 'Monocromo negro, para fondo claro' },
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
  args: { srcLight: colorPositivo, srcDark: colorNegativo },
  parameters: { layout: 'centered' },
}

// El kiosk va siempre sobre negro, sin importar el tema del bar.
export const KioskAlwaysDark = {
  render: () => ({
    components: { VenueLogo },
    setup: () => ({ src: colorNegativo }),
    template: '<div style="padding:40px;background:#000"><VenueLogo :src="src" always-dark style="max-width:280px" /></div>',
  }),
}

// Sin src el componente no renderiza nada: el llamador decide el fallback.
export const SinLogo = { args: { src: '' } }
