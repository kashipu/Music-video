/**
 * Un logo monocromo oscuro (el caso típico: marca en negro) hay que invertirlo
 * a blanco sobre fondo oscuro; uno a color quedaría en negativo. El formato no
 * lo dice — hay PNG monocromos y SVG a color — así que se mira la imagen.
 */
export function isMonochromeDarkLogo(img) {
  try {
    const size = 32 // suficiente para decidir; evita leer imágenes grandes
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    let opaque = 0
    let colored = 0
    let luminanceSum = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 32) continue // transparente: no cuenta
      opaque++
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (Math.max(r, g, b) - Math.min(r, g, b) > 30) colored++
      luminanceSum += 0.299 * r + 0.587 * g + 0.114 * b
    }
    if (!opaque) return false
    const isMonochrome = colored / opaque < 0.1
    const isDark = luminanceSum / opaque < 110
    return isMonochrome && isDark
  } catch {
    // Canvas bloqueado (imagen de otro origen sin CORS): no invertir.
    return false
  }
}
