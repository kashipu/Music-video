import { ref } from 'vue'

function safeGetItem(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSetItem(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private browsing */ }
}

const currentMode = ref(safeGetItem('bq_theme') || 'dark')
let lastVenueConfig = null

export function useTheme() {

  function applyMode(mode) {
    currentMode.value = mode
    document.documentElement.setAttribute('data-theme', mode)
    safeSetItem('bq_theme', mode)
  }

  function toggleMode() {
    clearVenueTheme()
    applyMode(currentMode.value === 'dark' ? 'light' : 'dark')
    // Re-apply venue accent/colors with the new mode
    if (lastVenueConfig) {
      const theme = lastVenueConfig
      if (theme.accent) applyAccent(theme.accent)
      if (theme.bg) {
        const el = document.documentElement
        el.style.setProperty('--bg', theme.bg)
        el.style.setProperty('--bg-card', adjustBrightness(theme.bg, currentMode.value === 'dark' ? 15 : -5))
        el.style.setProperty('--bg-elevated', adjustBrightness(theme.bg, currentMode.value === 'dark' ? 25 : -10))
        el.style.setProperty('--border', adjustBrightness(theme.bg, currentMode.value === 'dark' ? 40 : -25))
        const { r, g, b } = hexToRgb(theme.bg)
        el.style.setProperty('--border-soft', `rgba(${r}, ${g}, ${b}, 0.3)`)
      }
      if (theme.text) {
        document.documentElement.style.setProperty('--text', theme.text)
        document.documentElement.style.setProperty('--text-muted', adjustBrightness(theme.text, currentMode.value === 'dark' ? -80 : 80))
      }
    }
  }

  function applyVenueTheme(config) {
    if (!config) return
    let parsed = config
    if (typeof config === 'string') {
      try { parsed = JSON.parse(config) } catch { return }
    }
    const theme = parsed?.theme
    if (!theme) return

    lastVenueConfig = theme

    // Apply mode
    if (theme.mode) applyMode(theme.mode)

    // Apply accent
    if (theme.accent) applyAccent(theme.accent)

    // Apply custom bg/text if preset provides them
    if (theme.bg) {
      const el = document.documentElement
      el.style.setProperty('--bg', theme.bg)
      el.style.setProperty('--bg-card', adjustBrightness(theme.bg, theme.mode === 'dark' ? 15 : -5))
      el.style.setProperty('--bg-elevated', adjustBrightness(theme.bg, theme.mode === 'dark' ? 25 : -10))
      el.style.setProperty('--border', adjustBrightness(theme.bg, theme.mode === 'dark' ? 40 : -25))
      const { r, g, b } = hexToRgb(theme.bg)
      el.style.setProperty('--border-soft', `rgba(${r}, ${g}, ${b}, 0.3)`)
    }
    if (theme.text) {
      document.documentElement.style.setProperty('--text', theme.text)
      document.documentElement.style.setProperty('--text-muted', adjustBrightness(theme.text, theme.mode === 'dark' ? -80 : 80))
    }
  }

  function applyAccent(hex) {
    if (!hex || hex.length < 7) return
    const { r, g, b } = hexToRgb(hex)

    document.documentElement.style.setProperty('--primary', hex)
    document.documentElement.style.setProperty('--primary-dark', adjustBrightness(hex, -25))
    document.documentElement.style.setProperty('--primary-soft', `rgba(${r}, ${g}, ${b}, 0.15)`)
    document.documentElement.style.setProperty('--text-on-primary', getContrastText(hex))
    document.documentElement.style.setProperty('--secondary', adjustHue(hex, 180))
  }

  function clearVenueTheme() {
    const props = [
      '--primary', '--primary-dark', '--primary-soft', '--text-on-primary', '--secondary',
      '--bg', '--bg-card', '--bg-elevated', '--border', '--border-soft', '--text', '--text-muted',
    ]
    props.forEach(p => document.documentElement.style.removeProperty(p))
  }

  // Initialize
  document.documentElement.setAttribute('data-theme', currentMode.value)

  return { currentMode, applyMode, toggleMode, applyVenueTheme, applyAccent, clearVenueTheme }
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function adjustBrightness(hex, amount) {
  let { r, g, b } = hexToRgb(hex)
  r = Math.max(0, Math.min(255, r + amount))
  g = Math.max(0, Math.min(255, g + amount))
  b = Math.max(0, Math.min(255, b + amount))
  return rgbToHex(r, g, b)
}

function adjustHue(hex, degrees) {
  let { r, g, b } = hexToRgb(hex)
  let [h, s, l] = rgbToHsl(r, g, b)
  h = (h + degrees) % 360
  const [nr, ng, nb] = hslToRgb(h, s, l)
  return rgbToHex(nr, ng, nb)
}

function getContrastText(hex) {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

function rgbToHex(r, g, b) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break
      case g: h = ((b - r) / d + 2) * 60; break
      case b: h = ((r - g) / d + 4) * 60; break
    }
  }
  return [h, s, l]
}

function hslToRgb(h, s, l) {
  h /= 360
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}
