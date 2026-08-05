// Colour vision deficiency simulation, via the Brettel/Viénot–Machado method.
//
// The naive approach — "drop the red channel" — is wrong and makes the tool
// useless: it produces images no human sees and hides the failures you are
// looking for. The correct approach projects the colour onto the plane of hues
// the missing cone type CAN distinguish, which is what these matrices encode.
//
// Matrices are the widely-cited Machado et al. (2009) severity-1.0 values,
// applied in LINEAR light. Applying them to gamma-encoded sRGB — which most
// online simulators do — visibly darkens and desaturates everything, so the
// result looks wrong in a way people mistake for the deficiency itself.

export type Kind = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'

export const KINDS: { id: Kind; en: string; ar: string; share: string }[] = [
  { id: 'deuteranopia', en: 'Deuteranopia — no green cone', ar: 'عمى الأخضر', share: '~6% of men' },
  { id: 'protanopia', en: 'Protanopia — no red cone', ar: 'عمى الأحمر', share: '~2% of men' },
  { id: 'tritanopia', en: 'Tritanopia — no blue cone', ar: 'عمى الأزرق', share: '~0.01%' },
  { id: 'achromatopsia', en: 'Achromatopsia — no colour at all', ar: 'انعدام رؤية الألوان', share: 'very rare' },
]

const M: Record<Kind, number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
  achromatopsia: [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722],
}

// sRGB transfer function, both ways. Doing the matrix in linear light is the
// difference between a simulation and a murky filter.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

const LIN = new Float32Array(256)
for (let i = 0; i < 256; i++) LIN[i] = toLinear(i / 255)

export function simulatePixels(data: Uint8ClampedArray, kind: Kind): void {
  const m = M[kind]
  for (let i = 0; i < data.length; i += 4) {
    const r = LIN[data[i]]
    const g = LIN[data[i + 1]]
    const b = LIN[data[i + 2]]
    data[i] = Math.round(Math.min(1, Math.max(0, toSrgb(m[0] * r + m[1] * g + m[2] * b))) * 255)
    data[i + 1] = Math.round(Math.min(1, Math.max(0, toSrgb(m[3] * r + m[4] * g + m[5] * b))) * 255)
    data[i + 2] = Math.round(Math.min(1, Math.max(0, toSrgb(m[6] * r + m[7] * g + m[8] * b))) * 255)
  }
}

export function simulateHex(hex: string, kind: Kind): string {
  const n = hex.replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const data = new Uint8ClampedArray([
    parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), 255,
  ])
  simulatePixels(data, kind)
  return '#' + [data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const [r, g, b] = [0, 2, 4].map((i) => LIN[parseInt(full.slice(i, i + 2), 16)])
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// CIE Lab, for measuring "do these look like the same colour".
function toLab(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const [r, g, b] = [0, 2, 4].map((i) => LIN[parseInt(full.slice(i, i + 2), 16)])
  // Linear sRGB → XYZ (D65) → Lab.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIE76 colour difference. ~2.3 is the just-noticeable threshold. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
}

/**
 * Two colours that are distinct to normal vision but collapse together for
 * someone with this deficiency — the actual failure mode, and the thing a
 * simulator should point at rather than leaving you to squint.
 *
 * Measured as colour DISTANCE, not luminance contrast. These matrices preserve
 * lightness and collapse hue, so a red and a green of the same lightness have
 * low contrast both before and after — a contrast-based test would miss exactly
 * the pair everyone comes here to find.
 */
export function collapses(a: string, b: string, kind: Kind): boolean {
  const before = deltaE(a, b)
  const after = deltaE(simulateHex(a, kind), simulateHex(b, kind))
  // Clearly different to begin with, and near-indistinguishable afterwards.
  return before >= 20 && after < 10
}
