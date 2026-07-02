import { useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { zipStore } from '../../lib/zip'

const STR = {
  en: {
    drop: 'Drop a PDF, or tap to choose', another: 'Choose another', pages: 'pages', locked: 'This PDF is locked / encrypted.',
    range: 'Extract range', burst: 'Split to pages', rangeLabel: 'Pages (e.g. 1-3, 5, 8-10)', rangeBad: 'Enter a valid range like 1-3,5.',
    extract: 'Extract', splitting: 'Splitting…', extracting: 'Extracting…', download: 'Download', dlAll: 'Download all (ZIP)',
    split: 'Split into single pages', page: 'Page', privacy: 'Processed on your device — your PDF is never uploaded.',
  },
  ar: {
    drop: 'أفلت ملف PDF أو اضغط للاختيار', another: 'اختر آخر', pages: 'صفحة', locked: 'هذا الملف مقفل / مشفّر.',
    range: 'استخراج نطاق', burst: 'تقسيم لصفحات', rangeLabel: 'الصفحات (مثل 1-3، 5، 8-10)', rangeBad: 'أدخل نطاقًا صحيحًا مثل 1-3،5.',
    extract: 'استخراج', splitting: 'جارٍ التقسيم…', extracting: 'جارٍ الاستخراج…', download: 'تنزيل', dlAll: 'تنزيل الكل (ZIP)',
    split: 'تقسيم إلى صفحات مفردة', page: 'صفحة', privacy: 'يُعالَج على جهازك — لا يُرفع ملفك أبدًا.',
  },
}

function parseRange(str: string, max: number): number[] | null {
  const set = new Set<number>()
  for (const raw of str.split(/[,،]/)) {
    const p = raw.trim(); if (!p) continue
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) { let a = +m[1], b = +m[2]; if (a > b)[a, b] = [b, a]; for (let i = a; i <= b; i++) if (i >= 1 && i <= max) set.add(i) }
    else if (/^\d+$/.test(p)) { const i = +p; if (i >= 1 && i <= max) set.add(i) }
    else return null
  }
  return [...set].sort((a, b) => a - b)
}

export default function PdfSplitTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<{ name: string; file: File; pages: number } | null>(null)
  const [err, setErr] = useState('')
  const [mode, setMode] = useState<'range' | 'burst'>('range')
  const [range, setRange] = useState('')
  const [busy, setBusy] = useState(false)
  const [extractOut, setExtractOut] = useState<{ url: string; size: number; count: number } | null>(null)
  const [pages, setPages] = useState<{ name: string; url: string }[]>([])
  const [zipUrl, setZipUrl] = useState('')

  function reset() { setExtractOut(null); setPages([]); setZipUrl('') }

  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(''); reset()
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(await f.arrayBuffer())
      setSrc({ name: f.name.replace(/\.pdf$/i, ''), file: f, pages: doc.getPageCount() })
    } catch { setSrc(null); setErr(s.locked) }
  }

  async function extract() {
    if (!src) return
    const idx = parseRange(range, src.pages)
    if (idx === null || idx.length === 0) { setErr(s.rangeBad); return }
    setErr(''); setBusy(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(await src.file.arrayBuffer())
      const out = await PDFDocument.create()
      const copied = await out.copyPages(doc, idx.map((i) => i - 1))
      copied.forEach((p) => out.addPage(p))
      const bytes = await out.save()
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      setExtractOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size, count: idx.length } })
    } finally { setBusy(false) }
  }

  async function burst() {
    if (!src) return
    setBusy(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(await src.file.arrayBuffer())
      const files: { name: string; bytes: Uint8Array }[] = []
      const links: { name: string; url: string }[] = []
      for (let i = 0; i < src.pages; i++) {
        const out = await PDFDocument.create()
        const [p] = await out.copyPages(doc, [i])
        out.addPage(p)
        const bytes = await out.save()
        const name = `${src.name}-p${i + 1}.pdf`
        files.push({ name, bytes })
        links.push({ name, url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })) })
      }
      pages.forEach((p) => URL.revokeObjectURL(p.url)); if (zipUrl) URL.revokeObjectURL(zipUrl)
      setPages(links)
      setZipUrl(URL.createObjectURL(zipStore(files)))
    } finally { setBusy(false) }
  }

  return (
    <div className="stack" data-testid="pdf-split">
      {!src ? (
        <button className="dropzone" data-testid="ps-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="application/pdf" className="dropzone__input" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <p className="text-ink-soft" data-testid="ps-count"><span className="font-semibold">{src.name}</span> · {src.pages} {s.pages}</p>

          <div className="seg self-start" role="group">
            {(['range', 'burst'] as const).map((m) => (
              <button key={m} className={`seg__btn ${mode === m ? 'is-active' : ''}`} data-testid={`ps-mode-${m}`} onClick={() => { setMode(m); setErr('') }}>{s[m]}</button>
            ))}
          </div>

          {mode === 'range' ? (
            <>
              <label className="field max-w-md"><span className="field__label">{s.rangeLabel}</span>
                <input className="input font-mono" data-testid="ps-range" placeholder="1-3, 5" value={range} onChange={(e) => { setRange(e.target.value); setExtractOut(null) }} /></label>
              <div className="flex gap-2 items-center">
                {!extractOut ? (
                  <button className="btn btn--primary" data-testid="ps-extract" disabled={busy} onClick={extract}>{busy ? s.extracting : s.extract}</button>
                ) : (
                  <a className="btn btn--primary" href={extractOut.url} download={`${src.name}-extract.pdf`} data-testid="ps-download"><DownloadIcon /> {s.download} · {extractOut.count} {s.pages}</a>
                )}
              </div>
            </>
          ) : (
            <>
              <button className="btn btn--primary self-start" data-testid="ps-split" disabled={busy} onClick={burst}>{busy ? s.splitting : `${s.split} (${src.pages})`}</button>
              {pages.length > 0 && (
                <>
                  <a className="btn self-start" href={zipUrl} download={`${src.name}-pages.zip`} data-testid="ps-zip"><DownloadIcon /> {s.dlAll}</a>
                  <div className="flex flex-wrap gap-2">
                    {pages.map((p, i) => (
                      <a key={i} className="btn px-3 text-[0.85rem]" href={p.url} download={p.name} data-testid={`ps-page-${i}`}>{s.page} {i + 1}</a>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <button className="btn self-start" onClick={() => { setSrc(null); reset() }}>{s.another}</button>
        </>
      )}

      {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="ps-error">{err}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}
