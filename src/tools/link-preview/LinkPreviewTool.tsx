import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Stack, Seg, SegButton } from '../../components/ui'
import { TagIcon } from '../../components/icons'

// Parse the <meta> tags someone pastes, rather than fetching their page: a
// browser cannot read another origin's HTML, and any tool that claims to is
// proxying your URL through its own server. Paste is honest and works offline.
interface Meta {
  title: string
  description: string
  image: string
  siteName: string
  url: string
  card: string
}

function parseTags(html: string): Partial<Meta> {
  const out: Partial<Meta> = {}
  const doc = new DOMParser().parseFromString(`<head>${html}</head>`, 'text/html')
  const get = (sel: string) => doc.querySelector(sel)?.getAttribute('content')?.trim() || ''
  out.title = get('meta[property="og:title"]') || get('meta[name="twitter:title"]') || doc.querySelector('title')?.textContent?.trim() || ''
  out.description = get('meta[property="og:description"]') || get('meta[name="twitter:description"]') || get('meta[name="description"]')
  out.image = get('meta[property="og:image"]') || get('meta[name="twitter:image"]')
  out.siteName = get('meta[property="og:site_name"]')
  out.url = get('meta[property="og:url"]')
  out.card = get('meta[name="twitter:card"]')
  return out
}

type Platform = 'whatsapp' | 'x' | 'linkedin' | 'facebook'

const STR = {
  en: {
    paste: 'Paste your <meta> tags…',
    hint: 'Paste the head tags from your page and see how the link will actually look when someone shares it. Nothing is fetched — a browser cannot read another site’s HTML, and any tool that says otherwise is sending your URL through its own server.',
    fields: 'Or fill them in',
    title: 'Title', description: 'Description', image: 'Image URL', site: 'Site name', url: 'URL',
    platform: 'Preview as',
    problems: 'What will go wrong',
    noTitle: 'No og:title — the platform will fall back to the page title, or the bare URL.',
    noDesc: 'No og:description — most platforms show nothing at all rather than guessing.',
    noImage: 'No og:image — the card shrinks to a text-only line and gets far less attention.',
    relImage: 'og:image is a relative path. Most crawlers will not resolve it — use a full https:// URL.',
    longTitle: (n: number) => `Title is ${n} characters. X truncates around 70 and WhatsApp much earlier.`,
    longDesc: (n: number) => `Description is ${n} characters. Expect it to be cut around 160–200.`,
    noCard: 'No twitter:card — X defaults to the small summary card rather than the large image one.',
    good: 'Nothing obviously missing.',
    fromTool: 'Generate the tags',
  },
  ar: {
    paste: 'الصق وسوم ‎<meta>‎ الخاصة بك…',
    hint: 'الصق وسوم رأس صفحتك لترى كيف سيظهر الرابط فعلًا عند مشاركته. لا يُجلب شيء — فالمتصفح لا يستطيع قراءة HTML موقع آخر، وأي أداة تدّعي غير ذلك ترسل رابطك عبر خادمها.',
    fields: 'أو املأها يدويًا',
    title: 'العنوان', description: 'الوصف', image: 'رابط الصورة', site: 'اسم الموقع', url: 'الرابط',
    platform: 'المعاينة كـ',
    problems: 'ما الذي سيختل',
    noTitle: 'لا يوجد og:title — ستعود المنصة إلى عنوان الصفحة أو إلى الرابط المجرّد.',
    noDesc: 'لا يوجد og:description — ومعظم المنصات لا تعرض شيئًا بدلًا من التخمين.',
    noImage: 'لا يوجد og:image — تتقلّص البطاقة إلى سطر نصي وتحظى باهتمام أقل بكثير.',
    relImage: 'قيمة og:image مسار نسبي، ومعظم الزواحف لن تحلّه — استخدم رابطًا كاملًا يبدأ بـ‎https://‎.',
    longTitle: (n: number) => `طول العنوان ${n.toLocaleString('ar')} محرفًا. تقتطعه إكس عند نحو ٧٠ وواتساب قبل ذلك بكثير.`,
    longDesc: (n: number) => `طول الوصف ${n.toLocaleString('ar')} محرفًا. توقّع اقتطاعه عند ١٦٠–٢٠٠.`,
    noCard: 'لا يوجد twitter:card — وستستخدم إكس البطاقة الصغيرة بدل بطاقة الصورة الكبيرة.',
    good: 'لا ينقص شيء ظاهر.',
    fromTool: 'ولّد الوسوم',
  },
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' }, { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' }, { id: 'facebook', label: 'Facebook' },
]

