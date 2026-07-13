import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Textarea, Field, Button, FieldLabel } from '../../components/ui'
import { CopyIcon, DownloadIcon } from '../../components/icons'

const STR = {
  en: { name: 'Project name', tagline: 'One-line description', features: 'Features (one per line)', install: 'Install command', usage: 'Usage', license: 'Licence', output: 'README.md', copy: 'Copy', copied: 'Copied!', download: 'Download', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { name: 'اسم المشروع', tagline: 'وصف بسطر واحد', features: 'المزايا (ميزة لكل سطر)', install: 'أمر التثبيت', usage: 'الاستخدام', license: 'الرخصة', output: 'README.md', copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

export default function ReadmeGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [name, setName] = useState('My Project')
  const [tagline, setTagline] = useState('A short description of what it does.')
  const [features, setFeatures] = useState('Fast and lightweight\nWorks offline\nNo dependencies')
  const [install, setInstall] = useState('npm install my-project')
  const [usage, setUsage] = useState('import { thing } from "my-project"')
  const [license, setLicense] = useState('MIT')
  const [copied, setCopied] = useState(false)

  const md = useMemo(() => {
    const L: string[] = []
    L.push(`# ${name || 'Project'}`, '')
    if (tagline) L.push(`> ${tagline}`, '')
    const feats = features.split('\n').map((f) => f.trim()).filter(Boolean)
    if (feats.length) { L.push('## Features', ''); feats.forEach((f) => L.push(`- ${f}`)); L.push('') }
    if (install) L.push('## Install', '', '```bash', install, '```', '')
    if (usage) L.push('## Usage', '', '```', usage, '```', '')
    if (license) L.push('## License', '', `${license}`, '')
    return L.join('\n')
  }, [name, tagline, features, install, usage, license])

  async function copy() { try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  const url = useMemo(() => URL.createObjectURL(new Blob([md], { type: 'text/markdown' })), [md])

  return (
    <Stack data-testid="readme-generator">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.name}><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="rm-name" /></Field>
        <Field label={s.license}><Input value={license} onChange={(e) => setLicense(e.target.value)} /></Field>
        <Field label={s.tagline} className="sm:col-span-2"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>
        <Field label={s.features} className="sm:col-span-2"><Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={3} /></Field>
        <Field label={s.install}><Input value={install} onChange={(e) => setInstall(e.target.value)} dir="ltr" className="font-mono" /></Field>
        <Field label={s.usage}><Input value={usage} onChange={(e) => setUsage(e.target.value)} dir="ltr" className="font-mono" /></Field>
      </div>
      <div className="flex items-center justify-between"><FieldLabel>{s.output}</FieldLabel>
        <div className="flex gap-2"><Button onClick={copy} data-testid="rm-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          <Button href={url} download="README.md"><DownloadIcon /> {s.download}</Button></div></div>
      <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.82rem] overflow-x-auto" dir="ltr" data-testid="rm-output">{md}</pre>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
