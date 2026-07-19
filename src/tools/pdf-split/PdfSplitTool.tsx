import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { zipStore } from '../../lib/zip'
import { Button, Field, Input, Stack, Seg, SegButton } from '../../components/ui'
import { PdfOps } from '../../lib/pdfOps'

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
  const opsRef = useRef<PdfOps | null>(null)

  useEffect(() => () => opsRef.current?.dispose(), [])

  function reset() { setExtractOut(null); setPages([]); setZipUrl('') }

  // All pdf-lib work runs in a worker (#154) — splitting a big PDF never janks the UI.
  async function onFile(f: File | undefined) {
    if (!f) return
    setErr(''); reset()
    opsRef.current ??= new PdfOps()
    const n = await opsRef.current.pageCount(f)
    if (n === null) { setSrc(null); setErr(s.locked); return }
    setSrc({ name: f.name.replace(/\.pdf$/i, ''), file: f, pages: n })
  }

  async function extract() {
    if (!src) return
    const idx = parseRange(range, src.pages)
    if (idx === null || idx.length === 0) { setErr(s.rangeBad); return }
    setErr(''); setBusy(true)
    try {
      const blob = await opsRef.current!.extract(src.file, idx.map((i) => i - 1))
      if (blob) setExtractOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size, count: idx.length } })
    } finally { setBusy(false) }
  }

  async function burst() {
    if (!src) return
    setBusy(true)
    try {
      const bufs = await opsRef.current!.burst(src.file)
      if (!bufs) return
      const files: { name: string; bytes: Uint8Array }[] = []
      const links: { name: string; url: string }[] = []
      bufs.forEach((buf, i) => {
        const name = `${src.name}-p${i + 1}.pdf`
        files.push({ name, bytes: new Uint8Array(buf) })
        links.push({ name, url: URL.createObjectURL(new Blob([buf], { type: 'application/pdf' })) })
      })
      pages.forEach((p) => URL.revokeObjectURL(p.url)); if (zipUrl) URL.revokeObjectURL(zipUrl)
      setPages(links)
      setZipUrl(URL.createObjectURL(zipStore(files)))
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="pdf-split">
      {!src ? (
        <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="ps-drop" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
          <UploadIcon /><span>{s.drop}</span>
          <input ref={fileRef} type="file" accept="application/pdf" className="absolute w-px h-px opacity-0" onChange={(e) => onFile(e.target.files?.[0])} />
        </button>
      ) : (
        <>
          <p className="text-ink-soft" data-testid="ps-count"><span className="font-semibold">{src.name}</span> · {src.pages} {s.pages}</p>

          <Seg className="self-start" role="group">
            {(['range', 'burst'] as const).map((m) => (
              <SegButton key={m} active={mode === m} data-testid={`ps-mode-${m}`} onClick={() => { setMode(m); setErr('') }}>{s[m]}</SegButton>
            ))}
          </Seg>

          {mode === 'range' ? (
            <>
              <Field label={s.rangeLabel} className="max-w-md">
                <Input className="font-mono" data-testid="ps-range" placeholder="1-3, 5" value={range} onChange={(e) => { setRange(e.target.value); setExtractOut(null) }} /></Field>
              <div className="flex gap-2 items-center">
                {!extractOut ? (
                  <Button variant="primary" data-testid="ps-extract" disabled={busy} onClick={extract}>{busy ? s.extracting : s.extract}</Button>
                ) : (
                  <Button variant="primary" href={extractOut.url} download={`${src.name}-extract.pdf`} data-testid="ps-download"><DownloadIcon /> {s.download} · {extractOut.count} {s.pages}</Button>
                )}
              </div>
            </>
          ) : (
            <>
              <Button variant="primary" className="self-start" data-testid="ps-split" disabled={busy} onClick={burst}>{busy ? s.splitting : `${s.split} (${src.pages})`}</Button>
              {pages.length > 0 && (
                <>
                  <Button href={zipUrl} download={`${src.name}-pages.zip`} className="self-start" data-testid="ps-zip"><DownloadIcon /> {s.dlAll}</Button>
                  <div className="flex flex-wrap gap-2">
                    {pages.map((p, i) => (
                      <Button key={i} href={p.url} download={p.name} className="px-3 text-[0.85rem]" data-testid={`ps-page-${i}`}>{s.page} {i + 1}</Button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <Button className="self-start" onClick={() => { setSrc(null); reset() }}>{s.another}</Button>
        </>
      )}

      {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="ps-error">{err}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
