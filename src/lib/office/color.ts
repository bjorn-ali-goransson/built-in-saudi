// Office colour resolution: rgb / theme+tint / indexed / system / preset, shared
// by the three importers. Office files rarely say "#3b5bdb"; they say "accent 1,
// 40% lighter", and an importer that ignores the theme paints every heading black.

export const THEME_ORDER = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'] as const
export type ThemeColors = Record<(typeof THEME_ORDER)[number], string>

export const DEFAULT_THEME: ThemeColors = {
  dk1: '#000000', lt1: '#ffffff', dk2: '#44546a', lt2: '#e7e6e6',
  accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5', accent4: '#ffc000', accent5: '#5b9bd5', accent6: '#70ad47',
  hlink: '#0563c1', folHlink: '#954f72',
}

/** The 64-entry legacy palette `indexed="n"` refers to. */
export const INDEXED: string[] = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF', '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080', '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF', '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696', '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
].map((h) => '#' + h.toLowerCase())

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(-6)
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0]
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

/** SpreadsheetML tint: -1..1, darkening or lightening the luminance. */
export function applyTint(hex: string, tint: number): string {
  if (!tint) return hex
  const [h, s, l] = rgbToHsl(...hexToRgb(hex))
  const nl = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint
  return rgbToHex(...hslToRgb(h, s, nl))
}

/** DrawingML lumMod/lumOff (in 1/100000ths) and shade/tint. */
export function applyMods(hex: string, mods: { lumMod?: number; lumOff?: number; shade?: number; tint?: number; alpha?: number }): string {
  let [r, g, b] = hexToRgb(hex)
  if (mods.tint !== undefined) { const t = mods.tint / 100000; r = r + (255 - r) * (1 - t); g = g + (255 - g) * (1 - t); b = b + (255 - b) * (1 - t) }
  if (mods.shade !== undefined) { const t = mods.shade / 100000; r *= t; g *= t; b *= t }
  if (mods.lumMod !== undefined || mods.lumOff !== undefined) {
    const [h, s, l] = rgbToHsl(r, g, b)
    const nl = Math.max(0, Math.min(1, l * ((mods.lumMod ?? 100000) / 100000) + (mods.lumOff ?? 0) / 100000))
    ;[r, g, b] = hslToRgb(h, s, nl)
  }
  return rgbToHex(r, g, b)
}

/** SpreadsheetML theme index → theme slot. The first four are swapped against DrawingML order. */
export function sheetThemeColor(theme: ThemeColors, index: number): string {
  const order: (keyof ThemeColors)[] = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
  return theme[order[index] ?? 'dk1'] || '#000000'
}

/** ARGB like "FF3B5BDB" → "#3b5bdb". Alpha is dropped. */
export function argb(v: string | undefined): string | undefined {
  if (!v) return undefined
  const h = v.replace('#', '')
  if (!/^[0-9a-fA-F]{6,8}$/.test(h)) return undefined
  return '#' + h.slice(-6).toLowerCase()
}

export const PRESET_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080',
  darkGray: '#a9a9a9', lightGray: '#d3d3d3', orange: '#ffa500', purple: '#800080', navy: '#000080', teal: '#008080', silver: '#c0c0c0', maroon: '#800000',
}
