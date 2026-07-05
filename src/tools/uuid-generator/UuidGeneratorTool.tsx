import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, DownloadIcon } from '../../components/icons'
import { Button, Textarea, Check, Stack, StackActions, Panel } from '../../components/ui'

const STR = {
  en: {
    count: 'How many', uppercase: 'Uppercase', noDashes: 'No dashes', braces: 'Wrap in braces',
    regenerate: 'Regenerate', regenerateAria: 'Generate new UUIDs',
    copyAll: 'Copy all', copied: 'Copied!', output: 'Generated UUIDs',
    privacy: 'Generated locally — nothing is uploaded.',
  },
  ar: {
    count: 'العدد', uppercase: 'أحرف كبيرة', noDashes: 'بدون شرطات', braces: 'ضمن أقواس',
    regenerate: 'إعادة توليد', regenerateAria: 'توليد معرّفات جديدة',
    copyAll: 'نسخ الكل', copied: 'تم النسخ!', output: 'المعرّفات المُولّدة',
    privacy: 'تُنشأ محليًا — لا يُرفع أي شيء.',
  },
}

function format(uuid: string, upper: boolean, noDashes: boolean, braces: boolean): string {
  let u = uuid
  if (noDashes) u = u.replace(/-/g, '')
  if (upper) u = u.toUpperCase()
  if (braces) u = `{${u}}`
  return u
}

export default function UuidGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [count, setCount] = useState(5)
  const [upper, setUpper] = useState(false)
  const [noDashes, setNoDashes] = useState(false)
  const [braces, setBraces] = useState(false)
  const [list, setList] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const regenerate = useCallback(() => {
    setList(Array.from({ length: count }, () => format(crypto.randomUUID(), upper, noDashes, braces)))
  }, [count, upper, noDashes, braces])

  useEffect(() => { regenerate() }, [regenerate])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(list.join('\n'))
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="uuid-generator">
      <Panel>
        <div className="grid gap-[0.5rem] [&>label]:text-[0.82rem] [&>label]:font-semibold [&>label]:text-ink-soft [&>label]:flex [&>label]:justify-between">
          <label htmlFor="uuid-count">{s.count} <span className="text-ink-faint font-medium">{count}</span></label>
          <input id="uuid-count" type="range" min={1} max={100} value={count}
            data-testid="uuid-count" aria-label={s.count}
            onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[0.6rem_1rem]">
          <Check><input type="checkbox" checked={upper} data-testid="uuid-uppercase" onChange={(e) => setUpper(e.target.checked)} /> {s.uppercase}</Check>
          <Check><input type="checkbox" checked={noDashes} data-testid="uuid-nodashes" onChange={(e) => setNoDashes(e.target.checked)} /> {s.noDashes}</Check>
          <Check><input type="checkbox" checked={braces} data-testid="uuid-braces" onChange={(e) => setBraces(e.target.checked)} /> {s.braces}</Check>
        </div>
        <StackActions>
          <Button onClick={regenerate} aria-label={s.regenerateAria} data-testid="uuid-regenerate">
            <DownloadIcon className="rotate-90" /> {s.regenerate}
          </Button>
          <Button variant="primary" onClick={copyAll} data-testid="uuid-copy">
            <CopyIcon /> {copied ? s.copied : s.copyAll}
          </Button>
        </StackActions>
      </Panel>

      <label className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]" htmlFor="uuid-output">{s.output}</label>
      <Textarea id="uuid-output" className="font-mono text-[0.9rem]" data-testid="uuid-output"
        readOnly rows={Math.min(count, 12)} dir="ltr" value={list.join('\n')} />

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
