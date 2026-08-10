import { useMemo, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Seg, SegButton, FileError } from '../../components/ui'
import { UploadIcon } from '../../components/icons'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import {
  PAPERS, ppiForDistance, fitToPaper, verdict, maxCm, ARCMIN_PER_RADIAN,
  type Verdict,
} from './print'

const PAPER_LABEL: Record<string, { en: string; ar: string }> = {
  a6: { en: 'A6', ar: 'A6' }, a5: { en: 'A5', ar: 'A5' }, a4: { en: 'A4', ar: 'A4' },
  a3: { en: 'A3', ar: 'A3' }, a2: { en: 'A2', ar: 'A2' }, a1: { en: 'A1', ar: 'A1' },
  a0: { en: 'A0', ar: 'A0' },
  photo10x15: { en: '10 × 15 cm', ar: '١٠ × ١٥ سم' },
  photo13x18: { en: '13 × 18 cm', ar: '١٣ × ١٨ سم' },
  photo20x30: { en: '20 × 30 cm', ar: '٢٠ × ٣٠ سم' },
}

const STR = {
  en: {
    intro: 'How big this photo can be printed before the pixels show — worked out from the picture itself, not from a number you have to look up. Nothing is uploaded.',
    pick: 'Choose an image', drop: 'or drop one here', orType: 'or type the pixel size',
    width: 'Width (px)', height: 'Height (px)',
    paper: 'Paper', portrait: 'Portrait', landscape: 'Landscape',
    distance: 'Viewing distance (cm)',
    needed: 'Needed at that distance', get: 'You would get', printed: 'Printed size',
    largest: 'Largest print that still meets it',
    verdicts: {
      plenty: 'Plenty — more pixels than the eye can resolve at that distance.',
      enough: 'Close enough — the shortfall is inside the range of ordinary eyesight.',
      short: 'Short — the pixel grid would be visible at that distance.',
    } as Record<Verdict, string>,
    letterbox: 'The sheet is a different shape from the picture, so there will be a margin. The size above keeps the picture’s own proportions rather than stretching it.',
    dpiTitle: '“300 DPI” is arm’s length, not a law',
    dpiBody: `A 20/20 eye resolves about one arcminute, and there are ${ARCMIN_PER_RADIAN} arcminutes in a radian — so the density that just saturates it is ${ARCMIN_PER_RADIAN} divided by the viewing distance in inches. At 11.5 inches, which is roughly how you hold a photograph, that is 300. That is where the number comes from, and it falls away with distance: a poster read from two metres saturates the eye at about 44 PPI, seven times fewer pixels. Every print-size calculator prints the 300; none of them says when it stops applying.`,
    pixelTitle: 'A pixel has no size',
    pixelBody: 'The DPI field inside a JPEG is metadata, and most software ignores it — changing it alters nothing about the image. What decides the print is the pixel count divided by the physical size, and nothing else. That is why this asks for the picture rather than for a number.',
    upTitle: 'Enlarging does not add detail',
    upBody: 'Resampling to more pixels makes the file bigger and the print no sharper: the information was not captured. If the answer here is short, the fix is a smaller print or a longer viewing distance, not a bigger file.',
    compress: 'Making the file smaller instead: Image Compressor',
    crop: 'Cropping to a shape: Image Cropper',
    noImage: 'Pick an image, or type the pixel size.',
  },
  ar: {
    intro: 'إلى أي مقاس يمكن طباعة هذه الصورة قبل أن تظهر البكسلات — محسوبًا من الصورة نفسها لا من رقم عليك البحث عنه. ولا يُرفع شيء.',
    pick: 'اختر صورة', drop: 'أو أفلتها هنا', orType: 'أو اكتب المقاس بالبكسل',
    width: 'العرض (بكسل)', height: 'الارتفاع (بكسل)',
    paper: 'الورق', portrait: 'طولي', landscape: 'عرضي',
    distance: 'مسافة النظر (سم)',
    needed: 'المطلوب عند تلك المسافة', get: 'ستحصل على', printed: 'المقاس المطبوع',
    largest: 'أكبر طباعة تحقق ذلك',
    verdicts: {
      plenty: 'أكثر من كافٍ — بكسلات أكثر مما تميّزه العين عند تلك المسافة.',
      enough: 'قريب بما يكفي — النقص داخل مدى الإبصار المعتاد.',
      short: 'غير كافٍ — ستظهر شبكة البكسلات عند تلك المسافة.',
    } as Record<Verdict, string>,
    letterbox: 'شكل الورقة يختلف عن شكل الصورة، فسيبقى هامش. والمقاس أعلاه يحافظ على نسب الصورة بدل تمطيطها.',
    dpiTitle: '«٣٠٠ نقطة في البوصة» مسافة ذراع لا قاعدة',
    dpiBody: `تميّز العين السليمة نحو دقيقة قوسية واحدة، وفي الراديان ${ARCMIN_PER_RADIAN} دقيقة قوسية — فالكثافة التي تُشبع العين هي ${ARCMIN_PER_RADIAN} مقسومة على مسافة النظر بالبوصة. وعند ١١٫٥ بوصة، وهي تقريبًا كيف تمسك صورة بيدك، يكون الناتج ٣٠٠. من هنا جاء الرقم، وهو يتناقص مع المسافة: فملصق يُنظر إليه من مترين يُشبع العين عند نحو ٤٤ نقطة في البوصة، أي سُبع البكسلات. وكل حاسبات مقاس الطباعة تطبع الـ٣٠٠ ولا يقول أيٌّ منها متى يتوقف انطباقه.`,
    pixelTitle: 'البكسل لا حجم له',
    pixelBody: 'حقل الـDPI داخل ملف JPEG بيانات وصفية تتجاهلها أكثر البرامج، وتغييره لا يغيّر شيئًا في الصورة. والذي يحدّد الطباعة هو عدد البكسلات مقسومًا على المقاس الفعلي، لا غير. ولهذا تطلب هذه الأداة الصورة لا رقمًا.',
    upTitle: 'التكبير لا يضيف تفاصيل',
    upBody: 'إعادة التحجيم إلى بكسلات أكثر تكبّر الملف ولا تزيد الطباعة وضوحًا: فالمعلومة لم تُلتقط أصلًا. وإن كان الجواب هنا «غير كافٍ» فالحل مقاس أصغر أو مسافة أبعد، لا ملف أكبر.',
    compress: 'لتصغير حجم الملف بدلًا من ذلك: ضاغط الصور',
    crop: 'للقص إلى شكل معيّن: قصّ الصور',
    noImage: 'اختر صورة أو اكتب المقاس بالبكسل.',
  },
}

