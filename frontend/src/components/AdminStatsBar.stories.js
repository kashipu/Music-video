import AdminStatsBar from './AdminStatsBar.vue'

export default {
  title: 'Admin/AdminStatsBar',
  component: AdminStatsBar,
  tags: ['autodocs'],
  argTypes: {
    playbackBadge: { control: 'object' },
    queueCount: { control: 'number' },
    totalDuration: { control: 'text' },
    wsState: { control: 'object' },
  },
}

export const SonandoUsuario = {
  args: {
    playbackBadge: { label: 'SONANDO USUARIO', cls: 'badge-user' },
    queueCount: 4,
    totalDuration: '14 min',
    wsState: { label: 'Conectado', cls: 'ws-ok', dotCls: 'ws-dot-ok' },
  },
}

export const SonandoPlaylist = {
  args: {
    playbackBadge: { label: 'SONANDO PLAYLIST', cls: 'badge-fallback' },
    queueCount: 0,
    totalDuration: '0 min',
    wsState: { label: 'Conectado', cls: 'ws-ok', dotCls: 'ws-dot-ok' },
  },
}

export const Pausado = {
  args: {
    playbackBadge: { label: 'PAUSADO', cls: 'badge-paused' },
    queueCount: 2,
    totalDuration: '7 min',
    wsState: { label: 'Conectado', cls: 'ws-ok', dotCls: 'ws-dot-ok' },
  },
}

export const Reconectando = {
  args: {
    playbackBadge: { label: 'SIN CONEXIÓN', cls: 'badge-offline' },
    queueCount: 3,
    totalDuration: '10 min',
    wsState: { label: 'Reconectando…', cls: 'ws-bad', dotCls: 'ws-dot-bad' },
  },
}
