// Round trip every office file in a directory through the editors' own readers
// and writers, with an edit in the middle, and keep what came out — for
// compare.py to render with somebody else's software and set against the
// original.
//
//   npx vite-node evals/office/roundtrip.ts <corpus-dir> <out-dir>
//
// The corpus is whatever real documents you have; it is NEVER read from or
// written to the repo, because real documents carry real people's data. Per
// file this records, without any third party involved:
//   - timings of read / write / re-read, and the loss ledger;
//   - IDEMPOTENCE: the text our reader finds in our own export must be the text
//     it found in the original, plus the edit. A word that goes missing between
//     read(x) and read(write(read(x))) was lost by OUR writer or reader, which no
//     renderer comparison can separate from a rendering difference.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { readDocx } from '../../src/tools/word-editor/io/docx-read'
import { writeDocx } from '../../src/tools/word-editor/io/docx-write'
import { readXlsx } from '../../src/tools/excel-editor/io/xlsx-read'
import { writeXlsx } from '../../src/tools/excel-editor/io/xlsx-write'
import { readPptx } from '../../src/tools/powerpoint-editor/io/pptx-read'
import { writePptx } from '../../src/tools/powerpoint-editor/io/pptx-write'

export const EDIT = 'ROUNDTRIPEDITMARKER'

type Kind = 'docx' | 'xlsx' | 'pptx'
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

async function read(kind: Kind, buf: ArrayBuffer): Promise<{ data: any; loss: { what: string; count?: number }[] }> {
  if (kind === 'docx') { const r: any = await readDocx(buf); return { data: r.data, loss: r.loss || [] } }
  if (kind === 'xlsx') { const r: any = await readXlsx(buf); return { data: r.book ?? r.data, loss: r.loss || [] } }
  const r: any = await readPptx(buf); return { data: r.data, loss: r.loss || [] }
}
async function write(kind: Kind, data: any): Promise<Buffer> {
  const r: any = kind === 'docx' ? await writeDocx(data, { title: 'roundtrip' }) : kind === 'xlsx' ? await writeXlsx(data, { title: 'roundtrip' }) : await writePptx(data, { title: 'roundtrip' })
  return Buffer.from(await r.blob.arrayBuffer())
}

/** The edit a person would make: a line of text at the top of the first page / sheet / slide. */
function edit(kind: Kind, data: any) {
  if (kind === 'docx') data.doc.content.unshift({ type: 'paragraph', content: [{ type: 'text', text: EDIT }] })
  else if (kind === 'xlsx') {
    const s = data.sheets[0]
    // Below everything already there, so nothing is overwritten.
    let max = -1
    for (const k of Object.keys(s.cells)) max = Math.max(max, +k.split(',')[0])
    s.cells[`${max + 2},0`] = { input: EDIT }
    s.rows = Math.max(s.rows, max + 3)
  } else {
    const sorted = [...data.slides].sort((a: any, b: any) => (a.ord < b.ord ? -1 : 1))
    sorted[0].elements.push({ id: 'roundtrip', kind: 'shape', geom: 'rect', x: 20, y: 20, w: 300, h: 40, fill: { type: 'none' }, line: null, text: { paras: [{ runs: [{ t: EDIT }] }] }, ord: 'zzzz' })
  }
}

/** Every word our model holds: Word text nodes, cell inputs, slide runs, by the fields that carry them. */
function words(data: any): Map<string, number> {
  const out = new Map<string, number>()
  const add = (s: string) => { for (const w of s.split(/[\s‏‎]+/)) if (w) out.set(w, (out.get(w) || 0) + 1) }
  const seen = new Set<object>()
  const walk = (v: any, key = '') => {
    if (typeof v === 'string') { if ((key === 'text' || key === 'input' || key === 't') && !v.startsWith('data:')) add(v); return }
    if (!v || typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    // A paragraph's runs are ONE string: two runs with no space between them are one word, and
    // counting them as two reported a writer that merges same-format runs as losing words.
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && (typeof x.text === 'string' || typeof x.t === 'string'))) {
      add(v.map((x) => x.text ?? x.t).join(''))
      for (const x of v) for (const k in x) if (k !== 'text' && k !== 't') walk(x[k], k)
      return
    }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return }
    for (const k in v) walk(v[k], k)
  }
  walk(data)
  return out
}
const missing = (a: Map<string, number>, b: Map<string, number>) => { const out: string[] = []; for (const [w, n] of a) { const m = b.get(w) || 0; for (let i = m; i < n; i++) out.push(w) } return out }

async function main() {
  const [dir, outDir] = process.argv.slice(2)
  if (!dir || !outDir) throw new Error('usage: roundtrip.ts <corpus-dir> <out-dir>')
  mkdirSync(outDir, { recursive: true })
  const report: any[] = []
  for (const f of readdirSync(dir).sort()) {
    const kind = extname(f).slice(1).toLowerCase() as Kind
    if (!['docx', 'xlsx', 'pptx'].includes(kind)) continue
    const id = basename(f, extname(f)).replace(/[^\w.-]+/g, '_').slice(0, 60)
    const row: any = { file: f, id, kind }
    try {
      const buf = readFileSync(join(dir, f))
      row.kb = Math.round(buf.length / 1024)
      let t = performance.now()
      const a = await read(kind, ab(buf))
      row.readMs = Math.round(performance.now() - t)
      row.loss = a.loss.map((l) => `${l.what}${l.count ? ` (${l.count})` : ''}`)
      const before = words(a.data)
      // Unedited too: an edit moves everything below it, so pictures are compared on this one.
      const plain = await write(kind, structuredClone(a.data))
      edit(kind, a.data)
      t = performance.now()
      const out = await write(kind, a.data)
      row.writeMs = Math.round(performance.now() - t)
      row.outKb = Math.round(out.length / 1024)
      t = performance.now()
      const b = await read(kind, ab(out))
      row.rereadMs = Math.round(performance.now() - t)
      const after = words(b.data)
      row.words = [...before.values()].reduce((x, y) => x + y, 0)
      row.lostWords = missing(before, after)
      row.gainedWords = missing(after, before).filter((w) => w !== EDIT)
      row.editKept = (after.get(EDIT) || 0) > 0
      copyFileSync(join(dir, f), join(outDir, `${id}.orig.${kind}`))
      writeFileSync(join(outDir, `${id}.ours.${kind}`), out)
      writeFileSync(join(outDir, `${id}.plain.${kind}`), plain)
    } catch (e) { row.error = String((e as Error)?.stack || e).split('\n').slice(0, 3).join(' | ') }
    report.push(row)
    console.log(`${row.kind} ${String(row.kb).padStart(5)}KB read ${String(row.readMs).padStart(5)}ms write ${String(row.writeMs).padStart(5)}ms reread ${String(row.rereadMs).padStart(5)}ms  lost ${row.lostWords?.length ?? '-'}/${row.words ?? '-'}  edit ${row.editKept ? 'ok' : 'MISSING'}  ${row.error ? 'ERROR ' + row.error : ''}  ${f.slice(0, 50)}`)
  }
  writeFileSync(join(outDir, 'roundtrip.json'), JSON.stringify(report, null, 1))
}

main()
