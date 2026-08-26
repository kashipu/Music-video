import { ref, onMounted, onUnmounted } from 'vue'

const COLOR_TOKENS = [
  '--color-background',
  '--color-surface',
  '--color-surface-elevated',
  '--color-border',
  '--color-text',
  '--color-text-muted',
  '--color-primary',
  '--color-on-primary',
  '--color-secondary',
  '--color-accent',
  '--color-link',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--danger',
  '--color-info',
  '--color-focus',
  '--color-disabled',
]

const RADIUS_TOKENS = [
  '--radius-sm',
  '--radius',
  '--radius-lg',
]

const TYPOGRAPHY_SCALES = [
  { name: 'Display / Hero', font: 'Plus Jakarta Sans', size: '24px', weight: '700', sample: 'Repítela Music Video', isDisplay: true },
  { name: 'Body / Input', font: 'Inter', size: '16px', weight: '400', sample: 'Texto base de la aplicación y campos de formulario', isDisplay: false },
  { name: 'Button / Action', font: 'Inter', size: '15px', weight: '600', sample: 'Guardar cambios / Enviar canción', isDisplay: false },
  { name: 'Section Title / Label', font: 'Inter', size: '13px', weight: '600', sample: 'TÍTULO DE SECCIÓN', isDisplay: false, uppercase: true, tracking: '0.5px' },
  { name: 'Caption / Muted', font: 'Inter', size: '11px', weight: '600', sample: 'Información complementaria y badges', isDisplay: false },
]

export default {
  title: 'Foundations',
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

export const Foundations = {
  render: () => ({
    setup() {
      const computedValues = ref({})

      function updateComputedValues() {
        const rootStyle = getComputedStyle(document.documentElement)
        const values = {}
        COLOR_TOKENS.forEach(token => {
          values[token] = rootStyle.getPropertyValue(token).trim()
        })
        RADIUS_TOKENS.forEach(token => {
          values[token] = rootStyle.getPropertyValue(token).trim()
        })
        computedValues.value = values
      }

      let observer = null

      onMounted(() => {
        updateComputedValues()
        observer = new MutationObserver(() => {
          updateComputedValues()
        })
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme', 'data-venue-theme', 'style', 'class'],
        })
      })

      onUnmounted(() => {
        if (observer) observer.disconnect()
      })

      return {
        COLOR_TOKENS,
        RADIUS_TOKENS,
        TYPOGRAPHY_SCALES,
        computedValues,
      }
    },
    template: `
      <main style="padding: 2.5rem; background: var(--color-background); color: var(--color-text); min-height: 100vh; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; box-sizing: border-box;">
        <header style="margin-bottom: 2.5rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1.5rem;">
          <h1 style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: var(--color-text);">Foundations & Design Tokens</h1>
          <p style="margin: 0; color: var(--color-text-muted); font-size: 15px;">Tokens fundamentales de color, radios y tipografía vinculados al tema activo.</p>
        </header>

        <!-- SECCIÓN 1: COLORES -->
        <section style="margin-bottom: 3.5rem;">
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 1rem 0; color: var(--color-text); display: flex; align-items: center; gap: 8px;">
            <span>🎨</span> Colores (CSS Variables)
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
            <div
              v-for="token in COLOR_TOKENS"
              :key="token"
              style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius, 12px); padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
            >
              <div
                :style="{
                  background: 'var(' + token + ')',
                  height: '60px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }"
              >
                <span v-if="!computedValues[token]" style="background: rgba(239, 68, 68, 0.9); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                  MISSING TOKEN
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden;">
                <code style="font-family: monospace; font-size: 13px; font-weight: 600; color: var(--color-text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  {{ token }}
                </code>
                <span :style="{ fontSize: '12px', color: computedValues[token] ? 'var(--color-text-muted)' : '#ef4444', fontFamily: 'monospace' }">
                  {{ computedValues[token] || 'No computado / indefinido' }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- SECCIÓN 2: RADIOS -->
        <section style="margin-bottom: 3.5rem;">
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 1rem 0; color: var(--color-text); display: flex; align-items: center; gap: 8px;">
            <span>📐</span> Radios de Borde
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
            <div
              v-for="token in RADIUS_TOKENS"
              :key="token"
              style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius, 12px); padding: 16px; display: flex; align-items: center; gap: 16px;"
            >
              <div
                :style="{
                  borderRadius: 'var(' + token + ')',
                  width: '64px',
                  height: '64px',
                  background: 'var(--color-primary)',
                  border: '2px solid var(--color-border)',
                  flexShrink: 0
                }"
              ></div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <code style="font-family: monospace; font-size: 14px; font-weight: 600; color: var(--color-text);">
                  {{ token }}
                </code>
                <span style="font-size: 13px; color: var(--color-text-muted); font-family: monospace;">
                  {{ computedValues[token] || 'No computado' }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- SECCIÓN 3: TIPOGRAFÍA -->
        <section>
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 1rem 0; color: var(--color-text); display: flex; align-items: center; gap: 8px;">
            <span>🔤</span> Escala Tipográfica y Fuentes
          </h2>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div
              v-for="item in TYPOGRAPHY_SCALES"
              :key="item.name"
              style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius, 12px); padding: 16px 20px; display: flex; flex-direction: column; gap: 8px;"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">
                <span style="font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                  {{ item.name }} · {{ item.font }} ({{ item.size }} / weight {{ item.weight }})
                </span>
              </div>
              <div
                :style="{
                  fontFamily: item.isDisplay ? '\\'Plus Jakarta Sans\\', sans-serif' : '\\'Inter\\', -apple-system, sans-serif',
                  fontSize: item.size,
                  fontWeight: item.weight,
                  textTransform: item.uppercase ? 'uppercase' : 'none',
                  letterSpacing: item.tracking || 'normal',
                  color: 'var(--color-text)'
                }"
              >
                {{ item.sample }}
              </div>
            </div>
          </div>
        </section>
      </main>
    `,
  }),
}
