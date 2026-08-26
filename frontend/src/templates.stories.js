import { provide, ref } from 'vue'
import { THEME_PRESETS } from './constants/themePresets.js'
import AuthSplitLayout from './components/AuthSplitLayout.vue'
import AuthLoginForm from './components/AuthLoginForm.vue'
import NowPlaying from './components/NowPlaying.vue'
import SongSubmit from './components/SongSubmit.vue'
import QueueList from './components/QueueList.vue'
import VenueActivityPanel from './components/VenueActivityPanel.vue'
import VenueLimitsForm from './components/VenueLimitsForm.vue'
import VenueBillingPanel from './components/VenueBillingPanel.vue'
import Badge from './components/ui/Badge.vue'
import Button from './components/ui/Button.vue'

const nowPlaying = { title: 'Baila conmigo', duration_sec: 198, added_by: 'Mesa 4', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg' }
const queue = [
  { id: 1, position: 1, title: 'Tití Me Preguntó', added_by: 'Ana', table_number: 3, duration_sec: 244, thumbnail_url: 'https://i.ytimg.com/vi/Cr8K88UcO0s/default.jpg' },
  { id: 2, position: 2, title: 'Ojitos Lindos', added_by: 'Luis', table_number: 7, duration_sec: 258, thumbnail_url: 'https://i.ytimg.com/vi/Cr8K88UcO0s/default.jpg' },
]
const activity = { bestDay: { date: '2026-08-23', people: 48 }, dailyAnalytics: { days: [{ date: '2026-08-19', people: 12 }, { date: '2026-08-20', people: 31 }, { date: '2026-08-21', people: 22 }, { date: '2026-08-23', people: 48 }] } }
const billingDetail = {
  billing: {
    status: 'active', days_remaining: 18, period_start: '2026-08-09', period_end: '2026-09-13',
    totals: [{ source: 'wompi', amount_cents: 4900000, count: 1 }, { source: 'manual', amount_cents: 9800000, count: 2 }],
    history: [
      { id: 1, kind: 'payment', source: 'manual', amount_cents: 4900000, days: 30, status: 'confirmed', created_at: '2026-08-09', period_start: '2026-08-09', period_end: '2026-09-08', created_by_username: 'William', notes: 'Transferencia confirmada' },
      { id: 2, kind: 'adjustment', source: 'manual', days: 5, status: 'confirmed', created_at: '2026-08-10', created_by_username: 'William', notes: 'Cortesía por mantenimiento' },
    ],
  },
}

const loginTemplate = `
  <AuthSplitLayout :style="compact ? 'min-height:auto;padding:16px 12px;align-items:flex-start' : ''">
    <AuthLoginForm v-model:username="username" v-model:password="password" title="Repítela" subtitle="Ingresa para administrar tu bar" :show-google="!compact" @submit="submit">
      <template #footer><a href="#">¿Olvidaste tu contraseña?</a></template>
    </AuthLoginForm>
  </AuthSplitLayout>
`

function loginStory(compact = false) {
  return () => ({
    components: { AuthSplitLayout, AuthLoginForm },
    setup: () => ({ compact, username: ref('admin'), password: ref(''), submit: () => {} }),
    template: loginTemplate,
  })
}

export default { title: 'Plantillas' }

export const Login = { render: loginStory() }

export const PantallaCliente = {
  render: () => ({
    components: { NowPlaying, SongSubmit, QueueList },
    setup: () => ({ nowPlaying, queue, rateLimit: { max_songs: 5, songs_remaining: 3 } }),
    template: `
      <main style="min-height:100vh;padding:24px 16px;background:var(--bg);color:var(--text)">
        <div class="container"><NowPlaying :song="nowPlaying" /><SongSubmit :rate-limit="rateLimit" /><QueueList :songs="queue" :total="queue.length" /></div>
      </main>
    `,
  }),
}

export const PanelDelBar = {
  render: () => ({
    components: { VenueActivityPanel, VenueLimitsForm, VenueBillingPanel, Badge, Button },
    setup() {
      provide('venueDetail', { detail: ref(billingDetail), refresh: async () => {} })
      return { ...activity, duration: ref(600), songs: ref(3), window: ref(20) }
    },
    template: `
      <main style="min-height:100vh;padding:24px 16px;background:var(--bg);color:var(--text)">
        <div style="max-width:960px;margin:auto;display:grid;gap:16px">
          <header style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><h1 style="font-size:24px">Repítela</h1><p style="color:var(--text-muted);margin-top:4px">Configuración del bar</p></div><Badge variant="success">Activo</Badge></header>
          <VenueActivityPanel :best-day="bestDay" :daily-analytics="dailyAnalytics" />
          <section class="card"><p class="section-title">LÍMITES DE PEDIDOS</p><VenueLimitsForm v-model:max-duration-sec="duration" v-model:max-songs="songs" v-model:window-minutes="window" /><div style="margin-top:16px;max-width:220px"><Button>Guardar cambios</Button></div></section>
          <VenueBillingPanel />
        </div>
      </main>
    `,
  }),
}

export const TodosLosTemas = {
  render: (_, { globals }) => ({
    components: { AuthSplitLayout, AuthLoginForm },
    setup: () => ({ themes: THEME_PRESETS, mode: globals.mode, username: ref('admin'), password: ref(''), submit: () => {} }),
    template: `
      <main style="padding:24px;background:var(--bg);color:var(--text)">
        <p style="margin:0 0 16px;color:var(--text-muted);font-size:13px">Los 12 temas de bar. El tema default de Repítela no entra en la grilla: <code>default.css</code> declara sus alias en <code>:root</code>, así que no se puede scopear a un contenedor — miralo en la story <b>Login</b> con el toolbar en Default.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
          <section v-for="theme in themes" :key="theme.id" :data-venue-theme="theme.tokens" :data-theme="mode" style="overflow:hidden;border:1px solid var(--border);border-radius:var(--radius);background:var(--color-background);color:var(--color-text)">
            <h2 style="padding:12px 16px;font-size:14px;background:var(--color-surface);border-bottom:1px solid var(--color-border)">{{ theme.name }}</h2>
            <AuthSplitLayout style="min-height:auto;padding:16px 12px;align-items:flex-start">
              <AuthLoginForm v-model:username="username" v-model:password="password" title="Repítela" subtitle="Ingresa para administrar tu bar" @submit="submit">
                <template #footer><a href="#">¿Olvidaste tu contraseña?</a></template>
              </AuthLoginForm>
            </AuthSplitLayout>
          </section>
        </div>
      </main>
    `,
  }),
}
