// Reading a .pptx — the third XML-in-a-zip format, after xlsx and docx.
//
// This one is genuinely the shape `unzip.ts` was written for: one XML part per
// slide, so most of the work is deciding what a "slide" is and putting them in
// the right order. Three things are easy to get wrong, and each is visible:
//
// - **Slide order is not filename order.** The parts are `slide1.xml`,
//   `slide2.xml` … `slide10.xml`, and sorting those as strings puts slide 10
//   between 1 and 2. A twelve-slide deck comes out shuffled, which looks like
//   the tool losing content rather than mis-sorting it. Sort on the NUMBER.
//   (The strictly-correct order is the `sldIdLst` in `ppt/_rels`, but the
//   numeric sort matches it for every deck PowerPoint itself writes, and it
//   degrades sensibly for the ones it does not.)
// - **A line of text is several `<a:t>` runs**, split at every formatting
//   boundary exactly as Word splits `<w:t>` — so runs join with nothing between
//   them, and a paragraph `<a:p>` is what makes a line.
// - **Speaker notes are a separate part** (`ppt/notesSlides/notesSlideN.xml`),
//   and they are usually the half of the deck worth having. They are returned
//   per slide rather than folded into the body, because a note is not what the
//   audience saw.

import { zipEntries, readEntry } from './unzip'

export interface Slide {
  /** 1-based, as PowerPoint numbers them. */
  number: number
  /** The slide's own text, one line per paragraph. */
  text: string
  /** Speaker notes for this slide, if any. */
  notes: string
}

export interface Deck {
  slides: Slide[]
  /** Slides that had no text at all — a picture-only slide is not a failure. */
  empty: number
}

export type PptxError = 'not-zip' | 'not-pptx'

const dec = new TextDecoder()

/**
 * Flatten one DrawingML part into text.
 *
 * `<a:p>` is a paragraph, `<a:br>` a line break, and `<a:t>` holds the
 * characters. Everything else — the shape tree, placeholders, styling — carries
 * no text and is skipped.
 */
export function flattenSlideXml(xml: string): string {
  const lines: string[] = []
  let line = ''
  const token = /<(\/?)a:(t|p|br)(\s[^>]*)?(\/?)>/g
  let last = 0
  let inText = false
  let m: RegExpExecArray | null

  const flush = () => { if (line.trim()) lines.push(line.trim()); line = '' }

  while ((m = token.exec(xml))) {
    const [, close, name, , selfClose] = m
    if (inText && m.index > last) line += unescapeXml(xml.slice(last, m.index))
    if (name === 't') inText = !close && !selfClose
    else if (name === 'br') { if (!close) flush() }
    else if (name === 'p') { if (close) flush() }
    last = token.lastIndex
  }
  flush()
  return lines.join('\n')
}

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (whole, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[ent] ?? whole
  })
}

/** The trailing number in slide12.xml — the only reliable ordering key. */
const partNumber = (name: string) => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0)

export async function readPptx(file: File): Promise<Deck | PptxError> {
  const buf = await file.arrayBuffer()
  const entries = zipEntries(buf)
  if (!entries) return 'not-zip'

  const slideParts = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => partNumber(a.name) - partNumber(b.name))
  if (!slideParts.length) return 'not-pptx'

  const notesParts = new Map<number, typeof entries[number]>()
  for (const e of entries) {
    if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.name)) notesParts.set(partNumber(e.name), e)
  }

  const slides: Slide[] = []
  for (const part of slideParts) {
    const n = partNumber(part.name)
    const text = flattenSlideXml(dec.decode(await readEntry(buf, part)))
    const notesPart = notesParts.get(n)
    let notes = notesPart ? flattenSlideXml(dec.decode(await readEntry(buf, notesPart))) : ''
    // PowerPoint puts the slide number itself in the notes part as its own
    // paragraph; it is not a note anybody wrote.
    notes = notes.split('\n').filter((l) => l.trim() !== String(n)).join('\n').trim()
    slides.push({ number: n, text, notes })
  }

  return { slides, empty: slides.filter((s) => !s.text && !s.notes).length }
}
