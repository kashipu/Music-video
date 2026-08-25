import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { THEME_PRESETS } from '../constants/themePresets.js'

// Simple mock DOM for node environment
const attributes = {}
globalThis.document = {
  createElement: () => ({
    setAttribute: () => {},
    getAttribute: () => null,
    style: {}
  }),
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  documentElement: {
    setAttribute: (k, v) => { attributes[k] = v },
    getAttribute: (k) => attributes[k] ?? null,
    removeAttribute: (k) => { delete attributes[k] },
    style: {
      setProperty: () => {},
      getPropertyValue: () => '',
      removeProperty: () => {}
    }
  }
}

const storage = {}
globalThis.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = String(v) },
  removeItem: (k) => { delete storage[k] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) }
}

const { useTheme } = await import('./useTheme.js')

describe('THEME_PRESETS', () => {
  it('has 12 presets and all of them have tokens defined', () => {
    expect(THEME_PRESETS).toHaveLength(12)
    THEME_PRESETS.forEach(preset => {
      expect(preset.tokens).toBeDefined()
      expect(typeof preset.tokens).toBe('string')
      expect(preset.tokens.length).toBeGreaterThan(0)
    })
  })

  it('has corresponding CSS files for all unique tokens', () => {
    const uniqueTokens = [...new Set(THEME_PRESETS.map(p => p.tokens))]
    uniqueTokens.forEach(token => {
      const cssPath = path.resolve(process.cwd(), `src/themes/${token}.css`)
      expect(fs.existsSync(cssPath), `CSS file missing for token ${token}`).toBe(true)
      const cssContent = fs.readFileSync(cssPath, 'utf8')
      expect(cssContent).toContain(`[data-venue-theme="${token}"]`)
      expect(cssContent).toContain(`[data-venue-theme="${token}"][data-theme="dark"]`)
    })
  })
})

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-venue-theme')
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
  })

  it('applies mode and venue theme tokens without runtime derivation', () => {
    const { applyVenueTheme, currentMode } = useTheme()
    
    applyVenueTheme({
      theme: {
        preset: 'purple-night',
        tokens: 'purple-night',
        mode: 'dark'
      }
    })

    expect(document.documentElement.getAttribute('data-venue-theme')).toBe('purple-night')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(currentMode.value).toBe('dark')
  })

  it('toggles mode properly between dark and light', () => {
    const { toggleMode, applyMode, currentMode } = useTheme()
    applyMode('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    
    toggleMode()
    expect(currentMode.value).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    toggleMode()
    expect(currentMode.value).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('clears venue theme properly', () => {
    const { applyVenueTheme, clearVenueTheme } = useTheme()
    applyVenueTheme({
      theme: {
        preset: 'craft-dark',
        tokens: 'craft',
        mode: 'dark'
      }
    })
    expect(document.documentElement.getAttribute('data-venue-theme')).toBe('craft')

    clearVenueTheme()
    expect(document.documentElement.getAttribute('data-venue-theme')).toBeNull()
  })
})
