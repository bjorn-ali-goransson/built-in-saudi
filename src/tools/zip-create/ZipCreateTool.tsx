import { useMemo, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Input, Field, Check, FileError } from '../../components/ui'
import { UploadIcon, DownloadIcon, TrashIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { zipFile, type ZipEntry } from '../../lib/zip'

const WIP = 'zip-create'

/** Extensions whose contents already carry a compressed stream. */
const ALREADY = /\.(png|jpe?g|webp|avif|heic|gif|pdf|zip|docx|xlsx|pptx|epub|mp4|m4a|mp3|ogg|webm|woff2?|gz|br)$/i

const STR = {
  en: {
    intro: 'Put several files into one .zip, on your device. Nothing is uploaded — which is the point, because “zip files online” otherwise means handing a stranger everything you were trying to bundle.',
    pick: 'Choose files', drop: 'or drop them here',
    name: 'Archive name', empty: 'No files yet.',
    total: (n: number, raw: string) => `${n} file${n === 1 ? '' : 's'} · ${raw}`,
    build: 'Download .zip', building: 'Compressing…',
    result: (packed: string, saved: string) => `${packed} — ${saved} smaller`,
    resultNone: (packed: string) => `${packed} — nothing to squeeze out`,
    remove: 'Remove',
    keepPaths: 'Keep folder names from dropped folders',
    dupTitle: 'Two files with the same name',
    dupBody: 'An archive with two entries of the same name extracts to one file, silently, and which one survives is up to the extractor. The repeats have been numbered.',
    compTitle: 'Some of these will not get smaller',
    compBody: 'A photo, a PDF, an MP4 and an Office document already carry a compressed stream inside them — squeezing them again buys a few percent and costs time, so those are stored as they are. Text, CSV, SVG and code are where the saving is: measured on this site’s own payloads, 83–98%.',
    pwTitle: 'There is no password option, and that is deliberate',
    pwBody: 'ZIP’s built-in password is ZipCrypto, which has been broken for decades — a known-plaintext attack recovers the contents in seconds, and the newer AES variant is not read by every extractor. Offering it would look like protection and not be any. If you need the contents unreadable, encrypt the file properly first and put that in the archive.',
    encrypt: 'Real encryption: Encrypt a File',
    inspect: 'The other direction: Open a ZIP',
    tooBig: 'That file is larger than 200 MB. A browser has to hold the whole archive in memory.',
  },
  ar: {
    intro: 'اجمع عدة ملفات في ملف ‎.zip‎ واحد، على جهازك. ولا يُرفع شيء — وهذا هو المقصود، لأن «ضغط الملفات أونلاين» يعني في غير ذلك تسليم غريبٍ كلَّ ما أردت جمعه.',
    pick: 'اختر ملفات', drop: 'أو أفلتها هنا',
    name: 'اسم الملف', empty: 'لا ملفات بعد.',
    total: (n: number, raw: string) => `${n.toLocaleString('ar-SA')} ملف · ${raw}`,
    build: 'نزّل ‎.zip‎', building: 'جارٍ الضغط…',
    result: (packed: string, saved: string) => `${packed} — أصغر بـ${saved}`,
    resultNone: (packed: string) => `${packed} — لا شيء يمكن ضغطه`,
    remove: 'حذف',
    keepPaths: 'أبقِ أسماء المجلدات عند إفلات مجلد',
    dupTitle: 'ملفان بالاسم نفسه',
    dupBody: 'الأرشيف الذي فيه مدخلان بالاسم نفسه يُستخرج إلى ملف واحد بصمت، وأيُّهما يبقى يقرره البرنامج المستخرِج. وقد رُقّمت المكرّرات.',
    compTitle: 'بعض هذه لن يصغر',
    compBody: 'الصورة وملف PDF وملف MP4 ومستندات أوفيس تحمل داخلها تدفقًا مضغوطًا أصلًا — وإعادة ضغطها تكسب نسبة ضئيلة وتكلّف وقتًا، فتُخزَّن كما هي. أما النصوص وCSV وSVG والشيفرة فهي موضع التوفير: وقياسًا على حمولات هذا الموقع نفسه، ٨٣–٩٨٪.',
    pwTitle: 'لا يوجد خيار لكلمة مرور، وهذا مقصود',
    pwBody: 'كلمة مرور ZIP المدمجة هي ZipCrypto، وهي مكسورة منذ عقود — إذ يستعيد هجومُ النص المعروف المحتوى في ثوانٍ، والنسخة الأحدث بمعيار AES لا يقرؤها كل مستخرِج. وعرضها يبدو حمايةً وليس منها شيء. فإن أردت محتوى غير مقروء فشفّر الملف تشفيرًا حقيقيًا أولًا ثم ضعه في الأرشيف.',
    encrypt: 'التشفير الحقيقي: تشفير ملف',
    inspect: 'الاتجاه الآخر: افتح ملف ZIP',
    tooBig: 'هذا الملف أكبر من ٢٠٠ ميغابايت. على المتصفح أن يحتفظ بالأرشيف كاملًا في الذاكرة.',
  },
}

interface Picked { file: File; path: string }

export default function ZipCreateTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [items, setItems] = useState<Picked[]>([])
  const [name, setName] = useState('archive')
  const [keepPaths, setKeepPaths] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ packed: number; raw: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function add(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setResult(null)
    const next: Picked[] = []
    for (const f of Array.from(files)) {
      if (f.size > 200 * 1024 * 1024) { setError(s.tooBig); continue }
      // `webkitRelativePath` is set when a whole folder is chosen, and it is
      // the only way to keep the shape of what was dropped.
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath
      next.push({ file: f, path: rel || f.name })
    }
    setItems((prev) => [...prev, ...next])
    setWorkInProgress(WIP, true)
  }

  const raw = items.reduce((n, i) => n + i.file.size, 0)

  /**
   * Entry names, with repeats numbered.
   *
   * Two entries of the same name extract to ONE file, silently, and which
   * survives is up to the extractor. Numbering is the only honest answer that
   * does not lose a file.
   */
  const names = useMemo(() => {
    const seen = new Map<string, number>()
    return items.map((i) => {
      const base = keepPaths ? i.path : i.path.split('/').pop() || i.path
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      if (n === 1) return base
      const dot = base.lastIndexOf('.')
      return dot > 0 ? `${base.slice(0, dot)} (${n})${base.slice(dot)}` : `${base} (${n})`
    })
  }, [items, keepPaths])

  const hasDuplicate = new Set(names).size !== names.length
    || names.some((n) => /\(\d+\)(\.[^.]+)?$/.test(n))
  const anyIncompressible = items.some((i) => ALREADY.test(i.path))

  async function build() {
    if (!items.length) return
    setBusy(true)
    setError('')
    try {
      const entries: ZipEntry[] = []
      for (const [i, it] of items.entries()) {
        entries.push({ name: names[i], bytes: new Uint8Array(await it.file.arrayBuffer()) })
      }
      const blob = await zipFile(entries)
      setResult({ packed: blob.size, raw })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${name.trim() || 'archive'}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setBusy(false)
    }
  }

  const kb = (n: number) => (n < 1024 * 1024
    ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`)
  const savedPct = result && result.raw > 0
    ? Math.max(0, 100 - (result.packed / result.raw) * 100) : 0

  return (
    <Stack data-testid="zip-create">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div
        data-testid="zc-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files) }}
        className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[color:var(--line)] bg-[var(--surface)] px-4 py-8"
      >
        {/* No `accept`: any file may go into an archive, and on Android an
            accept string sends the picker to the gallery. */}
        <input ref={inputRef} type="file" multiple className="hidden" data-testid="zc-file"
          onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        <Button className="px-3 py-1" onClick={() => inputRef.current?.click()}>
          <UploadIcon /> {s.pick}
        </Button>
        <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.drop}</span>
      </div>

      {error && <FileError message={error} />}

      {items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={s.name}>
              <Input className="w-[12rem]" value={name} data-testid="zc-name" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Check><input type="checkbox" checked={keepPaths} data-testid="zc-paths" onChange={(e) => setKeepPaths(e.target.checked)} /> {s.keepPaths}</Check>
            <span className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="zc-total">{s.total(items.length, kb(raw))}</span>
          </div>

          <div className="flex flex-col gap-1" data-testid="zc-list">
            {items.map((it, i) => (
              <div key={`${it.path}-${i}`} className="flex items-center gap-3 rounded-md border border-[color:var(--line-soft)] bg-[var(--surface)] px-3 py-1.5">
                <span className="flex-1 truncate font-mono text-[0.82rem] text-ink" data-testid="zc-entry">{names[i]}</span>
                <span className="font-mono text-[0.78rem] text-ink-faint">{kb(it.file.size)}</span>
                <Button className="px-2 py-0.5" aria-label={s.remove} data-testid="zc-remove"
                  onClick={() => { setItems((p) => p.filter((_, j) => j !== i)); setResult(null) }}>
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="primary" className="self-start px-3 py-1" disabled={busy} onClick={build} data-testid="zc-build">
            <DownloadIcon /> {busy ? s.building : s.build}
          </Button>

          {result && (
            <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="zc-result">
              {savedPct >= 1
                ? s.result(kb(result.packed), `${savedPct.toFixed(0)}%`)
                : s.resultNone(kb(result.packed))}
            </p>
          )}

          {hasDuplicate && (
            <Panel className="gap-1 border-gold-500">
              <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.dupTitle}</div>
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="zc-dup">{s.dupBody}</p>
            </Panel>
          )}

          {anyIncompressible && (
            <Panel className="gap-1">
              <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.compTitle}</div>
              <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="zc-incompressible">{s.compBody}</p>
            </Panel>
          )}
        </>
      ) : (
        <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="zc-empty">{s.empty}</p>
      )}

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.pwTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="zc-password-note">{s.pwBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/file-encrypt')} data-testid="zc-encrypt">{s.encrypt}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/archive-inspector')} data-testid="zc-inspect">{s.inspect}</Button>
      </div>
    </Stack>
  )
}
