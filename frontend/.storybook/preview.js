import '../src/style.css'
import { setup } from '@storybook/vue3'
import { THEME_PRESETS } from '../src/constants/themePresets.js'
import { useTheme } from '../src/composables/useTheme.js'
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
  // initialGlobals y no defaultValue: defaultValue dentro de globalTypes esta
  // removido desde Storybook 8, y sin el globals.mode llega undefined.
  initialGlobals: { venueTheme: 'default', mode: 'dark' },
  globalTypes: {
    venueTheme: {
      toolbar: { items: [{ value: 'default', title: 'Default' }, ...Object.entries(venueThemes).map(([value, title]) => ({ value, title }))] },
    },
    mode: {
      toolbar: { items: modes },
    },
  },
  decorators: [
    (story, { globals: { venueTheme, mode } }) => {
      // applyMode y no setAttribute: los componentes que llaman useTheme()
      // (AuthLoginForm, AuthSplitLayout...) reescriben data-theme al montar
      // desde su propio ref. Hay que mover el ref, no solo el atributo.
      useTheme().applyMode(mode)
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
