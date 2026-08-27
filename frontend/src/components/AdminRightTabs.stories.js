import AdminRightTabs from './AdminRightTabs.vue'

export default {
  title: 'Admin/AdminRightTabs',
  component: AdminRightTabs,
  tags: ['autodocs'],
  argTypes: {
    modelValue: {
      control: 'select',
      options: ['music', 'tables', 'analytics'],
    },
    'onUpdate:modelValue': { action: 'update:modelValue' },
    onChange: { action: 'change' },
  },
}

export const TabMusica = {
  args: {
    modelValue: 'music',
  },
}

export const TabMesas = {
  args: {
    modelValue: 'tables',
  },
}

export const TabAnalytics = {
  args: {
    modelValue: 'analytics',
  },
}
