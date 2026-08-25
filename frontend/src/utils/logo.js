/**
 * Los logos SVG que suben los bares son monocromos en negro: sobre fondo oscuro
 * se invierten a blanco. Un PNG/JPG a color NO debe invertirse (quedaría en
 * negativo), por eso la clase adaptativa solo aplica a SVG.
 */
export function isSvgLogo(url) {
  if (!url) return false
  return /\.svg(\?|#|$)/i.test(url) || url.startsWith('data:image/svg+xml')
}
