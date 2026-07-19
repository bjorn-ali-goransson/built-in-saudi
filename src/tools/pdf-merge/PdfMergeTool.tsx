import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Stack, Button } from '../../components/ui'
import { PdfOps } from '../../lib/pdfOps'

interface Item { id: string; file: File; pages: number | null; error?: boolean }

const STR = {
  en: {
    drop: 'Drop PDFs, or tap to choose', add: 'Add more', pages: 'pages', locked: 'Locked / encrypted — cannot merge',
    total: 'Total', merge: 'Merge PDFs', merging: 'Merging…', download: 'Download merged PDF', clear: 'Clear all',
    up: 'Move up', down: 'Move down', remove: 'Remove', someLocked: 'Remove the locked file(s) to merge.',
    privacy: 'Merged on your device — your PDFs are never uploaded.',
  },
  ar: {
    drop: 'أفلت ملفات PDF أو اضغط للاختيار', add: 'إضافة المزيد', pages: 'صفحة', locked: 'مقفل / مشفّر — تعذّر الدمج',
    total: 'الإجمالي', merge: 'دمج الملفات', merging: 'جارٍ الدمج…', download: 'تنزيل الملف المدموج', clear: 'مسح الكل',
    up: 'أعلى', down: 'أسفل', remove: 'إزالة', someLocked: 'أزل الملفات المقفلة للدمج.',
    privacy: 'يُدمج على جهازك — لا تُرفع ملفاتك أبدًا.',
  },
}

let uid = 0

export default function PdfMergeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)
  const opsRef = useRef<PdfOps | null>(null)

  useEffect(() => () => opsRef.current?.dispose(), [])

  // Page counting + merging run in a worker (#154) — big PDFs never jank the UI.
  async function addFiles(files: FileList | null) {
    if (!files) return
    const pdfs = [...files].filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) return
    const fresh: Item[] = pdfs.map((f) => ({ id: `p${uid++}`, file: f, pages: null }))
    setItems((cur) => [...cur, ...fresh]); setOut(null)
    opsRef.current ??= new PdfOps()
    for (const it of fresh) {
      const n = await opsRef.current.pageCount(it.file)
      setItems((cur) => cur.map((x) => x.id === it.id ? (n === null ? { ...x, pages: 0, error: true } : { ...x, pages: n }) : x))
    }
  }
  function move(i: number, d: -1 | 1) {
    setItems((cur) => { const a = [...cur]; const j = i + d; if (j < 0 || j >= a.length) return cur;[a[i], a[j]] = [a[j], a[i]]; return a }); setOut(null)
  }
  function remove(id: string) { setItems((cur) => cur.filter((x) => x.id !== id)); setOut(null) }

  const anyLocked = items.some((x) => x.error)
  const total = items.reduce((n, x) => n + (x.pages || 0), 0)

  async function merge() {
    if (!items.length || anyLocked) return
    setBusy(true)
    try {
      opsRef.current ??= new PdfOps()
      const blob = await opsRef.current.merge(items.map((it) => it.file))
      if (blob) setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="pdf-merge">
      <button className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="pm-drop" onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
        <UploadIcon /><span>{items.length ? s.add : s.drop}</span>
        <input ref={fileRef} type="file" accept="application/pdf" multiple className="absolute w-px h-px opacity-0" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </button>

      {items.length > 0 && (
        <>
          <ul className="flex flex-col gap-2" data-testid="pm-list">
            {items.map((it, i) => (
              <li key={it.id} className="flex items-center gap-3 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-2" data-testid={`pm-item-${i}`}>
                <span className="font-mono text-ink-faint text-[0.8rem] w-6 text-center flex-none">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[0.9rem]">{it.file.name}</div>
                  <div className={`text-[0.78rem] ${it.error ? 'text-[color:var(--danger)]' : 'text-ink-faint'}`}>
                    {it.error ? s.locked : it.pages === null ? '…' : `${it.pages} ${s.pages}`}
                  </div>
                </div>
                <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.up} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.down} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</Button>
                <Button className="px-2 min-w-[2rem] justify-center" aria-label={s.remove} data-testid={`pm-remove-${i}`} onClick={() => remove(it.id)}>✕</Button>
              </li>
            ))}
          </ul>

          <p className="text-ink-soft text-[0.9rem]" data-testid="pm-total">{s.total}: <span className="font-semibold">{total}</span> {s.pages}</p>
          {anyLocked && <p className="text-[color:var(--danger)] text-[0.9rem]">{s.someLocked}</p>}

          <div className="flex gap-2 items-center">
            {!out ? (
              <Button variant="primary" data-testid="pm-merge" disabled={busy || anyLocked || items.length < 1} onClick={merge}>{busy ? s.merging : s.merge}</Button>
            ) : (
              <Button variant="primary" href={out.url} download="merged.pdf" data-testid="pm-download"><DownloadIcon /> {s.download} · {(out.size / 1024).toFixed(0)} KB</Button>
            )}
            <Button onClick={() => { setItems([]); setOut(null) }}>{s.clear}</Button>
          </div>
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
