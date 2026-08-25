import { ref } from 'vue'

function safeGetItem(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private browsing */ }
}

const currentMode = ref(safeGetItem('bq_theme') || 'dark')

export function useTheme() {
  function applyMode(mode) {
    currentMode.value = mode
    document.documentElement.setAttribute('data-theme', mode)
    safeSetItem('bq_theme', mode)
  }

  function toggleMode() {
    const next = currentMode.value === 'dark' ? 'light' : 'dark'
    applyMode(next)
  }

  function applyVenueTheme(config) {
    if (!config) return
    let parsed = config
    if (typeof config === 'string') {
      try { parsed = JSON.parse(config) } catch { return }
    }
    const theme = parsed?.theme || parsed
    if (!theme) return

    if (theme.mode) applyMode(theme.mode)

    const tokenName = theme.tokens || theme.preset
    if (tokenName) {
      document.documentElement.setAttribute('data-venue-theme', tokenName)
    }
  }

  function clearVenueTheme() {
    document.documentElement.removeAttribute('data-venue-theme')
  }

  // Initialize
  document.documentElement.setAttribute('data-theme', currentMode.value)

  return { currentMode, applyMode, toggleMode, applyVenueTheme, clearVenueTheme }
}
