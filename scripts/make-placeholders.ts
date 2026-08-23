/**
 * Generate visible placeholder images for the demo archive.
 *
 * The demo is built from a redacted archive, so it cannot contain real
 * photographs. It still has to demonstrate what a gallery of 2,700 images
 * looks like, and 1x1 pixels stretched to fill a grid cell just look broken.
 *
 * These are deterministic per filename: the same file is always the same
 * image, so the demo does not shimmer between builds.
 */

import { deflateSync } from 'node:zlib'

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** FNV-1a, so an image is stable for a given filename. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * A soft two-tone gradient with a subtle grain, in the app's own palette
 * range. Reads as "placeholder" without reading as "error".
 */
export function placeholderPng(seed: string, width = 320, height = 320): Uint8Array {
  const size = width // kept for the gradient maths below
  void size
  const h = hash(seed)
  const hue = h % 360
  const angle = ((h >> 9) % 4) * (Math.PI / 4)
  const dx = Math.cos(angle), dy = Math.sin(angle)

  const raw = new Uint8Array(height * (width * 3 + 1))
  let p = 0
  for (let y = 0; y < height; y++) {
    raw[p++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      const t = ((x / width) * dx + (y / height) * dy + 1) / 2
      const l = 0.22 + t * 0.34
      const [r, g, b] = hsl(hue + t * 40, 0.18, l)
      // A little ordered noise so large flat areas do not band.
      const n = ((x * 7 + y * 13 + h) % 11) - 5
      raw[p++] = clamp(r + n)
      raw[p++] = clamp(g + n)
      raw[p++] = clamp(b + n)
    }
  }

  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // colour type: truecolour
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((s, part) => s + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

function hsl(hDeg: number, s: number, l: number): [number, number, number] {
  const hh = ((hDeg % 360) + 360) % 360 / 60
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x]
    : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}


// ------------------------------------------------------- plausible imagery

/**
 * Images for the demo archive.
 *
 * A grid of flat gradients reads as "failed to load". A developer's archive is
 * mostly screenshots, charts and phone photos, so these draw crude versions of
 * those three: at thumbnail size they read as content, which is the whole job.
 * Nothing here depicts anything real.
 */
export function placeholderImage(seed: string, width: number, height: number): Uint8Array {
  const h = hash(seed)
  const kind = h % 3 // 0 screenshot, 1 chart, 2 photo

  const px = new Uint8Array(width * height * 3)
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = (y * width + x) * 3
    px[i] = r; px[i + 1] = g; px[i + 2] = b
  }
  const fill = (x0: number, y0: number, w: number, hh: number, r: number, g: number, b: number) => {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) set(x, y, r, g, b)
  }

  let rs = h || 1
  const rnd = () => {
    rs ^= rs << 13; rs >>>= 0; rs ^= rs >> 17; rs ^= rs << 5; rs >>>= 0
    return rs / 0x100000000
  }

  if (kind === 0) {
    // A dark editor: title bar, a gutter, and lines of varying length.
    fill(0, 0, width, height, 22, 24, 28)
    fill(0, 0, width, Math.max(6, height * 0.06) | 0, 32, 35, 40)
    const pad = Math.max(6, width * 0.05) | 0
    const lh = Math.max(3, height * 0.045) | 0
    const gut = pad + (width * 0.04 | 0)
    for (let y = (height * 0.12) | 0; y < height - lh; y += lh * 2) {
      fill(pad, y, Math.max(1, width * 0.012) | 0, Math.max(1, lh * 0.6) | 0, 70, 76, 86)
      const segs = 1 + Math.floor(rnd() * 3)
      let x = gut
      for (let s = 0; s < segs && x < width - pad; s++) {
        const w = ((width - pad - x) * (0.15 + rnd() * 0.45)) | 0
        const tone = [[122, 162, 247], [158, 206, 106], [224, 175, 104], [187, 154, 247]][Math.floor(rnd() * 4)]
        fill(x, y, Math.max(2, w), Math.max(1, lh * 0.55) | 0, tone[0], tone[1], tone[2])
        x += w + (width * 0.02 | 0)
      }
    }
  } else if (kind === 1) {
    // A chart on a light card: axes, gridlines, and a line with a fill.
    fill(0, 0, width, height, 246, 248, 250)
    const m = Math.max(8, width * 0.1) | 0
    for (let i = 1; i <= 4; i++) {
      const y = (m + ((height - m * 2) * i) / 5) | 0
      fill(m, y, width - m * 2, 1, 226, 231, 236)
    }
    fill(m, height - m, width - m * 2, 1, 160, 168, 178)
    fill(m, m, 1, height - m * 2, 160, 168, 178)
    const pts = 14
    let prev = 0.5
    for (let i = 0; i < pts; i++) {
      const nx = (m + ((width - m * 2) * i) / (pts - 1)) | 0
      const next = Math.max(0.08, Math.min(0.95, prev + (rnd() - 0.45) * 0.3))
      const ny = (height - m - (height - m * 2) * next) | 0
      for (let y = ny; y < height - m; y++) set(nx, y, 219, 234, 254)
      for (let t = -1; t <= 1; t++) set(nx, ny + t, 29, 155, 240)
      const px2 = (m + ((width - m * 2) * Math.max(0, i - 1)) / (pts - 1)) | 0
      const py2 = (height - m - (height - m * 2) * prev) | 0
      const steps = Math.max(1, nx - px2)
      for (let k = 0; k < steps; k++) {
        const yy = (py2 + ((ny - py2) * k) / steps) | 0
        for (let t = -1; t <= 1; t++) set(px2 + k, yy + t, 29, 155, 240)
      }
      prev = next
    }
  } else {
    // A photograph: two-tone light with a soft vignette and grain.
    const hue = h % 360
    const angle = ((h >> 7) % 8) * (Math.PI / 4)
    const dx = Math.cos(angle), dy = Math.sin(angle)
    const cx = width / 2, cy = height / 2
    const maxR = Math.hypot(cx, cy)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = (((x / width) * dx + (y / height) * dy) + 1) / 2
        const [r, g, b] = hsl(hue + t * 55, 0.3, 0.3 + t * 0.34)
        const v = 1 - 0.42 * Math.pow(Math.hypot(x - cx, y - cy) / maxR, 2.1)
        const n = ((x * 5 + y * 11 + h) % 13) - 6
        set(x, y, clamp(r * v + n), clamp(g * v + n), clamp(b * v + n))
      }
    }
  }

  // PNG rows are prefixed with a filter byte.
  const raw = new Uint8Array(height * (width * 3 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    raw.set(px.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1)
  }
  return encodePng(raw, width, height)
}

function encodePng(raw: Uint8Array, width: number, height: number): Uint8Array {
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 2
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