export default function LinkPreviewTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [html, setHtml] = useState('')
  const [manual, setManual] = useState<Partial<Meta>>({})
  const [platform, setPlatform] = useState<Platform>('whatsapp')

  const parsed = useMemo(() => (html.trim() ? parseTags(html) : {}), [html])
  const meta: Meta = {
    title: manual.title ?? parsed.title ?? '',
    description: manual.description ?? parsed.description ?? '',
    image: manual.image ?? parsed.image ?? '',
    siteName: manual.siteName ?? parsed.siteName ?? '',
    url: manual.url ?? parsed.url ?? '',
    card: parsed.card ?? '',
  }

  const problems = useMemo(() => {
    const out: string[] = []
    if (!meta.title) out.push(s.noTitle)
    else if (meta.title.length > 70) out.push(s.longTitle(meta.title.length))
    if (!meta.description) out.push(s.noDesc)
    else if (meta.description.length > 200) out.push(s.longDesc(meta.description.length))
    if (!meta.image) out.push(s.noImage)
    else if (!/^https?:\/\//i.test(meta.image)) out.push(s.relImage)
    if (html.trim() && !meta.card) out.push(s.noCard)
    return out
  }, [meta, html, s])

  const host = (() => {
    try { return new URL(meta.url).hostname.replace(/^www\./, '') } catch { return meta.siteName || 'example.com' }
  })()

  const set = (patch: Partial<Meta>) => setManual({ ...manual, ...patch })

  return (
    <Stack data-testid="link-preview">
      <Textarea className="min-h-[7rem] font-mono text-[0.8rem]" dir="ltr" data-testid="lp-html"
        placeholder={s.paste} value={html} onChange={(e) => { setHtml(e.target.value); setManual({}) }} />

      <details className="border border-[color:var(--line)] rounded-md bg-[var(--surface)] px-3 py-2">
        <summary className="text-[0.88rem] text-ink-soft cursor-pointer rtl:font-ar">{s.fields}</summary>
        <div className="flex flex-col gap-2 pt-3">
          <Input placeholder={s.title} data-testid="lp-title" value={meta.title} onChange={(e) => set({ title: e.target.value })} />
          <Input placeholder={s.description} data-testid="lp-desc" value={meta.description} onChange={(e) => set({ description: e.target.value })} />
          <Input dir="ltr" placeholder={s.image} data-testid="lp-image" value={meta.image} onChange={(e) => set({ image: e.target.value })} />
          <Input dir="ltr" placeholder={s.url} data-testid="lp-url" value={meta.url} onChange={(e) => set({ url: e.target.value })} />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.platform}</span>
        <Seg>
          {PLATFORMS.map((p) => (
            <SegButton key={p.id} active={platform === p.id} data-testid={`lp-${p.id}`} onClick={() => setPlatform(p.id)}>
              {p.label}
            </SegButton>
          ))}
        </Seg>
      </div>

      <div className="flex justify-center" data-testid="lp-preview">
        <Card platform={platform} meta={meta} host={host} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.problems}</h2>
        {problems.length === 0 ? (
          <p className="text-[0.95rem] text-green-700 rtl:font-ar" data-testid="lp-good">{s.good}</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="lp-problems">
            {problems.map((p, i) => (
              <li key={i} className="text-[0.9rem] text-ink-soft rtl:font-ar border-s-[3px] border-gold-500 ps-3">{p}</li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.hint}</p>
      <Button to={`/${locale}/apps/meta-tags`} className="self-start"><TagIcon /> {s.fromTool}</Button>
    </Stack>
  )
}

function Card({ platform, meta, host }: { platform: Platform; meta: Meta; host: string }) {
  const title = meta.title || host
  const wide = platform !== 'whatsapp'
  const img = meta.image && /^https?:\/\//i.test(meta.image) ? meta.image : ''

  if (platform === 'whatsapp') {
    return (
      <div className="w-full max-w-[22rem] rounded-lg overflow-hidden bg-[#dcf8c6] p-2 shadow-[var(--shadow-sm)]" dir="ltr">
        <div className="bg-white/70 rounded-md overflow-hidden">
          {img && <img src={img} alt="" className="w-full h-32 object-cover" />}
          <div className="p-2 flex flex-col gap-0.5">
            <span className="text-[0.85rem] font-semibold text-[#111] line-clamp-2">{title}</span>
            {meta.description && <span className="text-[0.75rem] text-[#555] line-clamp-2">{meta.description}</span>}
            <span className="text-[0.7rem] text-[#888]">{host}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${wide ? 'max-w-[28rem]' : 'max-w-[22rem]'} rounded-lg overflow-hidden border border-[color:var(--line)] bg-[var(--surface)]`} dir="ltr">
      {img && <img src={img} alt="" className="w-full h-40 object-cover bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)]" />}
      <div className="p-3 flex flex-col gap-1">
        <span className="text-[0.72rem] uppercase tracking-[0.04em] text-ink-faint">{host}</span>
        <span className="text-[0.95rem] font-semibold text-ink line-clamp-2">{title}</span>
        {meta.description && <span className="text-[0.82rem] text-ink-soft line-clamp-2">{meta.description}</span>}
      </div>
    </div>
  )
}
