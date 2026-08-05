import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { UploadIcon, DownloadIcon, TrashIcon } from '../../components/icons'
import { Button, Input, Stack, Spinner, FileError, Seg, SegButton, Panel } from '../../components/ui'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { KINDS, simulatePixels, simulateHex, deltaE, collapses, type Kind } from './simulate'

const STR = {
  en: {
    mode: 'Check', palette: 'A palette', image: 'An image',
    colours: 'Colours', add: 'Add a colour', remove: 'Remove',
    pick: 'Choose an image', another: 'Choose another', working: 'Simulating…',
    hint: 'See what your colours look like to someone who cannot distinguish them — and, more usefully, which pairs stop being distinguishable at all.',
    normal: 'Normal vision',
    problems: 'Pairs that collapse',
    problemsNone: 'No pair in this palette becomes indistinguishable.',
    collapsesWith: 'is indistinguishable from',
    under: 'under',
    fix: 'Colour alone is never enough. Add a label, a shape, a pattern or a position — something that survives when the colour does not.',
    method: 'Simulated with the Machado matrices in linear light. Dropping a channel, which many online simulators do, produces images nobody actually sees and hides the failures you came here to find.',
    distance: 'colour distance',
    download: 'Download the simulation',
  },
  ar: {
    mode: 'افحص', palette: 'لوحة ألوان', image: 'صورة',
    colours: 'الألوان', add: 'أضف لونًا', remove: 'حذف',
    pick: 'اختر صورة', another: 'اختر صورة أخرى', working: 'جارٍ المحاكاة…',
    hint: 'شاهد كيف تبدو ألوانك لمن لا يستطيع التمييز بينها — والأهم، أي الأزواج يفقد تمايزه تمامًا.',
    normal: 'الرؤية الطبيعية',
    problems: 'أزواج تتطابق',
    problemsNone: 'لا يوجد زوج في هذه اللوحة يفقد تمايزه.',
    collapsesWith: 'لا يتميّز عن',
    under: 'في حالة',
    fix: 'اللون وحده لا يكفي أبدًا. أضف نصًا أو شكلًا أو نقشًا أو موضعًا — شيئًا يبقى حين يغيب اللون.',
    method: 'محاكاة بمصفوفات ماتشادو في الضوء الخطي. أما إسقاط قناة لونية، كما تفعل كثير من المحاكيات، فينتج صورًا لا يراها أحد فعلًا ويخفي الأخطاء التي جئت تبحث عنها.',
    distance: 'المسافة اللونية',
    download: 'نزّل المحاكاة',
  },
}

// The status palette almost every product ends up with: success green, danger
// red, warning amber. The first two collapse from ΔE 106 to 9 for the most
// common deficiency — which is the point of the tool, so it should be what you
// see on arrival rather than something you have to construct.
const DEFAULT_PALETTE = ['#2e9e4f', '#d64545', '#e0a030', '#3b7dd8', '#8b5fbf']

