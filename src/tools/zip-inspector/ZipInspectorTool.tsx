import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button } from '../../components/ui'
import { DownloadIcon, LockIcon, ArchiveIcon } from '../../components/icons'
import type { Entry, ZipRequest, ZipResponse } from './zip.worker'

const STR = {
  en: {
    drop: 'Drop an archive here, or', browse: 'browse', hint: 'Files never leave your browser.',
    format: 'Format', files: 'Files', total: 'Uncompressed', packed: 'Compressed', ratio: 'Saved',
    name: 'Name', size: 'Size', comp: 'Packed', modified: 'Modified', method: 'Method',
    notZip: 'Not a ZIP — showing detected format only. Listing works for .zip (and .zip-based files like .docx, .apk, .jar).',
    unknown: 'Unknown / not an archive',
    stored: 'Stored', deflate: 'Deflate', dir: 'folder',
    get: 'Save', getting: 'Reading…', preview: 'Preview', close: 'Close',
    encrypted: 'Password-protected',
    encryptedNote: 'This entry is encrypted. It can be listed but not read without the password, and this tool does not ask for one — a decrypted-looking file that is actually noise is worse than no file.',
    methodNote: 'This entry uses a compression method beyond store and deflate, which the browser cannot undo on its own.',
    corrupt: 'That entry could not be read — the archive looks damaged.',
  },
  ar: {
    drop: 'أفلِت ملفًا مضغوطًا هنا، أو', browse: 'تصفّح', hint: 'الملفات لا تغادر متصفحك.',
    format: 'الصيغة', files: 'الملفات', total: 'غير مضغوط', packed: 'مضغوط', ratio: 'التوفير',
    name: 'الاسم', size: 'الحجم', comp: 'مضغوط', modified: 'التعديل', method: 'الطريقة',
    notZip: 'ليس ZIP — نعرض الصيغة المكتشفة فقط. السرد يعمل مع ملفات .zip (وما يعتمد عليها مثل .docx و.apk و.jar).',
    unknown: 'غير معروف / ليس ملفًا مضغوطًا',
    stored: 'مخزّن', deflate: 'مضغوط', dir: 'مجلد',
    get: 'احفظ', getting: 'جارٍ القراءة…', preview: 'معاينة', close: 'إغلاق',
    encrypted: 'محمي بكلمة مرور',
    encryptedNote: 'هذا العنصر مشفّر. يمكن سرده لا قراءته دون كلمة المرور، وهذه الأداة لا تطلبها — فملف يبدو مفكوكًا وهو في الحقيقة ضجيج أسوأ من لا ملف.',
    methodNote: 'يستخدم هذا العنصر طريقة ضغط غير التخزين والـdeflate، ولا يستطيع المتصفح فكّها وحده.',
    corrupt: 'تعذّرت قراءة هذا العنصر — يبدو الملف المضغوط تالفًا.',
  },
}

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB']; let i = -1; let v = n
  do { v /= 1024; i++ } while (v >= 1024 && i < u.length - 1)
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`
}

export default function ZipInspectorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [file, setFile] = useState<{ name: string; format: string; entries: Entry[] | null } | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)
  const srcRef = useRef<File | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null)
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  useEffect(() => () => { workerRef.current?.terminate() }, [])

  // Reading + parsing happen in a worker so huge archives never jank the UI (#154).
  function handle(f: File) {
    workerRef.current ??= new Worker(new URL('./zip.worker.ts', import.meta.url), { type: 'module' })
    const worker = workerRef.current
    const id = ++reqRef.current
    const onMessage = (e: MessageEvent<ZipResponse>) => {
      if (e.data.id !== reqRef.current) return // a newer file was dropped meanwhile
      worker.removeEventListener('message', onMessage)
      setFile({ name: f.name, format: e.data.format || s.unknown, entries: e.data.entries })
      srcRef.current = f
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ id, file: f } satisfies ZipRequest)
  }

  /** Text-ish by name, so a preview is offered only where it would be readable. */
  const isText = (name: string) => /\.(txt|md|json|xml|csv|tsv|ya?ml|ini|cfg|conf|log|html?|css|js|ts|tsx|jsx|svg|sql|sh|py|java|c|h|cpp|rs|go|rb|php|toml|properties|gitignore)$/i.test(name)

  /**
   * Get one entry out. Reading happens in the same worker (#154) — a multi-GB
   * archive must not be re-read on the main thread just to save one file.
   */
  function extract(index: number, mode: 'save' | 'preview') {
    const src = srcRef.current
    const worker = workerRef.current
    if (!src || !worker || !file?.entries) return
    const entry = file.entries[index]
    setNote('')
    setBusy(index)
    const id = ++reqRef.current
    const onMessage = (e: MessageEvent<ZipResponse>) => {
      if (e.data.id !== reqRef.current) return
      worker.removeEventListener('message', onMessage)
      setBusy(null)
      const bytes = e.data.bytes
      if (!bytes) {
        setNote(e.data.reason === 'encrypted' ? s.encryptedNote
          : e.data.reason === 'method' ? s.methodNote : s.corrupt)
        return
      }
      if (mode === 'preview') {
        setPreview({ name: entry.name, text: new TextDecoder().decode(bytes.slice(0, 200_000)) })
        return
      }
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]))
      const a = document.createElement('a')
      a.href = url
      // Entry names carry their folders; a download takes the leaf.
      a.download = entry.name.split('/').filter(Boolean).pop() || 'file'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ id, file: src, extract: index } satisfies ZipRequest)
  }

  const totals = file?.entries
    ? file.entries.reduce((a, e) => ({ size: a.size + e.size, comp: a.comp + e.comp, files: a.files + (e.dir ? 0 : 1) }), { size: 0, comp: 0, files: 0 })
    : null
  const saved = totals && totals.size > 0 ? Math.round((1 - totals.comp / totals.size) * 100) : 0

  return (
    <Stack data-testid="zip-inspector">
      <label className="flex flex-col items-center gap-[0.4rem] py-8 px-4 border-2 border-dashed border-[color:var(--line)] rounded-[var(--r-md)] bg-[var(--surface)] text-center cursor-pointer transition-[border-color,background] duration-150 hover:border-[color:color-mix(in_srgb,var(--green-500)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--green-400)_6%,transparent)] [&_small]:text-[color:var(--ink-faint)] [&_small]:text-[0.82rem]" data-testid="zip-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handle(f) }}>
        <input type="file" className="absolute w-px h-px opacity-0" data-testid="zip-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }} />
        <span>{s.drop} <strong>{s.browse}</strong></span>
        <small>{s.hint}</small>
      </label>

      {file && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[0.8rem]">
            <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid="zip-format">{file.format}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.format}</span></div>
            {totals && <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar" data-testid="zip-files">{totals.files}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.files}</span></div>}
            {totals && <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar">{fmtBytes(totals.size)}</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.total}</span></div>}
            {totals && <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-4 py-[0.9rem] text-center"><span className="block font-display text-[1.7rem] text-green-700 leading-none rtl:font-ar">{saved}%</span><span className="block mt-[0.35rem] text-[0.78rem] text-ink-faint">{s.ratio}</span></div>}
          </div>

          {file.entries === null && <p className="text-[color:var(--danger)] text-[0.9rem]">{s.notZip}</p>}

          {file.entries && (
            <div className="flex flex-col border border-[color:var(--line-soft)] rounded-md overflow-hidden" data-testid="zip-list">
              {file.entries.map((e, i) => (
                <div key={i} className={`grid grid-cols-[1fr_auto_auto_auto] gap-[0.8rem] items-center px-[0.8rem] py-[0.5rem] border-b border-[color:var(--line-soft)] last:border-b-0 text-[0.9rem] ${e.dir ? 'text-ink-soft' : ''}`} data-testid={`zip-row-${i}`}>
                  <span className="font-mono overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1.5" title={e.name}>
                    {e.dir && <ArchiveIcon />}
                    {e.encrypted && <span title={s.encrypted} data-testid={`zip-locked-${i}`} className="text-gold-500"><LockIcon /></span>}
                    {e.name}
                  </span>
                  <span className="[font-variant-numeric:tabular-nums] text-ink-soft">{e.dir ? s.dir : fmtBytes(e.size)}</span>
                  <span className="text-[0.76rem] text-ink-faint whitespace-nowrap max-[560px]:hidden">{e.date ? dateFmt.format(e.date) : ''}{e.method === 0 && !e.dir ? ` · ${s.stored}` : ''}</span>
                  <span className="flex gap-1">
                    {!e.dir && isText(e.name) && (
                      <Button className="px-2 py-0.5 text-[0.78rem]" data-testid={`zip-preview-${i}`}
                        disabled={busy !== null} onClick={() => extract(i, 'preview')}>{s.preview}</Button>
                    )}
                    {!e.dir && (
                      <Button className="px-2 py-0.5 text-[0.78rem]" data-testid={`zip-get-${i}`}
                        disabled={busy !== null} onClick={() => extract(i, 'save')}>
                        <DownloadIcon /> {busy === i ? s.getting : s.get}
                      </Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {note && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="zip-note">{note}</p>}

          {preview && (
            <div className="flex flex-col gap-1" data-testid="zip-preview-panel">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.82rem] text-ink-faint">{preview.name}</span>
                <Button className="px-2 py-0.5 text-[0.78rem]" data-testid="zip-preview-close" onClick={() => setPreview(null)}>{s.close}</Button>
              </div>
              <pre className="whitespace-pre-wrap rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3 text-[0.82rem] text-ink max-h-[24rem] overflow-auto" dir="auto">{preview.text}</pre>
            </div>
          )}
        </>
      )}
    </Stack>
  )
}
