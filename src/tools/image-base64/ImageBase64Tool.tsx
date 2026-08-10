import { useEffect, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Seg, SegButton, Textarea, FileError } from '../../components/ui'
import { UploadIcon, CopyIcon, DownloadIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { decodeImage } from '../../lib/decodeImage'
import { isHeic, whyUnreadable } from '../../lib/imageInput'
import {
  encodeImage, wrapUri, overhead, decodeDataUri, sniffMime, EXT,
  type Encoded, type Wrap,
} from './dataUri'

const WIP = 'image-base64'

const STR = {
  en: {
    intro: 'Turn an image into a data URI you can paste straight into CSS, HTML or Markdown — or paste one back and get the image. It runs entirely in your browser; the picture is never uploaded.',
    toUri: 'Image → data URI', toImage: 'Data URI → image',
    pick: 'Choose an image', drop: 'or drop one here',
    wrap: 'Wrap as', wraps: { raw: 'Plain', css: 'CSS', html: 'HTML', markdown: 'Markdown' } as Record<Wrap, string>,
    copy: 'Copy', copied: 'Copied',
    size: (raw: string, out: string, pct: string) => `${raw} of image becomes ${out} of text — ${pct} bigger`,
    costTitle: 'Embedding an image makes it bigger, not smaller',
    costBody: 'Base64 carries three bytes in four characters, so the payload grows by about a third. On a very small image it is much worse than that, because the “data:image/png;base64,” prefix is a fixed twenty-odd characters however tiny the picture — which is why a 100-byte icon comes out nearly 60% bigger. That is the trade: one fewer request, a third more bytes or worse, and an image that can no longer be cached separately from the file carrying it. Worth it for a small icon in a stylesheet; rarely worth it for a photograph.',
    svgTitle: 'For SVG, base64 is the wrong encoding',
    svgBody: 'An SVG is already text, so escaping only what is structural beats encoding the whole thing. Measured on this site’s own icons, that is 23% smaller than base64 every time. And the obvious alternative is worse than both: encodeURIComponent escapes so much that it comes out 13% BIGGER than base64. This tool takes the minimal path automatically.',
    svgUsed: 'Percent-encoded rather than base64 — smaller, for the reason below.',
    heicTitle: 'An iPhone photo has no data URI a browser can show',
    heicBody: 'No engine outside Safari renders HEIC, so embedding one produces a broken image everywhere else. This decoded it on your device and encoded a PNG instead, which is why the output says PNG.',
    paste: 'Paste a data URI or a base64 blob',
    save: 'Download the image',
    notImage: 'That does not decode to an image.',
    detected: (t: string) => `Detected ${t}`,
    other: 'Base64 for text, not images: Base64 Encoder',
  },
  ar: {
    intro: 'حوّل صورة إلى data URI تلصقه مباشرةً في CSS أو HTML أو ماركداون — أو ألصق واحدًا واسترجع الصورة. يعمل بالكامل داخل متصفحك؛ ولا تُرفع الصورة أبدًا.',
    toUri: 'صورة ← data URI', toImage: 'data URI ← صورة',
    pick: 'اختر صورة', drop: 'أو أفلتها هنا',
    wrap: 'الصيغة', wraps: { raw: 'نصّ فقط', css: 'CSS', html: 'HTML', markdown: 'ماركداون' } as Record<Wrap, string>,
    copy: 'نسخ', copied: 'نُسخ',
    size: (raw: string, out: string, pct: string) => `${raw} من الصورة تصير ${out} من النص — أكبر بـ${pct}`,
    costTitle: 'تضمين الصورة يكبّرها لا يصغّرها',
    costBody: 'يحمل base64 ثلاثة بايتات في أربعة أحرف، فتكبر الحمولة نحو الثلث. وفي الصورة الصغيرة جدًا يكون الأمر أسوأ، لأن البادئة «data:image/png;base64,» طولها عشرون حرفًا وبضعة مهما صغرت الصورة — ولهذا تخرج أيقونة بمئة بايت أكبر بنحو ٦٠٪. وهذه هي المقايضة: طلب أقل، وبايتات أكثر بالثلث أو أكثر، وصورة لم يعد يمكن تخزينها مؤقتًا بمعزل عن الملف الحامل لها. يستحق ذلك في أيقونة صغيرة داخل ملف أنماط، ونادرًا ما يستحق في صورة فوتوغرافية.',
    svgTitle: 'في SVG يكون base64 هو الترميز الخطأ',
    svgBody: 'ملف SVG نصّ أصلًا، فالاكتفاء بترميز ما هو بنيويّ أفضل من ترميز الكل. وقياسًا على أيقونات هذا الموقع نفسها، ذلك أصغر من base64 بنسبة ٢٣٪ في كل مرة. والبديل البديهي أسوأ منهما: فـencodeURIComponent يهرّب من الأحرف ما يجعله أكبر من base64 بـ١٣٪. وهذه الأداة تسلك المسار الأصغر تلقائيًا.',
    svgUsed: 'رُمّز بالنسبة المئوية لا بـbase64 — أصغر، للسبب أدناه.',
    heicTitle: 'صورة الآيفون ليس لها data URI يعرضه المتصفح',
    heicBody: 'لا يفكّ ترميز HEIC محرّكٌ خارج سفاري، فتضمينها يعطي صورة مكسورة في غيره. وقد فُكّ ترميزها على جهازك ورُمّزت PNG بدلًا منها، ولهذا يظهر PNG في المخرجات.',
    paste: 'ألصق data URI أو نصّ base64',
    save: 'نزّل الصورة',
    notImage: 'هذا لا يفكّ إلى صورة.',
    detected: (t: string) => `المكتشف ${t}`,
    other: 'ترميز النصوص لا الصور: مُرمِّز Base64',
  },
}

export default function ImageBase64Tool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [enc, setEnc] = useState<Encoded | null>(null)
  const [wrap, setWrap] = useState<Wrap>('raw')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [transcoded, setTranscoded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [paste, setPaste] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress(WIP, false), [])

  // No `accept` and no MIME gate: Android hands over files with an empty type,
  // and the decoder is the authority on whether this is an image.
  async function pick(file?: File | null) {
    if (!file) return
    setError('')
    setTranscoded(false)
    setName(file.name)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const mime = file.type || sniffMime(buf)

      if (await isHeic(file)) {
        // Embedding HEIC produces a broken image outside Safari, so it is
        // decoded here and re-encoded as something every browser can show.
        const bmp = await decodeImage(file)
        if (!bmp) throw new Error('heic')
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        canvas.getContext('2d')!.drawImage(bmp, 0, 0)
        const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'))
        if (!blob) throw new Error('heic')
        const png = new Uint8Array(await blob.arrayBuffer())
        setEnc(encodeImage(png, 'image/png'))
        setTranscoded(true)
      } else if (mime === 'image/svg+xml' || sniffMime(buf) === 'image/svg+xml') {
        setEnc(encodeImage(buf, 'image/svg+xml', new TextDecoder().decode(buf)))
      } else {
        // Verify it really decodes before claiming a data URI for it, so the
        // failure surfaces here rather than as a broken image in someone's CSS.
        if (!(await decodeImage(file))) throw new Error('decode')
        setEnc(encodeImage(buf, mime))
      }
      setWorkInProgress(WIP, true)
    } catch {
      setEnc(null)
      setError(await whyUnreadable(file, locale))
    }
  }

  const decoded = decodeDataUri(paste)

  function save() {
    if (!decoded) return
    const blob = new Blob([decoded.bytes as BlobPart], { type: decoded.mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `image.${EXT[decoded.mime] ?? 'bin'}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`
  const out = enc ? wrapUri(enc.uri, wrap, name.replace(/\.[^.]+$/, '') || 'image') : ''

  return (
    <Stack data-testid="image-base64">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Seg>
        <SegButton active={mode === 'encode'} data-testid="ib-mode-encode" onClick={() => setMode('encode')}>{s.toUri}</SegButton>
        <SegButton active={mode === 'decode'} data-testid="ib-mode-decode" onClick={() => setMode('decode')}>{s.toImage}</SegButton>
      </Seg>

      {mode === 'encode' ? (
        <>
          <div
            data-testid="ib-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]) }}
            className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[color:var(--line)] bg-[var(--surface)] px-4 py-8"
          >
            <input ref={inputRef} type="file" className="hidden" data-testid="ib-file"
              onChange={(e) => void pick(e.target.files?.[0])} />
            <Button className="px-3 py-1" onClick={() => inputRef.current?.click()}>
              <UploadIcon /> {s.pick}
            </Button>
            <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.drop}</span>
            {name && <span className="font-mono text-[0.82rem] text-ink-soft" data-testid="ib-name">{name}</span>}
          </div>

          {error && <FileError message={error} />}

          {enc && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Seg>
                  {(['raw', 'css', 'html', 'markdown'] as Wrap[]).map((w) => (
                    <SegButton key={w} active={wrap === w} data-testid={`ib-wrap-${w}`} onClick={() => setWrap(w)}>{s.wraps[w]}</SegButton>
                  ))}
                </Seg>
                <Button className="px-3 py-1" data-testid="ib-copy"
                  onClick={() => { void navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                  <CopyIcon /> {copied ? s.copied : s.copy}
                </Button>
              </div>

              <Textarea rows={7} readOnly value={out} data-testid="ib-output" className="font-mono text-[0.78rem]" />

              <p className="text-[0.88rem] text-ink-faint rtl:font-ar" data-testid="ib-size">
                {s.size(kb(enc.bytes), kb(enc.chars), `${overhead(enc).toFixed(0)}%`)}
              </p>

              {enc.minimal && (
                <p className="text-[0.88rem] text-green-700 rtl:font-ar" data-testid="ib-minimal">{s.svgUsed}</p>
              )}

              {transcoded && (
                <Panel className="gap-1 border-gold-500">
                  <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.heicTitle}</div>
                  <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ib-heic">{s.heicBody}</p>
                </Panel>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <Textarea rows={7} value={paste} placeholder={s.paste} data-testid="ib-paste"
            className="font-mono text-[0.78rem]" onChange={(e) => setPaste(e.target.value)} />
          {paste.trim() && !decoded && <FileError message={s.notImage} />}
          {decoded && (
            <Panel className="gap-2 items-start">
              <div className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="ib-detected">
                {s.detected(decoded.mime)} · {kb(decoded.bytes.length)}
              </div>
              <Button variant="primary" className="px-3 py-1" onClick={save} data-testid="ib-save">
                <DownloadIcon /> {s.save}
              </Button>
            </Panel>
          )}
        </>
      )}

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.costTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ib-cost">{s.costBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.svgTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ib-svg-note">{s.svgBody}</p>
      </Panel>

      <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/base64')} data-testid="ib-text">{s.other}</Button>
    </Stack>
  )
}