export default function ColourBlindTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'palette' | 'image'>('palette')
  const [kind, setKind] = useState<Kind>('deuteranopia')
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE)
  const [img, setImg] = useState<ImageBitmap | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const beforeRef = useRef<HTMLCanvasElement>(null)
  const afterRef = useRef<HTMLCanvasElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true); setError('')
    try {
      const bmp = await decodeImage(f)
      if (!bmp) { setError(await whyUnreadable(f, locale)); return }
      setImg(bmp)
    } catch {
      setError(await whyUnreadable(f, locale))
    } finally { setBusy(false) }
  }

  // Draw both canvases whenever the image or the deficiency changes.
  useEffect(() => {
    if (mode !== 'image' || !img) return
    const before = beforeRef.current
    const after = afterRef.current
    if (!before || !after) return
    const scale = Math.min(1, 520 / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    for (const c of [before, after]) { c.width = w; c.height = h }
    const bctx = before.getContext('2d', { willReadFrequently: true })!
    bctx.drawImage(img, 0, 0, w, h)
    const data = bctx.getImageData(0, 0, w, h)
    simulatePixels(data.data, kind)
    after.getContext('2d')!.putImageData(data, 0, 0)
  }, [mode, img, kind])

  // Every pair that is distinguishable now and would not be for this viewer.
  const problems = useMemo(() => {
    const out: { a: string; b: string; before: number; after: number }[] = []
    for (let i = 0; i < palette.length; i++) {
      for (let j = i + 1; j < palette.length; j++) {
        if (collapses(palette[i], palette[j], kind)) {
          out.push({
            a: palette[i], b: palette[j],
            before: deltaE(palette[i], palette[j]),
            after: deltaE(simulateHex(palette[i], kind), simulateHex(palette[j], kind)),
          })
        }
      }
    }
    return out
  }, [palette, kind])

  function download() {
    const c = afterRef.current
    if (!c) return
    c.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `simulated-${kind}.png`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  return (
    <Stack data-testid="colour-blind">
      <div className="flex flex-wrap items-center gap-3">
        <Seg>
          <SegButton active={mode === 'palette'} data-testid="cb-mode-palette" onClick={() => setMode('palette')}>{s.palette}</SegButton>
          <SegButton active={mode === 'image'} data-testid="cb-mode-image" onClick={() => setMode('image')}>{s.image}</SegButton>
        </Seg>
      </div>

      <div className="flex flex-wrap gap-1" data-testid="cb-kinds">
        {KINDS.map((k) => (
          <button key={k.id} data-testid={`cb-kind-${k.id}`} onClick={() => setKind(k.id)}
            className={`px-2.5 py-1.5 text-[0.82rem] rounded-sm border text-start ${kind === k.id ? 'border-green-600 bg-green-600 text-sand-100' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
            <span className="rtl:font-ar">{locale === 'ar' ? k.ar : k.en}</span>
            <span className={`block text-[0.7rem] ${kind === k.id ? 'text-sand-100/70' : 'text-ink-faint'}`}>{k.share}</span>
          </button>
        ))}
      </div>

      {mode === 'palette' ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.colours}</span>
            <div className="flex flex-wrap gap-2" data-testid="cb-palette">
              {palette.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="flex flex-col rounded-md overflow-hidden border border-[color:var(--line)]">
                    <span className="w-20 h-10" style={{ background: c }} title={s.normal} />
                    <span className="w-20 h-10" data-testid={`cb-sim-${i}`}
                      style={{ background: simulateHex(c, kind) }} title={locale === 'ar' ? 'محاكاة' : 'simulated'} />
                  </div>
                  <Input type="color" className="w-20 h-8 p-0.5" data-testid={`cb-colour-${i}`}
                    value={c} onChange={(e) => setPalette(palette.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button onClick={() => setPalette(palette.filter((_, j) => j !== i))} aria-label={s.remove}
                    data-testid={`cb-remove-${i}`} className="text-ink-faint hover:text-ink border-0 bg-transparent p-0.5 [&_svg]:size-4">
                    <TrashIcon />
                  </button>
                </div>
              ))}
              <Button className="self-start px-3 py-1" data-testid="cb-add"
                onClick={() => setPalette([...palette, '#888888'])}>{s.add}</Button>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.problems}</h2>
            {problems.length === 0 ? (
              <p className="text-[0.95rem] text-green-700 rtl:font-ar" data-testid="cb-ok">{s.problemsNone}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="cb-problems">
                {problems.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-[0.9rem] border-s-[3px] border-gold-500 ps-3 py-1">
                    <span className="inline-block size-5 rounded-sm border border-[color:var(--line)]" style={{ background: p.a }} />
                    <span className="font-mono text-[0.82rem]">{p.a}</span>
                    <span className="text-ink-faint rtl:font-ar">{s.collapsesWith}</span>
                    <span className="inline-block size-5 rounded-sm border border-[color:var(--line)]" style={{ background: p.b }} />
                    <span className="font-mono text-[0.82rem]">{p.b}</span>
                    <span className="text-[0.78rem] text-ink-faint font-mono">
                      {s.distance} {p.before.toFixed(0)} → {p.after.toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* No accept filter — Android's picker hides files it has not indexed. */}
            <input ref={fileRef} type="file" className="hidden" data-testid="cb-file" onChange={(e) => pick(e.target.files?.[0])} />
            <Button onClick={() => fileRef.current?.click()} data-testid="cb-pick">
              <UploadIcon /> {img ? s.another : s.pick}
            </Button>
            {busy && <Spinner className="size-5" />}
            {img && <Button onClick={download} data-testid="cb-download"><DownloadIcon /> {s.download}</Button>}
          </div>
          {error && <FileError message={error} />}
          <div className={`grid gap-3 ${img ? 'grid-cols-1 min-[720px]:grid-cols-2' : ''}`}>
            <div className={`flex flex-col gap-1 ${img ? '' : 'hidden'}`}>
              <span className="text-[0.78rem] text-ink-faint rtl:font-ar">{s.normal}</span>
              <canvas ref={beforeRef} data-testid="cb-before" className="max-w-full h-auto rounded-md border border-[color:var(--line)]" />
            </div>
            <div className={`flex flex-col gap-1 ${img ? '' : 'hidden'}`}>
              <span className="text-[0.78rem] text-ink-faint rtl:font-ar">
                {locale === 'ar' ? KINDS.find((k) => k.id === kind)!.ar : KINDS.find((k) => k.id === kind)!.en}
              </span>
              <canvas ref={afterRef} data-testid="cb-after" className="max-w-full h-auto rounded-md border border-[color:var(--line)]" />
            </div>
          </div>
        </>
      )}

      {!img && mode === 'image' && !busy && !error && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.88rem] text-ink rtl:font-ar">{s.fix}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.method}</p>
      </Panel>
    </Stack>
  )
}
