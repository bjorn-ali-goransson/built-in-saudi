import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon } from '../../components/icons'
import { Button, Input, Select, Textarea, Stack, Check, Panel } from '../../components/ui'
import { DEFAULTS, drawCertificate, buildCertificates, type CertOptions } from './build'

const AR_DEFAULTS: Partial<CertOptions> = {
  title: 'شهادة إتمام',
  intro: 'تشهد هذه الوثيقة بأن',
  body: 'قد أتمّ بنجاح البرنامج التدريبي',
}

const STR = {
  en: {
    names: 'Names, one per line', namesPh: 'Ahmed Al-Otaibi\nفاطمة النور\nKhalid Bin Salem',
    title: 'Title', intro: 'Line above the name', body: 'Line below the name',
    signerLeft: 'Signature (left)', signerRight: 'Signature (right)', date: 'Date',
    landscape: 'Landscape', border: 'Border', accent: 'Accent colour',
    borders: { sadu: 'Sadu weave', rule: 'Double rule', none: 'None' } as Record<string, string>,
    preview: 'Preview', of: 'of',
    count: (n: number) => `${n} certificate${n === 1 ? '' : 's'}`,
    download: 'Download all as one PDF', working: 'Building…',
    empty: 'Add at least one name.',
    bulk: 'One name per line makes one page each — the point of this over a template you retype forty times.',
    arabicNote: 'Arabic names are shaped and laid out right-to-left correctly, including in a list mixed with Latin ones.',
  },
  ar: {
    names: 'الأسماء، اسم في كل سطر', namesPh: 'أحمد العتيبي\nفاطمة النور\nKhalid Bin Salem',
    title: 'العنوان', intro: 'السطر فوق الاسم', body: 'السطر تحت الاسم',
    signerLeft: 'التوقيع (يسار)', signerRight: 'التوقيع (يمين)', date: 'التاريخ',
    landscape: 'أفقي', border: 'الإطار', accent: 'اللون',
    borders: { sadu: 'نقش السدو', rule: 'خط مزدوج', none: 'بلا' } as Record<string, string>,
    preview: 'معاينة', of: 'من',
    count: (n: number) => `${n.toLocaleString('ar')} شهادة`,
    download: 'نزّل الكل في ملف PDF واحد', working: 'جارٍ التجهيز…',
    empty: 'أضف اسمًا واحدًا على الأقل.',
    bulk: 'كل اسم في سطر يعطي صفحة مستقلة — وهذا هو الفرق بين أداة وقالب تعيد كتابته أربعين مرة.',
    arabicNote: 'تُشكَّل الأسماء العربية وتُرتَّب من اليمين لليسار بشكل صحيح، حتى في قائمة مختلطة بأسماء لاتينية.',
  },
}

export default function CertificateTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [o, setO] = useState<CertOptions>({ ...DEFAULTS, ...(locale === 'ar' ? AR_DEFAULTS : {}) })
  const [raw, setRaw] = useState('')
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const hostRef = useRef<HTMLDivElement>(null)

  const names = useMemo(() => raw.split('\n').map((l) => l.trim()).filter(Boolean), [raw])
  const shown = names[Math.min(index, Math.max(0, names.length - 1))] ?? (locale === 'ar' ? 'اسم المشارك' : 'Participant Name')

  const set = (patch: Partial<CertOptions>) => setO((p) => ({ ...p, ...patch }))

  // Preview at screen resolution — the export re-renders at 200 DPI.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const full = drawCertificate(shown, o, 72)
    const thumb = document.createElement('canvas')
    const tw = Math.min(430, host.clientWidth || 430)
    thumb.width = tw
    thumb.height = Math.round((tw / full.width) * full.height)
    thumb.getContext('2d')!.drawImage(full, 0, 0, thumb.width, thumb.height)
    thumb.className = 'w-full h-auto rounded-sm border border-[color:var(--line)] shadow-[var(--shadow-sm)]'
    thumb.setAttribute('data-testid', 'ct-preview')
    host.replaceChildren(thumb)
  }, [shown, o])

  async function download() {
    if (!names.length) return
    setBusy(true)
    try {
      const blob = await buildCertificates(names, o)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'certificates.pdf'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="certificate">
      <div className="flex flex-col min-[860px]:flex-row gap-5">
        <div className="flex flex-col gap-3 min-[860px]:w-[20rem]">
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.names}
            <Textarea className="min-h-[8rem]" dir="auto" data-testid="ct-names"
              placeholder={s.namesPh} value={raw} onChange={(e) => { setRaw(e.target.value); setIndex(0) }} />
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.title}
            <Input dir="auto" data-testid="ct-title" value={o.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.intro}
            <Input dir="auto" data-testid="ct-intro" value={o.intro} onChange={(e) => set({ intro: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.body}
            <Input dir="auto" data-testid="ct-body" value={o.body} onChange={(e) => set({ body: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint flex-1 min-w-[8rem]">
              {s.signerLeft}
              <Input dir="auto" data-testid="ct-signer-left" value={o.signerLeft} onChange={(e) => set({ signerLeft: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint flex-1 min-w-[8rem]">
              {s.signerRight}
              <Input dir="auto" data-testid="ct-signer-right" value={o.signerRight} onChange={(e) => set({ signerRight: e.target.value })} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.date}
            <Input dir="auto" data-testid="ct-date" value={o.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.border}
              <Select className="w-32" data-testid="ct-border" value={o.border}
                onChange={(e) => set({ border: e.target.value as CertOptions['border'] })}>
                {['sadu', 'rule', 'none'].map((b) => <option key={b} value={b}>{s.borders[b]}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.accent}
              <Input type="color" className="w-16 h-9 p-1" data-testid="ct-accent"
                value={o.accent} onChange={(e) => set({ accent: e.target.value })} />
            </label>
            <Check>
              <input type="checkbox" checked={o.landscape} data-testid="ct-landscape"
                onChange={(e) => set({ landscape: e.target.checked })} /> {s.landscape}
            </Check>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.preview}</span>
            {names.length > 1 && (
              <span className="flex items-center gap-1 text-[0.82rem] text-ink-faint">
                <Button className="px-2 py-0.5" data-testid="ct-prev" onClick={() => setIndex((i) => Math.max(0, i - 1))}>‹</Button>
                <span className="font-mono" data-testid="ct-index">{Math.min(index, names.length - 1) + 1} {s.of} {names.length}</span>
                <Button className="px-2 py-0.5" data-testid="ct-next" onClick={() => setIndex((i) => Math.min(names.length - 1, i + 1))}>›</Button>
              </span>
            )}
          </div>
          <div ref={hostRef} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.9rem] font-semibold text-ink" data-testid="ct-count">{s.count(names.length)}</span>
        <Button variant="primary" onClick={download} disabled={!names.length || busy} data-testid="ct-download">
          <DownloadIcon /> {busy ? s.working : s.download}
        </Button>
        {!names.length && <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.empty}</span>}
      </div>

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.bulk}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.arabicNote}</p>
      </Panel>
    </Stack>
  )
}