export default function PrintSizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [px, setPx] = useState('4032')
  const [py, setPy] = useState('3024')
  const [paperId, setPaperId] = useState('a4')
  const [landscape, setLandscape] = useState(true)
  const [distance, setDistance] = useState('30')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // No `accept` and no MIME gate: Android hands over files with an empty type,
  // and the decoder is the authority on whether this is an image.
  async function pick(file?: File | null) {
    if (!file) return
    setError('')
    try {
      const bmp = await decodeImage(file)
      if (!bmp) throw new Error('decode')
      setPx(String(bmp.width))
      setPy(String(bmp.height))
      setLandscape(bmp.width >= bmp.height)
      setName(file.name)
    } catch {
      setError(await whyUnreadable(file, locale))
    }
  }

  const w = Number(px) || 0
  const h = Number(py) || 0
  const paper = PAPERS.find((p) => p.id === paperId) ?? PAPERS[2]
  const dist = Number(distance) || 30

  const needed = useMemo(() => ppiForDistance(dist), [dist])
  const fit = useMemo(() => fitToPaper(w, h, paper, landscape), [w, h, paper, landscape])
  const v = verdict(fit.ppi, needed)
  const largest = useMemo(() => maxCm(w, needed), [w, needed])

  const loc = locale === 'ar' ? 'ar-SA' : 'en-US'
  const n = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d })

  const tone: Record<Verdict, string> = {
    plenty: 'text-green-700', enough: 'text-ink', short: 'text-gold-500',
  }

  return (
    <Stack data-testid="print-size">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <div
        data-testid="ps-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]) }}
        className="flex flex-col items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[color:var(--line)] bg-[var(--surface)] px-4 py-6"
      >
        <input ref={inputRef} type="file" className="hidden" data-testid="ps-file"
          onChange={(e) => void pick(e.target.files?.[0])} />
        <Button className="px-3 py-1" onClick={() => inputRef.current?.click()}>
          <UploadIcon /> {s.pick}
        </Button>
        <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.drop} · {s.orType}</span>
        {name && <span className="font-mono text-[0.82rem] text-ink-soft" data-testid="ps-name">{name}</span>}
      </div>

      {error && <FileError message={error} />}

      <div className="flex flex-wrap items-end gap-3">
        <Field label={s.width}>
          <Input type="number" min={1} className="w-[7rem]" value={px} data-testid="ps-w" onChange={(e) => setPx(e.target.value)} />
        </Field>
        <Field label={s.height}>
          <Input type="number" min={1} className="w-[7rem]" value={py} data-testid="ps-h" onChange={(e) => setPy(e.target.value)} />
        </Field>
        <Field label={s.paper}>
          <select className="rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-2 py-[0.45rem] text-[0.9rem] text-ink"
            value={paperId} data-testid="ps-paper" onChange={(e) => setPaperId(e.target.value)}>
            {PAPERS.map((p) => <option key={p.id} value={p.id}>{PAPER_LABEL[p.id][locale]}</option>)}
          </select>
        </Field>
        <Seg>
          <SegButton active={!landscape} data-testid="ps-portrait" onClick={() => setLandscape(false)}>{s.portrait}</SegButton>
          <SegButton active={landscape} data-testid="ps-landscape" onClick={() => setLandscape(true)}>{s.landscape}</SegButton>
        </Seg>
        <Field label={s.distance}>
          <Input type="number" min={10} max={1000} step={10} className="w-[7rem]" value={distance} data-testid="ps-distance" onChange={(e) => setDistance(e.target.value)} />
        </Field>
      </div>

      {w > 0 && h > 0 ? (
        <>
          <Panel className="gap-2">
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.printed}</div>
                <div className="font-mono text-[1.4rem] text-ink" data-testid="ps-printed">{n(fit.wCm, 1)} × {n(fit.hCm, 1)} cm</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.get}</div>
                <div className={`font-mono text-[1.8rem] font-semibold ${tone[v]}`} data-testid="ps-ppi">{n(fit.ppi)} PPI</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.needed}</div>
                <div className="font-mono text-[1.4rem] text-ink-soft" data-testid="ps-needed">{n(needed)} PPI</div>
              </div>
            </div>
            <p className={`text-[0.95rem] rtl:font-ar ${tone[v]}`} data-testid="ps-verdict">{s.verdicts[v]}</p>
            <p className="text-[0.88rem] text-ink-faint rtl:font-ar">
              {s.largest}: <span className="font-mono text-ink" data-testid="ps-largest">{n(largest, 1)} cm</span>
            </p>
            {fit.letterboxed && (
              <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="ps-letterbox">{s.letterbox}</p>
            )}
          </Panel>
        </>
      ) : (
        <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="ps-empty">{s.noImage}</p>
      )}

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.dpiTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ps-dpi-note">{s.dpiBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.pixelTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ps-pixel-note">{s.pixelBody}</p>
      </Panel>

      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.upTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ps-upscale-note">{s.upBody}</p>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button className="px-3 py-1" to={localePath(locale, '/apps/image-compressor')} data-testid="ps-compress">{s.compress}</Button>
        <Button className="px-3 py-1" to={localePath(locale, '/apps/image-cropper')} data-testid="ps-crop">{s.crop}</Button>
      </div>
    </Stack>
  )
}
