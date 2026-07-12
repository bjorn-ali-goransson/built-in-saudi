import { useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon } from '../../components/icons'
import { Stack, Button, Spinner, Seg, SegButton } from '../../components/ui'
import { LEVELS, IMG_LEVELS, type LevelKey } from './compress'

type Mode = 'images' | 'pages'

const STR = {
  en: {
    drop: 'Drop a PDF, or tap to choose', reading: 'Reading…', pages: 'pages', original: 'Original',
    modeImages: 'Keep text', modePages: 'Smallest', level: 'Compression',
    strong: 'Smaller file', balanced: 'Balanced', light: 'Better quality',
    noteImages: 'Recompresses the embedded photos/JPEGs and keeps your text selectable — best when a PDF is large because of images.',
    notePages: 'Re-renders every page as an image: maximum shrink, great for scans. Text becomes part of the image (not selectable).',
    compress: 'Compress PDF', working: 'Compressing', download: 'Download compressed PDF', again: 'Compress another',
    saved: 'saved', bigger: 'Already efficient — the compressed copy isn’t smaller. Try another level, or keep the original.',
    noImages: 'No recompressible JPEG images found. Switch to “Smallest” to re-render the pages instead.',
    locked: 'This PDF is locked / encrypted.', privacy: 'Compressed on your device — your PDF is never uploaded.',
  },
  ar: {
    drop: 'أفلت ملف PDF أو اضغط للاختيار', reading: 'جارٍ القراءة…', pages: 'صفحة', original: 'الأصلي',
    modeImages: 'إبقاء النص', modePages: 'الأصغر', level: 'الضغط',
    strong: 'ملف أصغر', balanced: 'متوازن', light: 'جودة أعلى',
    noteImages: 'يعيد ضغط الصور/JPEG المضمّنة ويُبقي نصّك قابلًا للتحديد — الأفضل حين يكبر الملف بسبب الصور.',
    notePages: 'يعيد رسم كل صفحة كصورة: أقصى تصغير، مثالي للملفات الممسوحة. يصبح النص جزءًا من الصورة (غير قابل للتحديد).',
    compress: 'ضغط PDF', working: 'جارٍ الضغط', download: 'تنزيل الملف المضغوط', again: 'ضغط ملف آخر',
    saved: 'توفير', bigger: 'الملف فعّال أصلًا — النسخة المضغوطة ليست أصغر. جرّب مستوى آخر أو احتفظ بالأصل.',
    noImages: 'لا توجد صور JPEG قابلة لإعادة الضغط. بدّل إلى «الأصغر» لإعادة رسم الصفحات.',
    locked: 'هذا الملف مقفل / مشفّر.', privacy: 'يُضغط على جهازك — لا يُرفع ملفك أبدًا.',
  },
}

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`)

export default function PdfCompressTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('images')
  const [level, setLevel] = useState<LevelKey>('balanced')
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const [err, setErr] = useState('')
  const [hint, setHint] = useState('')
  const [out, setOut] = useState<{ url: string; size: number } | null>(null)

  const reset = (keepFile: boolean) => { setOut(null); setErr(''); setHint(''); if (!keepFile) { setFile(null); setPageCount(null) } }

  async function onFile(f: File | null | undefined) {
    if (!f || !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))) return
    setBusy(true); reset(false)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.load(await f.arrayBuffer(), { updateMetadata: false })
      setFile(f); setPageCount(doc.getPageCount())
    } catch {
      setErr(s.locked); setFile(null)
    } finally { setBusy(false) }
  }

  async function run() {
    if (!file) return
    setBusy(true); setErr(''); setHint(''); setOut(null); setProg({ done: 0, total: pageCount || 1 })
    try {
      const { compressPdf, recompressImages } = await import('./compress')
      const onP = (done: number, total: number) => setProg({ done, total })
      const blob = mode === 'images'
        ? await recompressImages(file, IMG_LEVELS[level], onP)
        : await compressPdf(file, LEVELS[level], onP)
      if (!blob) { setHint(s.noImages); return }
      setOut((p) => { if (p) URL.revokeObjectURL(p.url); return { url: URL.createObjectURL(blob), size: blob.size } })
    } catch {
      setErr(s.locked)
    } finally { setBusy(false); setProg(null) }
  }

  const pct = file && out ? Math.round((1 - out.size / file.size) * 100) : 0

  return (
    <Stack data-testid="pdf-compress">
      {!file && (
        <button className="flex flex-col items-center gap-[0.4rem] py-10 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)]"
          data-testid="cmp-drop" onClick={() => document.getElementById('cmp-file')?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}>
          {busy ? <Spinner className="size-7" label={s.reading} /> : <><UploadIcon /><span>{s.drop}</span></>}
          <input id="cmp-file" type="file" accept="application/pdf" className="absolute w-px h-px opacity-0" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </button>
      )}
      {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="cmp-err">{err}</p>}

      {file && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2 flex-wrap text-[0.92rem] text-ink-soft" data-testid="cmp-info">
            <span className="font-semibold text-ink truncate max-w-[60%]">{file.name}</span>
            <span className="text-ink-faint">· {pageCount ?? '…'} {s.pages} · {s.original} {fmtSize(file.size)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Seg data-testid="cmp-mode">
              <SegButton active={mode === 'images'} onClick={() => { setMode('images'); reset(true) }}>{s.modeImages}</SegButton>
              <SegButton active={mode === 'pages'} onClick={() => { setMode('pages'); reset(true) }}>{s.modePages}</SegButton>
            </Seg>
            <p className="text-[0.8rem] text-ink-faint leading-relaxed">{mode === 'images' ? s.noteImages : s.notePages}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[0.85rem] font-medium text-ink-soft">{s.level}</span>
            <Seg>
              <SegButton active={level === 'strong'} onClick={() => { setLevel('strong'); reset(true) }}>{s.strong}</SegButton>
              <SegButton active={level === 'balanced'} onClick={() => { setLevel('balanced'); reset(true) }}>{s.balanced}</SegButton>
              <SegButton active={level === 'light'} onClick={() => { setLevel('light'); reset(true) }}>{s.light}</SegButton>
            </Seg>
          </div>

          {hint && <p className="text-[0.85rem] text-gold-500" data-testid="cmp-hint">{hint}</p>}

          {!out ? (
            <div className="flex items-center gap-3">
              <Button variant="primary" data-testid="cmp-run" disabled={busy} onClick={run}>
                {busy ? `${s.working}${prog ? ` ${prog.done}/${prog.total}` : '…'}` : s.compress}
              </Button>
              {busy && <Spinner className="size-5" />}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap" data-testid="cmp-result">
                <Button variant="primary" href={out.url} download={file.name.replace(/\.pdf$/i, '') + '-compressed.pdf'} data-testid="cmp-download">
                  <DownloadIcon /> {s.download} · {fmtSize(out.size)}
                </Button>
                {pct > 0 && <span className="text-[0.95rem] font-semibold text-green-600">−{pct}% {s.saved}</span>}
                <Button onClick={() => reset(false)}>{s.again}</Button>
              </div>
              {pct <= 0 && <p className="text-[0.85rem] text-gold-500">{s.bigger}</p>}
            </div>
          )}
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
