import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const sourceRoot = path.resolve(process.cwd(), 'src')

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    return /\.(vue|js)$/.test(entry.name) ? [file] : []
  })
}

describe('RepitelaLogo', () => {
  it('centraliza los SVG de marca fuera de las stories', () => {
    for (const file of sourceFiles(sourceRoot)) {
      if (file.endsWith('RepitelaLogo.vue') || file.endsWith('.stories.js') || file.endsWith('.spec.js')) continue
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(/logo-color-(positivo|negativo)\.svg/)
    }
  })
})
