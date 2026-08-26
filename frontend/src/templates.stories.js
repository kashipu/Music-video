import { computed, provide, ref } from 'vue'
import { THEME_PRESETS } from './constants/themePresets.js'
import logoColorPositivo from './assets/logo-color-positivo.svg'
import logoVenue from './assets/logo-negativo.svg'
import logoColorNegativo from './assets/logo-color-negativo.svg'
import AuthSplitLayout from './components/AuthSplitLayout.vue'
import AuthLoginForm from './components/AuthLoginForm.vue'
import NowPlaying from './components/NowPlaying.vue'
import SongSubmit from './components/SongSubmit.vue'
import QueueList from './components/QueueList.vue'
import VenueActivityPanel from './components/VenueActivityPanel.vue'
import VenueLimitsForm from './components/VenueLimitsForm.vue'
import VenueBillingPanel from './components/VenueBillingPanel.vue'
import AdminHeader from './components/AdminHeader.vue'
import AdminSidebar from './components/AdminSidebar.vue'
import SuperAdminHeader from './components/SuperAdminHeader.vue'
import Badge from './components/ui/Badge.vue'
import Button from './components/ui/Button.vue'
import Input from './components/ui/Input.vue'

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

export default {
  title: 'Plantillas',
  // Barra/pagina a ancho completo: el padding de .sb-main-padded le
  // inventa un margen que en la app no existe.
  parameters: { layout: 'fullscreen' },
}

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

export const PanelAdmin = {
  render: () => ({
    components: { AdminHeader, AdminSidebar, NowPlaying, QueueList },
    setup: () => ({
      // Monocromo oscuro: VenueLogo lo invierte solo en tema oscuro.
      logo: logoVenue,
      nowPlaying,
      queue,
    }),
    template: `
      <div style="min-height:100vh;background:var(--bg);color:var(--text)">
        <AdminHeader venue-name="Repítela" />
        <div style="display:grid;grid-template-columns:320px minmax(0,1fr);gap:20px;max-width:1200px;margin:auto;padding:16px">
          <AdminSidebar venue-name="Repítela" :logo-url="logo" :active-users="18" :queued-count="queue.length" venue-slug="repitela" />
          <main style="display:flex;flex-direction:column;gap:14px;min-width:0">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span style="padding:6px 14px;border-radius:20px;background:var(--success-soft);border:1px solid var(--success);color:var(--success);font-size:12px;font-weight:700">● SONANDO USUARIO</span>
              <span style="padding:6px 14px;border-radius:20px;background:var(--bg-card);border:1px solid var(--border);font-size:13px"><strong>{{ queue.length }}</strong> en cola</span>
              <span style="padding:6px 14px;border-radius:20px;background:var(--bg-card);border:1px solid var(--border);font-size:13px">Conectado</span>
            </div>
            <NowPlaying :song="nowPlaying" />
            <section class="card" style="padding:14px 16px">
              <p class="section-title">VOLUMEN</p>
              <div style="display:flex;align-items:center;gap:12px"><button class="btn btn-secondary" style="width:auto">Volumen</button><input type="range" min="0" max="100" value="80" style="flex:1"><strong>80%</strong></div>
            </section>
            <QueueList :songs="queue" :total="queue.length" />
          </main>
        </div>
      </div>
    `,
  }),
}

