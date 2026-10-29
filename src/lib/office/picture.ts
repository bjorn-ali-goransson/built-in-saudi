// A picture a person picked, dropped or pasted, made ready to embed in a
// document: the decoder decides what is readable (HEIC included, #226), a big
// photo is scaled to what a page or slide needs, and an SVG or a small PNG is
// kept exactly as it was. Shared by the document and presentation editors.
import { decodeImage } from '../decodeImage'
import { whyUnreadable } from '../imageInput'

export async function pictureFromFile(f: File, locale: 'en' | 'ar'): Promise<{ src: string; w: number; h: number } | { error: string }> {
  const asUrl = () => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f) })
  if (/\.svg$/i.test(f.name) || f.type === 'image/svg+xml') {
    const src = await asUrl()
    const dims = await new Promise<{ w: number; h: number } | null>((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 300, h: i.naturalHeight || 150 }); i.onerror = () => res(null); i.src = src })
    return dims ? { src, ...dims } : { error: await whyUnreadable(f, locale) }
  }
  const bmp = await decodeImage(f)
  if (!bmp) return { error: await whyUnreadable(f, locale) }
  const { width: w, height: h } = bmp
  const keep = /^image\/(png|gif|jpeg|webp)$/.test(f.type) && f.size < 1_500_000 && Math.max(w, h) <= 2400
  if (keep) { bmp.close(); return { src: await asUrl(), w, h } }
  const k = Math.min(1, 2000 / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k)
  c.height = Math.round(h * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const png = f.type === 'image/png'
  return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86), w: c.width, h: c.height }
}
