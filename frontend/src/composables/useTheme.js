import { ref, watch } from 'vue'

const currentMode = ref(localStorage.getItem('bq_theme') || 'dark')

export function useTheme() {

  function applyMode(mode) {
    currentMode.value = mode
    document.documentElement.setAttribute('data-theme', mode)
    localStorage.setItem('bq_theme', mode)
  }

  function toggleMode() {
    applyMode(currentMode.value === 'dark' ? 'light' : 'dark')
  }

  function applyVenueTheme(config) {
    if (!config) return
    let parsed = config
    if (typeof config === 'string') {
      try { parsed = JSON.parse(config) } catch { return }
    }
    const theme = parsed?.theme
    if (!theme) return

    if (theme.primary) {
      document.documentElement.style.setProperty('--primary', theme.primary)
      // Generate soft version
      const r = parseInt(theme.primary.slice(1, 3), 16)
      const g = parseInt(theme.primary.slice(3, 5), 16)
      const b = parseInt(theme.primary.slice(5, 7), 16)
      document.documentElement.style.setProperty('--primary-soft', `rgba(${r}, ${g}, ${b}, 0.15)`)
      document.documentElement.style.setProperty('--primary-dark', adjustBrightness(theme.primary, -20))
    }

    if (theme.mode) {
      applyMode(theme.mode)
    }
  }

  function clearVenueTheme() {
    document.documentElement.style.removeProperty('--primary')
    document.documentElement.style.removeProperty('--primary-soft')
    document.documentElement.style.removeProperty('--primary-dark')
  }

  // Initialize
  document.documentElement.setAttribute('data-theme', currentMode.value)

  return { currentMode, applyMode, toggleMode, applyVenueTheme, clearVenueTheme }
}

function adjustBrightness(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16) + amount
  let g = parseInt(hex.slice(3, 5), 16) + amount
  let b = parseInt(hex.slice(5, 7), 16) + amount
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
