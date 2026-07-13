import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Field, Button, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: { title: 'Page title', desc: 'Description', url: 'Page URL', image: 'Preview image URL', site: 'Site name', twitter: 'Twitter @handle', output: 'Meta tags', preview: 'Share preview', copy: 'Copy', copied: 'Copied!', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { title: 'عنوان الصفحة', desc: 'الوصف', url: 'رابط الصفحة', image: 'رابط صورة المعاينة', site: 'اسم الموقع', twitter: 'حساب تويتر @', output: 'وسوم Meta', preview: 'معاينة المشاركة', copy: 'نسخ', copied: 'تم النسخ!', privacy: 'تُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function MetaTagsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [title, setTitle] = useState('Built in Saudi — Free, honest online tools')
  const [desc, setDesc] = useState('A growing toolbox of fast, free, privacy-first utilities.')
  const [url, setUrl] = useState('https://built-in-saudi.com')
  const [image, setImage] = useState('https://built-in-saudi.com/og.png')
  const [site, setSite] = useState('Built in Saudi')
  const [twitter, setTwitter] = useState('')
  const [copied, setCopied] = useState(false)

  const tags = useMemo(() => {
    const L: string[] = []
    if (title) { L.push(`<title>${esc(title)}</title>`); L.push(`<meta name="title" content="${esc(title)}">`) }
    if (desc) L.push(`<meta name="description" content="${esc(desc)}">`)
    L.push('')
    L.push('<!-- Open Graph -->')
    L.push('<meta property="og:type" content="website">')
    if (url) L.push(`<meta property="og:url" content="${esc(url)}">`)
    if (title) L.push(`<meta property="og:title" content="${esc(title)}">`)
    if (desc) L.push(`<meta property="og:description" content="${esc(desc)}">`)
    if (image) L.push(`<meta property="og:image" content="${esc(image)}">`)
    if (site) L.push(`<meta property="og:site_name" content="${esc(site)}">`)
    L.push('')
    L.push('<!-- Twitter -->')
    L.push(`<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`)
    if (title) L.push(`<meta name="twitter:title" content="${esc(title)}">`)
    if (desc) L.push(`<meta name="twitter:description" content="${esc(desc)}">`)
    if (image) L.push(`<meta name="twitter:image" content="${esc(image)}">`)
    if (twitter) L.push(`<meta name="twitter:site" content="@${esc(twitter.replace(/^@/, ''))}">`)
    return L.join('\n')
  }, [title, desc, url, image, site, twitter])

  async function copy() { try { await navigator.clipboard.writeText(tags); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  let host = ''; try { host = url ? new URL(url).hostname : '' } catch { host = url }

  return (
    <Stack data-testid="meta-tags">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="mt-title" /></Field>
        <Field label={s.url}><Input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" /></Field>
        <Field label={s.desc} className="sm:col-span-2"><Input value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="mt-desc" /></Field>
        <Field label={s.image}><Input value={image} onChange={(e) => setImage(e.target.value)} dir="ltr" /></Field>
        <Field label={s.site}><Input value={site} onChange={(e) => setSite(e.target.value)} /></Field>
        <Field label={s.twitter}><Input value={twitter} onChange={(e) => setTwitter(e.target.value)} dir="ltr" placeholder="@yourhandle" /></Field>
      </div>

      <div>
        <FieldLabel>{s.preview}</FieldLabel>
        <div className="mt-1 max-w-md border border-[color:var(--line)] rounded-md overflow-hidden bg-[var(--surface)]">
          {image && <div className="aspect-[1.91/1] bg-sand-200 overflow-hidden"><img src={image} alt="" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /></div>}
          <div className="p-3">
            <p className="text-[0.72rem] text-ink-faint uppercase">{host}</p>
            <p className="text-[0.98rem] font-semibold text-ink truncate">{title}</p>
            <p className="text-[0.85rem] text-ink-soft line-clamp-2">{desc}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between"><FieldLabel>{s.output}</FieldLabel>
        <Button onClick={copy} data-testid="mt-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button></div>
      <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.8rem] overflow-x-auto" dir="ltr" data-testid="mt-output">{tags}</pre>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
