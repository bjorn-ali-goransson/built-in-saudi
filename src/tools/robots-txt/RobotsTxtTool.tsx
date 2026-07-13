import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Textarea, Field, Button, Seg, SegButton, FieldLabel } from '../../components/ui'
import { CopyIcon, DownloadIcon } from '../../components/icons'

const STR = {
  en: { policy: 'Policy', allowAll: 'Allow all', blockAll: 'Block all', custom: 'Custom', agent: 'User-agent', disallow: 'Disallow paths (one per line)', delay: 'Crawl-delay (seconds, optional)', sitemap: 'Sitemap URL (optional)', output: 'robots.txt', copy: 'Copy', copied: 'Copied!', download: 'Download', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { policy: 'السياسة', allowAll: 'السماح للكل', blockAll: 'منع الكل', custom: 'مخصّص', agent: 'وكيل المستخدم', disallow: 'مسارات ممنوعة (سطر لكلٍّ)', delay: 'مهلة الزحف (ثوانٍ، اختياري)', sitemap: 'رابط خريطة الموقع (اختياري)', output: 'robots.txt', copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

export default function RobotsTxtTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [policy, setPolicy] = useState<'allow' | 'block' | 'custom'>('allow')
  const [agent, setAgent] = useState('*')
  const [disallow, setDisallow] = useState('/admin\n/private')
  const [delay, setDelay] = useState('')
  const [sitemap, setSitemap] = useState('')
  const [copied, setCopied] = useState(false)

  const out = useMemo(() => {
    const L: string[] = [`User-agent: ${agent || '*'}`]
    if (policy === 'allow') L.push('Disallow:')
    else if (policy === 'block') L.push('Disallow: /')
    else {
      const paths = disallow.split('\n').map((p) => p.trim()).filter(Boolean)
      if (paths.length) paths.forEach((p) => L.push(`Disallow: ${p.startsWith('/') ? p : '/' + p}`))
      else L.push('Disallow:')
    }
    if (delay && Number(delay) > 0) L.push(`Crawl-delay: ${Number(delay)}`)
    if (sitemap.trim()) { L.push(''); L.push(`Sitemap: ${sitemap.trim()}`) }
    return L.join('\n') + '\n'
  }, [policy, agent, disallow, delay, sitemap])

  async function copy() { try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  const url = useMemo(() => URL.createObjectURL(new Blob([out], { type: 'text/plain' })), [out])

  return (
    <Stack data-testid="robots-txt">
      <div className="flex flex-col gap-1"><FieldLabel>{s.policy}</FieldLabel>
        <Seg>
          <SegButton active={policy === 'allow'} onClick={() => setPolicy('allow')} data-testid="rb-allow">{s.allowAll}</SegButton>
          <SegButton active={policy === 'block'} onClick={() => setPolicy('block')} data-testid="rb-block">{s.blockAll}</SegButton>
          <SegButton active={policy === 'custom'} onClick={() => setPolicy('custom')} data-testid="rb-custom">{s.custom}</SegButton>
        </Seg>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.agent}><Input value={agent} onChange={(e) => setAgent(e.target.value)} dir="ltr" className="font-mono" /></Field>
        <Field label={s.delay}><Input type="number" min={0} value={delay} onChange={(e) => setDelay(e.target.value)} className="font-mono" /></Field>
      </div>
      {policy === 'custom' && <Field label={s.disallow}><Textarea value={disallow} onChange={(e) => setDisallow(e.target.value)} rows={4} dir="ltr" className="font-mono text-[0.85rem]" /></Field>}
      <Field label={s.sitemap}><Input value={sitemap} onChange={(e) => setSitemap(e.target.value)} dir="ltr" className="font-mono" placeholder="https://example.com/sitemap.xml" /></Field>

      <div className="flex items-center justify-between"><FieldLabel>{s.output}</FieldLabel>
        <div className="flex gap-2"><Button onClick={copy} data-testid="rb-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          <Button href={url} download="robots.txt"><DownloadIcon /> {s.download}</Button></div></div>
      <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.85rem] overflow-x-auto" dir="ltr" data-testid="rb-output">{out}</pre>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
