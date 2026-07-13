import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Seg, SegButton, Check, FieldLabel, Button } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: {
    mode: 'Mode', url: 'URL', html: 'HTML', input: 'Input', output: 'Output', decode: 'Decode (reverse)',
    component: 'Component (encode / & = ? #)', copy: 'Copy', copied: 'Copied!', error: 'Could not decode — check the input.',
    privacy: 'Runs locally in your browser — nothing is uploaded.',
  },
  ar: {
    mode: 'الوضع', url: 'رابط', html: 'HTML', input: 'المدخل', output: 'المخرج', decode: 'فكّ الترميز (عكسي)',
    component: 'جزء (ترميز / & = ? #)', copy: 'نسخ', copied: 'تم النسخ!', error: 'تعذّر فكّ الترميز — تحقّق من المدخل.',
    privacy: 'يعمل محليًا في متصفحك — لا يُرفع أي شيء.',
  },
}

const htmlEncode = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const htmlDecode = (s: string) => {
  const el = document.createElement('textarea')
  el.innerHTML = s
  return el.value
}

export default function UrlEncoderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'url' | 'html'>('url')
  const [decode, setDecode] = useState(false)
  const [component, setComponent] = useState(true)
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const { output, error } = useMemo(() => {
    if (!input) return { output: '', error: false }
    try {
      if (mode === 'url') {
        if (decode) return { output: component ? decodeURIComponent(input) : decodeURI(input), error: false }
        return { output: component ? encodeURIComponent(input) : encodeURI(input), error: false }
      }
      return { output: decode ? htmlDecode(input) : htmlEncode(input), error: false }
    } catch { return { output: '', error: true } }
  }, [input, mode, decode, component])

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }

  return (
    <Stack data-testid="url-encoder">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1"><FieldLabel>{s.mode}</FieldLabel>
          <Seg>
            <SegButton active={mode === 'url'} onClick={() => setMode('url')} data-testid="ue-mode-url">{s.url}</SegButton>
            <SegButton active={mode === 'html'} onClick={() => setMode('html')} data-testid="ue-mode-html">{s.html}</SegButton>
          </Seg>
        </div>
        <div className="flex flex-col gap-2 pt-5">
          <Check><input type="checkbox" checked={decode} onChange={(e) => setDecode(e.target.checked)} data-testid="ue-decode" /> {s.decode}</Check>
          {mode === 'url' && <Check><input type="checkbox" checked={component} onChange={(e) => setComponent(e.target.checked)} data-testid="ue-component" /> {s.component}</Check>}
        </div>
      </div>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} dir="ltr" className="font-mono text-[0.9rem]" data-testid="ue-input" /></label>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.output}</FieldLabel>
        {error
          ? <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="ue-error">{s.error}</p>
          : <Textarea value={output} readOnly rows={4} dir="ltr" className="font-mono text-[0.9rem]" data-testid="ue-output" />}
      </label>

      <Button onClick={copy} disabled={!output} className="self-start" data-testid="ue-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
