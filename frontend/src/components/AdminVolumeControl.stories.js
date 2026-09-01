import AdminVolumeControl from './AdminVolumeControl.vue'

export default {
  title: 'Admin/AdminVolumeControl',
  component: AdminVolumeControl,
  tags: ['autodocs'],
  argTypes: {
    volume: { control: { type: 'range', min: 0, max: 100 } },
    muted: { control: 'boolean' },
    'onUpdate:volume': { action: 'update:volume' },
    onChange: { action: 'change' },
    onToggleMute: { action: 'toggle-mute' },
  },
}

export const Alto = {
  args: {
    volume: 85,
    muted: false,
  },
}

export const Medio = {
  args: {
    volume: 45,
    muted: false,
  },
}

export const Silenciado = {
  args: {
    volume: 0,
    muted: true,
  },
}
