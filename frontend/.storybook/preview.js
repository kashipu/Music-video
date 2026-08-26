import '../src/style.css'
import { setup } from '@storybook/vue3'
import { THEME_PRESETS } from '../src/constants/themePresets.js'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '../src/router/index.js'

import.meta.glob('../src/themes/*.css', { eager: true })

const modes = [...new Set(THEME_PRESETS.map(({ mode }) => mode))]
const venueThemes = Object.fromEntries(THEME_PRESETS.map(({ id, name }) => [id, name]))
// Pinia y el router se crean POR APP: Storybook monta una app nueva por story.
setup((app) => {
  app.use(createPinia())
  app.use(createRouter({
    history: createMemoryHistory(),
    // Las rutas reales de la app: sin ellas un <RouterLink :to="{ name }">
    // no resuelve y el componente revienta al montar.
    routes,
  }))
})

/** @type { import('@storybook/vue3-vite').Preview } */
const preview = {
  globalTypes: {
    venueTheme: {
      defaultValue: 'default',
      toolbar: { items: [{ value: 'default', title: 'Default' }, ...Object.entries(venueThemes).map(([value, title]) => ({ value, title }))] },
    },
    mode: {
      defaultValue: 'dark',
      toolbar: { items: modes },
    },
  },
  decorators: [
    (story, { globals: { venueTheme, mode } }) => {
      document.documentElement.setAttribute('data-theme', mode)
      const theme = THEME_PRESETS.find(({ id }) => id === venueTheme)
      if (theme) document.documentElement.setAttribute('data-venue-theme', theme.tokens)
      else document.documentElement.removeAttribute('data-venue-theme')
      return story()
    },
  ],
  parameters: {
    backgrounds: { disable: true },
  },
};

export default preview;