export const PanelSuperAdmin = {
  render: () => ({
    components: { SuperAdminHeader, Input, Button },
    setup() {
      const selectedPeriod = ref('today')
      const filter = ref('all')
      const search = ref('')
      const venues = [{ id: 1, name: 'Repítela', active: true, on_trial: false, payment_status: 'active', last_admin_login: 'Hoy', last_used_at: 'Hoy', days_remaining: 18 }]
      const filteredVenues = computed(() => venues.filter((venue) => {
        const matchesSearch = venue.name.toLowerCase().includes(search.value.trim().toLowerCase())
        const matchesFilter = filter.value === 'all' || (filter.value === 'active' && venue.active) || (filter.value === 'trial' && venue.on_trial) || (filter.value === 'overdue' && venue.payment_status === 'overdue')
        return matchesSearch && matchesFilter
      }))
      return { selectedPeriod, filter, search, filteredVenues }
    },
    template: `
      <div style="min-height:100vh;background:var(--bg);color:var(--text)">
        <SuperAdminHeader title="Repítela" badge="Administración" />
        <main style="max-width:1100px;margin:auto;padding:24px">
          <section aria-label="Indicadores de la plataforma" style="margin:-24px -24px 24px;padding:16px 24px;background:var(--bg-card);border-bottom:1px solid var(--border)">
            <div role="tablist" aria-label="Periodo de indicadores" style="display:flex;gap:4px;margin-bottom:12px">
              <button v-for="period in [{ key: 'today', label: 'Hoy' }, { key: 'week', label: 'Semana' }, { key: 'month', label: 'Mes' }]" :key="period.key" role="tab" :aria-selected="selectedPeriod === period.key" @click="selectedPeriod = period.key" :style="selectedPeriod === period.key ? 'padding:6px 12px;border:0;border-radius:var(--radius);background:var(--primary);color:var(--text-on-primary)' : 'padding:6px 12px;border:0;border-radius:var(--radius);background:transparent;color:var(--text-muted)'">{{ period.label }}</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px">
              <article v-for="indicator in [{ value: 4, label: 'Admins en línea' }, { value: 38, label: 'Usuarios en línea' }, { value: 12, label: 'Canciones en cola' }, { value: 1, label: 'Bares activos' }, { value: 0, label: 'Bares próximos a vencer' }]" :key="indicator.label" style="display:flex;flex-direction:column;padding:12px;border:1px solid var(--border-soft);border-radius:var(--radius);background:var(--bg-card);color:var(--text-muted)"><strong style="color:var(--text);font-size:24px;line-height:1">{{ indicator.value }}</strong><span style="margin-top:6px;font-size:13px">{{ indicator.label }}</span></article>
            </div>
          </section>
          <Input v-model="search" type="search" placeholder="Buscar bar por nombre..." aria-label="Buscar bar por nombre" />
          <div aria-label="Filtrar bares por estado" style="display:flex;gap:8px;margin:12px 0 20px;overflow-x:auto">
            <button v-for="pill in [{ key: 'active', label: 'Activos' }, { key: 'trial', label: 'En prueba' }, { key: 'overdue', label: 'Vencidos' }, { key: 'upcoming', label: 'Próximos a vencer' }, { key: 'paid-today', label: 'Pagos hoy' }]" :key="pill.key" :aria-pressed="filter === pill.key" @click="filter = filter === pill.key ? 'all' : pill.key" :style="filter === pill.key ? 'padding:7px 12px;border:1px solid var(--primary);border-radius:999px;background:var(--primary);color:var(--text-on-primary)' : 'padding:7px 12px;border:1px solid var(--border-soft);border-radius:999px;background:var(--bg-card);color:var(--text-muted)'">{{ pill.label }}</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px"><h2 style="font-size:18px">Listado</h2><Button style="width:auto">+ Crear bar</Button></div>
          <section style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
            <article v-for="venue in filteredVenues" :key="venue.id" style="display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid var(--border-soft);border-radius:var(--radius);background:var(--bg-card)">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong style="font-size:17px">{{ venue.name }}</strong><span style="padding:2px 7px;border:1px solid var(--success);border-radius:999px;color:var(--success);font-size:11px;font-weight:600">Pago</span></div>
              <p style="display:flex;justify-content:space-between;font-size:14px"><span style="color:var(--text-muted)">Último log admin</span>{{ venue.last_admin_login }}</p>
              <p style="display:flex;justify-content:space-between;font-size:14px"><span style="color:var(--text-muted)">Último log usuario</span>{{ venue.last_used_at }}</p>
              <p style="display:flex;justify-content:space-between;font-size:14px"><span style="color:var(--text-muted)">Días restantes</span><strong>{{ venue.days_remaining }}</strong></p>
              <Button style="width:auto;align-self:flex-start">Ver detalle</Button>
            </article>
            <p v-if="!filteredVenues.length" style="color:var(--text-muted);text-align:center">No hay bares en este filtro.</p>
          </section>
        </main>
      </div>
    `,
  }),
}

// AuthSplitLayout y el logo por defecto de AuthLoginForm leen useTheme(), que
// mira <html>: en una grilla donde cada celda tiene su propio data-theme se
// quedarian con el modo global (toggle inutil y logo blanco sobre blanco).
// Por eso la celda arma el fondo a mano y pasa el logo explicito.
const CELDA_FONDO = 'background-color:var(--color-background);background-image:radial-gradient(ellipse 80% 50% at 50% 85%, var(--warning-soft) 0%, var(--primary-soft) 55%, transparent 75%),radial-gradient(circle at 50% 95%, var(--primary-soft) 0%, transparent 60%);background-repeat:no-repeat'
const logoFor = (mode) => (mode === 'dark' ? logoColorNegativo : logoColorPositivo)

export const TodosLosTemas = {
  render: () => ({
    components: { AuthLoginForm },
    setup: () => ({
      // Cada celda va en SU modo, no en el del toolbar: craft-dark y craft-light
      // comparten tokens ('craft') y solo los separa data-theme.
      grupos: [
        { titulo: 'Temas oscuros', mode: 'dark', logo: logoFor('dark'), themes: THEME_PRESETS.filter((t) => t.mode === 'dark') },
        { titulo: 'Temas claros', mode: 'light', logo: logoFor('light'), themes: THEME_PRESETS.filter((t) => t.mode === 'light') },
      ],
      fondo: CELDA_FONDO,
      username: ref('admin'),
      password: ref(''),
      submit: () => {},
    }),
    template: `
      <main style="padding:24px;background:var(--bg);color:var(--text)">
        <p style="margin:0 0 20px;color:var(--text-muted);font-size:13px">Los 12 temas de bar, cada uno en el modo para el que fue diseñado. El tema default de Repítela no entra en la grilla: <code>default.css</code> declara sus alias en <code>:root</code>, así que no se puede scopear a un contenedor — miralo en la story <b>Login</b> con el toolbar en Default.</p>
        <section v-for="grupo in grupos" :key="grupo.titulo" style="margin-bottom:32px">
          <h2 style="font-size:15px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">{{ grupo.titulo }} <span style="color:var(--text-muted);font-weight:400">({{ grupo.themes.length }})</span></h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
            <article v-for="theme in grupo.themes" :key="theme.id" :data-venue-theme="theme.tokens" :data-theme="grupo.mode" style="overflow:hidden;border:1px solid var(--color-border);border-radius:var(--radius);background:var(--color-background);color:var(--color-text)">
              <h3 style="padding:12px 16px;font-size:14px;font-weight:600;background:var(--color-surface);border-bottom:1px solid var(--color-border)">{{ theme.name }}</h3>
              <div :style="fondo" style="padding:20px 16px">
                <div class="card" style="padding:24px 20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg)">
                  <AuthLoginForm v-model:username="username" v-model:password="password" title="Repítela" subtitle="Ingresa para administrar tu bar" :logo-url="grupo.logo" @submit="submit">
                    <template #footer><a href="#">¿Olvidaste tu contraseña?</a></template>
                  </AuthLoginForm>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
    `,
  }),
}
